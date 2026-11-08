import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { buscarNaReceita, cnpjValido, consultarCnpj, formatarCnpj, limparCnpj, type DadosCnpj } from "@/lib/cnpj";
import { cpfValido, limparCpf, mascararCpf, miolo } from "@/lib/cpf";
import { db } from "@/lib/db";
import { apagarDocumentosGuardados } from "@/lib/documentos";
import { suspenderOfertasQueValem } from "@/lib/ofertas";
import { normalizarTexto } from "@/lib/texto";

// Regras do Clube do Bem (#248). Só a moderação libera um dono para criar ofertas, e só
// para negócio com CNPJ (o MEI também tem CNPJ) ativo na Receita. O dono pede a
// verificação com o CNPJ, e o pedido espera na fila da moderação (#286).
//
// Cada dono tem uma liberação por negócio, com um destes status:
// - "pendente": o dono pediu, e a moderação ainda não decidiu;
// - "liberada": pode criar ofertas;
// - "recusada": a moderação recusou o pedido, com o motivo;
// - "suspensa": estava liberada e foi suspensa, pela moderação ou pelo sistema.
// Recusado ou suspenso, o dono pode pedir de novo. O motivo da última decisão fica
// guardado no pedido novo, para a moderação ver o que aconteceu antes.

/** Por que a liberação ou o pedido não aconteceu. Cada motivo vira o aviso `clube_<motivo>`. */
export type MotivoRecusaClube =
  | "cnpj_invalido"
  | "receita_indisponivel"
  | "cnpj_inativo"
  | "nao_e_dono"
  | "ja_liberado"
  | "pedido_em_analise"
  | "cnpj_nao_encontrado"
  | "nome_invalido"
  | "cpf_invalido"
  | "sem_consentimento"
  | "sem_documento";

export class ErroClube extends Error {
  constructor(readonly motivo: MotivoRecusaClube) {
    super(motivo);
  }
}

// Partículas que não ajudam a comparar nomes.
const PARTICULAS = new Set(["da", "das", "de", "do", "dos", "e"]);

/** As palavras de um nome, sem acento, sem números (o CPF que a razão social do MEI traz) e sem partículas. */
function palavrasDoNome(nome: string): string[] {
  return normalizarTexto(nome)
    .replace(/[^a-z\s]/g, " ")
    .split(" ")
    .filter((palavra) => palavra.length > 1 && !PARTICULAS.has(palavra));
}

/**
 * Com quem da ficha da Receita o nome da conta bate: um sócio ou, no MEI, a razão social,
 * que traz o nome da pessoa seguido do CPF. Bate quando todas as palavras do nome da conta
 * (pelo menos duas) aparecem no nome da ficha, em qualquer ordem e sem acento. É só um
 * apoio para a moderação, que decide.
 */
export function quemBateComAConta(nomeDaConta: string, ficha: Pick<DadosCnpj, "razaoSocial" | "socios">): string | null {
  const conta = palavrasDoNome(nomeDaConta);
  if (conta.length < 2) return null;
  const candidatos = [...ficha.socios.map((socio) => socio.nome), ficha.razaoSocial];
  return (
    candidatos.find((nome) => {
      const palavras = new Set(palavrasDoNome(nome));
      return conta.every((palavra) => palavras.has(palavra));
    }) ?? null
  );
}

/**
 * Libera um dono para criar ofertas. O CNPJ e a situação "ATIVA" são conferidos de novo
 * aqui, porque a ficha que a moderação viu na tela pode ter mudado. Quem estava suspenso
 * volta a ficar liberado.
 */
