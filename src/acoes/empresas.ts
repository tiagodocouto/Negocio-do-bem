"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { apagarFoto, conferirFoto, guardarFoto } from "@/lib/armazenamento";
import { registrarAuditoria } from "@/lib/auditoria";
import { caminhoSeguro, exigirUsuario } from "@/lib/auth/sessao";
import { AVISOS } from "@/lib/avisos";
import { filtrarCausas } from "@/lib/causas";
import { db } from "@/lib/db";
import { CATEGORIAS } from "@/lib/dominio";
import {
  campoEmail,
  campoMunicipio,
  campoSite,
  campoTelefoneOpcional,
  campoWhatsapp,
  errosPorCampo,
  texto,
  valoresDoFormulario,
  type EstadoFormulario,
} from "@/lib/formulario";
import { gravarFotoDaPrevia } from "@/lib/fotos-instagram";
import { enderecoLivre, enderecoSemInstagram } from "@/lib/endereco";
import { semContatosDeTerceiros } from "@/lib/indicacao";
import { normalizarUsername } from "@/lib/instagram";
import { textoDeBusca } from "@/lib/texto";

const LIMITE_INDICACOES_POR_DIA = 10;

function violouUnicidade(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2002";
}

const camposComuns = {
  nome: z.string().trim().min(2, "Qual é o nome do negócio?").max(80, "Nome muito longo."),
  categoria: z.enum(CATEGORIAS, { error: "Escolha uma categoria." }),
  municipio: campoMunicipio,
  resumo: z.string().trim().min(10, "Escreva uma frase sobre o negócio.").max(160, "Use até 160 caracteres."),
};

const camposContato = {
  site: campoSite,
  whatsapp: campoWhatsapp,
  emailContato: campoEmail,
  telefoneComercial: campoTelefoneOpcional,
  emailDoDono: campoEmail,
  telefoneDoDono: campoTelefoneOpcional,
};

function lerContato(dados: FormData) {
  return {
    site: texto(dados, "site"),
    whatsapp: texto(dados, "whatsapp"),
    emailContato: texto(dados, "emailContato"),
    telefoneComercial: texto(dados, "telefoneComercial"),
    emailDoDono: texto(dados, "emailDoDono"),
    telefoneDoDono: texto(dados, "telefoneDoDono"),
  };
}

/** O banco guarda cidade e UF em colunas separadas; o formulário manda os dois juntos. */
function comCidade<T extends { municipio: { nome: string; uf: string } }>({ municipio, ...campos }: T) {
  return { ...campos, cidade: municipio.nome, uf: municipio.uf };
}

const esquemaIndicacao = z.object({
  ...camposComuns,
  ...camposContato,
  motivo: z.string().trim().max(600, "Use até 600 caracteres.").optional(),
});

/** Quem cadastra o próprio negócio deixa o contato dele e o telefone comercial. */
const OBRIGATORIOS_DO_DONO = {
  telefoneComercial: "Qual é o telefone comercial do negócio?",
  emailDoDono: "Qual é o seu e-mail de contato?",
  telefoneDoDono: "Qual é o seu telefone de contato?",
} as const;

/** O endereço de um negócio sem Instagram, sem repetir o de outro negócio. */
async function enderecoParaNegocioSemInstagram(nome: string, cidade: string): Promise<string> {
  const base = enderecoSemInstagram(nome, cidade);
  const usados = await db.empresa.findMany({
    where: { instagramUsername: { startsWith: base } },
    select: { instagramUsername: true },
  });
  return enderecoLivre(base, usados.map((e) => e.instagramUsername));
}