export async function liberarParaClube({
  empresaId,
  usuarioId,
  cnpj,
  moderadorId,
}: {
  empresaId: string;
  usuarioId: string;
  cnpj: string;
  moderadorId: string;
}): Promise<void> {
  const numero = limparCnpj(cnpj);
  if (!cnpjValido(numero)) throw new ErroClube("cnpj_invalido");
  const membro = await db.empresaMembro.findUnique({
    where: { empresaId_usuarioId: { empresaId, usuarioId } },
    include: { empresa: { select: { instagramUsername: true } }, usuario: { select: { nome: true } } },
  });
  if (!membro) throw new ErroClube("nao_e_dono");
  const ficha = await consultarCnpj(numero);
  if (!ficha) throw new ErroClube("receita_indisponivel");
  if (normalizarTexto(ficha.situacao ?? "") !== "ativa") throw new ErroClube("cnpj_inativo");

  const decisao = { cnpj: numero, status: "liberada", motivo: null, decididoPorId: moderadorId, decididoEm: new Date() };
  await db.$transaction(async (tx) => {
    await tx.liberacaoClube.upsert({
      where: { empresaId_usuarioId: { empresaId, usuarioId } },
      create: { empresaId, usuarioId, ...decisao },
      update: decisao,
    });
    // Sem a razão social: a do MEI traz o CPF da pessoa.
    await registrarAuditoria(tx, {
      usuarioId: moderadorId,
      acao: "clube.liberado",
      alvoTipo: "empresa",
      alvoId: empresaId,
      detalhes: `@${membro.empresa.instagramUsername} · ${membro.usuario.nome} · CNPJ ${formatarCnpj(numero)}`,
    });
  });
  // A decisão está tomada: o documento já cumpriu o papel e não fica guardado.
  await apagarDocumentosDaLiberacao(empresaId, usuarioId);
}

/**
 * Suspende a liberação de um dono, e as ofertas que estão valendo no negócio saem do ar (os
 * cupons delas deixam de valer). Devolve o @ do negócio, para voltar à ficha, ou null se a
 * liberação não existe. Suspender duas vezes não grava de novo nem repete a auditoria.
 */
export async function suspenderDoClube({
  liberacaoId,
  moderadorId,
  motivo,
}: {
  liberacaoId: string;
  moderadorId: string;
  motivo: string;
}): Promise<string | null> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.liberacaoClube.updateMany({
      where: { id: liberacaoId, status: "liberada" },
      data: { status: "suspensa", motivo, decididoPorId: moderadorId, decididoEm: new Date() },
    });
    const liberacao = await tx.liberacaoClube.findUnique({
      where: { id: liberacaoId },
      include: { empresa: { select: { instagramUsername: true } }, usuario: { select: { nome: true } } },
    });
    if (!liberacao) return null;
    if (count > 0) {
      await suspenderOfertasQueValem(tx, { empresaId: liberacao.empresaId });
      await registrarAuditoria(tx, {
        usuarioId: moderadorId,
        acao: "clube.suspenso",
        alvoTipo: "empresa",
        alvoId: liberacao.empresaId,
        detalhes: `@${liberacao.empresa.instagramUsername} · ${liberacao.usuario.nome} · ${motivo}`,
      });
    }
    return liberacao.empresa.instagramUsername;
  });
}

/**
 * O dono pede para entrar no clube, com o CNPJ do negócio. Os dígitos são conferidos aqui,
 * e um CNPJ que a Receita não tem, ou diz não estar ativo, nem chega à fila. Sem resposta da
 * Receita, o pedido entra assim mesmo: a moderação consulta de novo antes de liberar.
 */
export async function pedirVerificacao({
  empresaId,
  usuarioId,
  cnpj,
  nomeCompleto,
  cpf,
  consentimento,
  documentoChaves,
}: {
  empresaId: string;
  usuarioId: string;
  cnpj: string;
  nomeCompleto: string;
  cpf: string;
  consentimento: boolean;
  /** As chaves dos documentos já guardados no bucket privado (`guardarDocumento`). Pelo menos uma. */
  documentoChaves: string[];
}): Promise<void> {
  const numero = limparCnpj(cnpj);
  if (!cnpjValido(numero)) throw new ErroClube("cnpj_invalido");
  const nome = nomeCompleto.trim().replace(/\s+/g, " ");
  if (palavrasDoNome(nome).length < 2 || nome.length > 120) throw new ErroClube("nome_invalido");
  if (!cpfValido(cpf)) throw new ErroClube("cpf_invalido");
  if (!consentimento) throw new ErroClube("sem_consentimento");
  if (documentoChaves.length === 0) throw new ErroClube("sem_documento");
  const chave = { empresaId_usuarioId: { empresaId, usuarioId } };
  const [membro, atual] = await Promise.all([
    db.empresaMembro.findUnique({ where: chave, include: { empresa: { select: { instagramUsername: true } } } }),
    db.liberacaoClube.findUnique({ where: chave, select: { status: true } }),
  ]);
  if (!membro) throw new ErroClube("nao_e_dono");
  if (atual?.status === "liberada") throw new ErroClube("ja_liberado");
  if (atual?.status === "pendente") throw new ErroClube("pedido_em_analise");
  const ficha = await buscarNaReceita(numero);
  if (ficha === "nao_encontrado") throw new ErroClube("cnpj_nao_encontrado");
  if (ficha && normalizarTexto(ficha.situacao ?? "") !== "ativa") throw new ErroClube("cnpj_inativo");

  // O CPF inteiro não sai daqui: só os 6 dígitos do meio são guardados.
  const pedido = {
    cnpj: numero,
    status: "pendente",
    nomeCompleto: nome,
    cpfMascarado: mascararCpf(limparCpf(cpf)),
    documentoChaves,
    decididoPorId: null,
    decididoEm: new Date(),
  };
  await db.$transaction(async (tx) => {
    if (!atual) {
      // Dois envios ao mesmo tempo: o segundo bate na chave única e vira "pedido em análise".
      try {
        await tx.liberacaoClube.create({ data: { empresaId, usuarioId, ...pedido } });
      } catch (erro) {
        if ((erro as { code?: string }).code === "P2002") throw new ErroClube("pedido_em_analise");
        throw erro;
      }
    } else {
      // Só sai de "recusada" ou "suspensa": se a moderação decidiu enquanto isso, nada muda.
      const { count } = await tx.liberacaoClube.updateMany({
        where: { empresaId, usuarioId, status: { in: ["recusada", "suspensa"] } },
        data: pedido,
      });
      if (count === 0) throw new ErroClube("pedido_em_analise");
    }
    await registrarAuditoria(tx, {
      usuarioId,
      acao: "clube.pedido",
      alvoTipo: "empresa",
      alvoId: empresaId,
      detalhes: `@${membro.empresa.instagramUsername} · CNPJ ${formatarCnpj(numero)}`,
    });
  });
}

/**
 * Recusa um pedido que está na fila, com o motivo, que o dono vê no painel. Devolve o @ do
 * negócio e se o pedido foi recusado agora, ou null se ele não existe. Um pedido já decidido
 * não muda.
 */
export async function recusarPedido({
  liberacaoId,
  moderadorId,
  motivo,
}: {
  liberacaoId: string;
  moderadorId: string;
  motivo: string;
}): Promise<{ username: string; empresaId: string; usuarioId: string; recusado: boolean } | null> {
  const resultado = await db.$transaction(async (tx) => {
    const { count } = await tx.liberacaoClube.updateMany({
      where: { id: liberacaoId, status: "pendente" },
      data: { status: "recusada", motivo, decididoPorId: moderadorId, decididoEm: new Date() },
    });
    const liberacao = await tx.liberacaoClube.findUnique({
      where: { id: liberacaoId },
      include: { empresa: { select: { instagramUsername: true } }, usuario: { select: { nome: true } } },
    });
    if (!liberacao) return null;
    if (count > 0) {
      await registrarAuditoria(tx, {
        usuarioId: moderadorId,
        acao: "clube.recusado",
        alvoTipo: "empresa",
        alvoId: liberacao.empresaId,
        detalhes: `@${liberacao.empresa.instagramUsername} · ${liberacao.usuario.nome} · ${motivo}`,
      });
    }
    return {
      username: liberacao.empresa.instagramUsername,
      empresaId: liberacao.empresaId,
      usuarioId: liberacao.usuarioId,
      recusado: count > 0,
    };
  });
  if (resultado?.recusado) await apagarDocumentosDaLiberacao(resultado.empresaId, resultado.usuarioId);
  return resultado;
}