export async function indicarEmpresa(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario("/participar");
  const valores = valoresDoFormulario(dados, ["causas"]);
  if (!usuario.emailConfirmado) return { erro: AVISOS.confirmar_email.texto, valores };

  const souDono = dados.get("souDono") === "sim";
  const semInstagram = dados.get("semInstagram") === "sim";
  const instagram = semInstagram ? null : normalizarUsername(texto(dados, "instagram"));
  const resultado = esquemaIndicacao.safeParse({
    nome: texto(dados, "nome"),
    categoria: texto(dados, "categoria"),
    municipio: texto(dados, "municipio"),
    resumo: texto(dados, "resumo"),
    motivo: texto(dados, "motivo") || undefined,
    ...lerContato(dados),
  });
  const erros = resultado.success ? {} : errosPorCampo(resultado.error);
  if (!semInstagram && !instagram) erros.instagram = "Digite o @ do Instagram do negócio (ex.: @padariadobairro).";
  if (souDono) {
    for (const [campo, mensagem] of Object.entries(OBRIGATORIOS_DO_DONO)) {
      if (!texto(dados, campo).trim()) erros[campo] ??= mensagem;
    }
  }
  if (!resultado.success || Object.keys(erros).length > 0) return { erros, valores };
  const { motivo, ...todos } = comCidade(resultado.data);
  const campos = semContatosDeTerceiros(todos, souDono);

  if (instagram) {
    const existente = await db.empresa.findUnique({ where: { instagramUsername: instagram } });
    if (existente) {
      return { erros: { instagram: `@${instagram} já está no Negócio do Bem.` }, existente: instagram, valores };
    }
  }
  const endereco = instagram ?? (await enderecoParaNegocioSemInstagram(campos.nome, campos.cidade));

  // A cota é conferida na mesma transação que cria o negócio. Antes de contar,
  // a linha da pessoa fica travada: envios simultâneos dela esperam a vez e
  // cada um enxerga o que o anterior publicou.
  const empresaDuplicada = new Error("O negócio já existe.");
  let empresa;
  try {
    empresa = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuario.id} FOR NO KEY UPDATE`;
      const recentes = await tx.empresa.count({
        where: { indicadaPorId: usuario.id, criadoEm: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
      if (recentes >= LIMITE_INDICACOES_POR_DIA) return null;

      const criada = await tx.empresa.create({
        data: {
          ...campos,
          instagramUsername: endereco,
          motivoIndicacao: souDono ? null : motivo || null,
          indicadaPorId: usuario.id,
          // Toda indicação entra publicada. A moderação tira do ar o que for impróprio.
          moderacao: "aprovada",
          busca: textoDeBusca({ ...campos, instagramUsername: endereco }),
          causas: { create: filtrarCausas(dados.getAll("causas").map(String)).map((causa) => ({ causa })) },
        },
      }).catch((erro: unknown) => {
        // Só a criação do negócio pode repetir um endereço.
        if (violouUnicidade(erro)) throw empresaDuplicada;
        throw erro;
      });
      await registrarAuditoria(tx, {
        usuarioId: usuario.id,
        acao: "empresa.indicada",
        alvoTipo: "empresa",
        alvoId: criada.id,
      });
      return criada;
    });
  } catch (erro) {
    // Outra pessoa cadastrou o mesmo endereço entre a conferência acima e a criação.
    if (erro !== empresaDuplicada) throw erro;
    if (instagram) return { erros: { instagram: `@${instagram} já está no Negócio do Bem.` }, existente: instagram, valores };
    return { erro: "Não conseguimos cadastrar agora. Tente de novo.", valores };
  }
  if (!empresa) {
    return { erro: "Você já fez muitas indicações hoje. Obrigado pela energia! Tente de novo amanhã.", valores };
  }

  // A foto da prévia do Instagram vira a foto do perfil, sem atrasar a resposta.
  if (instagram) {
    const empresaId = empresa.id;
    after(() => gravarFotoDaPrevia(empresaId, instagram));
  }
  redirect(souDono ? `/empresas/${endereco}/reivindicar` : `/empresas/${endereco}?aviso=indicada`);
}

const esquemaEdicao = z.object({
  ...camposComuns,
  ...camposContato,
  historia: z.string().max(20_000, "A história pode ter até 20 mil caracteres.").default(""),
});

async function exigirDono(empresaId: string, voltarPara: string) {
  const usuario = await exigirUsuario(voltarPara);
  const membro = await db.empresaMembro.findUnique({
    where: { empresaId_usuarioId: { empresaId, usuarioId: usuario.id } },
    include: { empresa: true },
  });
  if (!membro) redirect("/painel");
  return { usuario, empresa: membro.empresa };
}

/** O dono do perfil ou a moderação, que pode editar qualquer negócio. */
async function exigirEditor(empresaId: string, voltarPara: string) {
  const usuario = await exigirUsuario(voltarPara);
  const empresa = await db.empresa.findUnique({
    where: { id: empresaId },
    include: { membros: { select: { usuarioId: true } } },
  });
  if (!empresa) redirect("/");
  const dono = empresa.membros.some((m) => m.usuarioId === usuario.id);
  if (!dono && !usuario.moderador) redirect("/painel");
  return { usuario, empresa, pelaModeracao: !dono };
}

/** Edições feitas pela moderação ficam marcadas na auditoria. */
function auditarEdicao(usuarioId: string, empresa: { id: string; instagramUsername: string }, acao: string, pelaModeracao: boolean) {
  return registrarAuditoria(db, {
    usuarioId,
    acao: pelaModeracao ? `${acao}_pela_moderacao` : acao,
    alvoTipo: "empresa",
    alvoId: empresa.id,
    detalhes: `@${empresa.instagramUsername}`,
  });
}

/** Página para onde o formulário volta: o painel do dono ou a edição na moderação. */
function voltarDe(dados: FormData, empresa: { instagramUsername: string }): string {
  return caminhoSeguro(texto(dados, "voltar"), `/painel/${empresa.instagramUsername}`);
}

export async function salvarEmpresa(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { usuario, empresa, pelaModeracao } = await exigirEditor(texto(dados, "empresaId"), "/painel");
  const valores = valoresDoFormulario(dados, ["causas"]);

  const resultado = esquemaEdicao.safeParse({
    nome: texto(dados, "nome"),
    categoria: texto(dados, "categoria"),
    municipio: texto(dados, "municipio"),
    resumo: texto(dados, "resumo"),
    historia: texto(dados, "historia").replace(/\r\n/g, "\n"),
    ...lerContato(dados),
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error), valores };
  const campos = comCidade(resultado.data);
  const causas = filtrarCausas(dados.getAll("causas").map(String));

  await db.$transaction([
    db.empresa.update({
      where: { id: empresa.id },
      data: { ...campos, busca: textoDeBusca({ ...campos, instagramUsername: empresa.instagramUsername }) },
    }),
    db.empresaCausa.deleteMany({ where: { empresaId: empresa.id } }),
    db.empresaCausa.createMany({ data: causas.map((causa) => ({ empresaId: empresa.id, causa })) }),
  ]);
  await auditarEdicao(usuario.id, empresa, "empresa.editada", pelaModeracao);

  redirect(`${voltarDe(dados, empresa)}?aviso=salvo`);
}

export async function alternarVisibilidade(dados: FormData): Promise<void> {
  const { usuario, empresa } = await exigirDono(texto(dados, "empresaId"), "/painel");
  const oculta = dados.get("ocultar") === "sim";
  await db.empresa.update({ where: { id: empresa.id }, data: { oculta } });
  await registrarAuditoria(db, {
    usuarioId: usuario.id,
    acao: oculta ? "empresa.ocultada" : "empresa.reexibida",
    alvoTipo: "empresa",
    alvoId: empresa.id,
  });
  redirect(`/painel/${empresa.instagramUsername}?aviso=${oculta ? "oculta" : "visivel"}`);
}

/** Troca a foto do perfil: o dono ou a moderação. */
export async function trocarFoto(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { usuario, empresa, pelaModeracao } = await exigirEditor(texto(dados, "empresaId"), "/painel");
  const foto = await conferirFoto(dados.get("foto"));
  if ("erro" in foto) return { erro: foto.erro };

  let fotoUrl: string;
  try {
    fotoUrl = await guardarFoto(foto, "perfis");
  } catch (erro) {
    console.error("Falha ao guardar a foto do perfil", erro);
    return { erro: "Não conseguimos guardar a foto agora. Tente de novo em instantes." };
  }
  await db.empresa.update({ where: { id: empresa.id }, data: { fotoUrl } });
  await apagarFoto(empresa.fotoUrl);
  await auditarEdicao(usuario.id, empresa, "empresa.foto_trocada", pelaModeracao);
  redirect(`${voltarDe(dados, empresa)}?aviso=foto_salva`);
}

/** Tira a foto do perfil: o dono ou a moderação. */
export async function removerFoto(dados: FormData): Promise<void> {
  const { usuario, empresa, pelaModeracao } = await exigirEditor(texto(dados, "empresaId"), "/painel");
  await db.empresa.update({ where: { id: empresa.id }, data: { fotoUrl: null } });
  await apagarFoto(empresa.fotoUrl);
  await auditarEdicao(usuario.id, empresa, "empresa.foto_removida", pelaModeracao);
  redirect(`${voltarDe(dados, empresa)}?aviso=foto_removida`);
}

/** Guarda uma foto para a história e devolve o endereço, que o editor coloca no texto. */
export async function enviarFotoDaHistoria(dados: FormData): Promise<{ url?: string; erro?: string }> {
  const { empresa } = await exigirEditor(texto(dados, "empresaId"), "/painel");
  const foto = await conferirFoto(dados.get("foto"));
  if ("erro" in foto) return { erro: foto.erro };
  try {
    return { url: await guardarFoto(foto, "historias") };
  } catch (erro) {
    console.error("Falha ao guardar a foto da história", empresa.id, erro);
    return { erro: "Não conseguimos guardar a foto agora. Tente de novo em instantes." };
  }
}