/**
 * Se a pessoa pode criar ofertas no negócio: liberada pela moderação, sem suspensão, e
 * ainda dona. Quem deixa de ser dono (numa transferência, por exemplo) perde a liberação.
 */
export async function podeCriarOfertas(empresaId: string, usuarioId: string): Promise<boolean> {
  const chave = { empresaId_usuarioId: { empresaId, usuarioId } };
  const [liberacao, membro] = await Promise.all([
    db.liberacaoClube.findUnique({ where: chave, select: { status: true } }),
    db.empresaMembro.findUnique({ where: chave, select: { usuarioId: true } }),
  ]);
  return liberacao?.status === "liberada" && membro !== null;
}

/**
 * O que a ficha da Receita diz do nome e do CPF que a pessoa informou ao pedir a verificação.
 * `socio` é o sócio com o mesmo nome; `cpfBate` diz se os 6 dígitos do meio do CPF são os de
 * algum sócio (ou, no MEI, os do CPF que a razão social traz). É só um apoio: não bloqueia.
 */
export function conferirIdentidade(
  ficha: Pick<DadosCnpj, "razaoSocial" | "socios">,
  informado: { nomeCompleto: string | null; cpfMascarado: string | null },
): { nomeBate: string | null; cpfBate: boolean } {
  const nomeBate = informado.nomeCompleto ? quemBateComAConta(informado.nomeCompleto, ficha) : null;
  const meio = miolo(informado.cpfMascarado);
  const cpfDaRazao = ficha.razaoSocial.replace(/\D/g, "");
  const cpfBate =
    meio !== null &&
    (ficha.socios.some((socio) => miolo(socio.cpfMascarado) === meio) || (cpfDaRazao.length === 11 && cpfDaRazao.slice(3, 9) === meio));
  return { nomeBate, cpfBate };
}

/** Apaga os documentos de um pedido do bucket privado e limpa as chaves. Chamado quando a moderação decide. */
export async function apagarDocumentosDaLiberacao(empresaId: string, usuarioId: string): Promise<void> {
  const chave = { empresaId_usuarioId: { empresaId, usuarioId } };
  const liberacao = await db.liberacaoClube.findUnique({ where: chave, select: { documentoChaves: true } });
  if (!liberacao || liberacao.documentoChaves.length === 0) return;
  await apagarDocumentosGuardados(liberacao.documentoChaves);
  await db.liberacaoClube.update({ where: chave, data: { documentoChaves: [] } });
}

/** Dias que o documento de um pedido sem decisão fica guardado. */
export const DIAS_DO_DOCUMENTO = 30;

/**
 * Apaga os documentos dos pedidos que esperam a moderação há mais de 30 dias. Não há rotina
 * agendada: roda quando a fila do clube abre. Devolve quantos pedidos foram limpos.
 */
export async function apagarDocumentosVencidos(): Promise<number> {
  const limite = new Date(Date.now() - DIAS_DO_DOCUMENTO * 24 * 60 * 60 * 1000);
  const vencidos = await db.liberacaoClube.findMany({
    where: { status: "pendente", decididoEm: { lt: limite }, NOT: { documentoChaves: { isEmpty: true } } },
    select: { empresaId: true, usuarioId: true },
  });
  for (const { empresaId, usuarioId } of vencidos) await apagarDocumentosDaLiberacao(empresaId, usuarioId);
  return vencidos.length;
}
