// Regras para o dono reivindicar o perfil do seu negócio.
//
// Há dois caminhos (ver README):
//   - "documento": o caminho principal. A pessoa envia os dados do negócio (CNPJ,
//     site, contato). Se o negócio ainda não tem dono, ela vira dona na hora; se já
//     tem (disputa) ou foi tirado do ar, a moderação decide.
//   - "instagram_login": login na conta profissional; aprovação instantânea.
//     Desligado enquanto as variáveis do app da Meta estiverem vazias.
//
// Pedidos antigos podem ter o método "codigo_dm" (código mandado por DM), que não
// é mais oferecido. Eles continuam no banco e a moderação ainda pode decidi-los.
//
// A aprovação automática só acontece quando não há nenhum conflito. Qualquer
// situação estranha (negócio que já tem dono, @ que mudou de conta, mesma conta
// ligada a outro perfil) vira uma solicitação pendente com anotações para a
// moderação decidir.

import { registrarAuditoria } from "@/lib/auditoria";
import { db, type Prisma } from "@/lib/db";
import { suspenderOfertasQueValem } from "@/lib/ofertas";
import { formatarDataHora } from "@/lib/texto";

const VALIDADE_ANALISE_DIAS = 30;
const LIMITE_SOLICITACOES_POR_DIA = 10;

/** Erro com mensagem que pode ser mostrada para a pessoa. */
export class ErroReivindicacao extends Error {}

function daquiA(ms: number): Date {
  return new Date(Date.now() + ms);
}
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

async function exigirQueNaoSejaDono(empresaId: string, usuarioId: string) {
  const membro = await db.empresaMembro.findUnique({
    where: { empresaId_usuarioId: { empresaId, usuarioId } },
  });
  if (membro) throw new ErroReivindicacao("Você já é dono deste negócio.");
}

/**
 * Trava a linha da pessoa até o fim da transação. Todo caminho que cria um
 * pedido chama isto primeiro, antes de contar: pedidos simultâneos da mesma
 * conta entram um de cada vez e cada um enxerga os anteriores já gravados. Sem
 * a trava, todos leriam a mesma contagem e passariam do limite.
 *
 * A trava é FOR NO KEY UPDATE (e não FOR UPDATE) de propósito: o banco pede
 * FOR KEY SHARE na linha da pessoa a cada linha que aponta para ela, como o
 * `aprovar` faz ao criar o dono. Essa trava não conflita com a nossa, então
 * a aprovação não espera pela trava da cota enquanto segura a empresa.
 */
async function bloquearPessoa(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR NO KEY UPDATE`;
}

// Antecipa a trava da chave estrangeira: empresa antes de pedidos, como em aprovar.
async function bloquearEmpresa(tx: Prisma.TransactionClient, empresaId: string) {
  await tx.$queryRaw`SELECT id FROM "Empresa" WHERE id = ${empresaId} FOR KEY SHARE`;
}

/** Só vale depois de `bloquearPessoa`, na mesma transação que cria o pedido. */
async function exigirLimiteDiario(tx: Prisma.TransactionClient, usuarioId: string) {
  const recentes = await tx.reivindicacao.count({
    where: { usuarioId, criadoEm: { gte: new Date(Date.now() - DIA) } },
  });
  if (recentes >= LIMITE_SOLICITACOES_POR_DIA) {
    throw new ErroReivindicacao("Você fez muitas solicitações nas últimas 24 horas. Tente de novo amanhã.");
  }
}

// ---------------------------------------------------------------------------
// Caminho 1: Entrar com Instagram
// ---------------------------------------------------------------------------

export type ResultadoLoginInstagram =
  | { tipo: "verificada" }
  | { tipo: "em_analise" }
  | { tipo: "conta_diferente"; conectada: string };

/** Recebe a conta que o Instagram confirmou no login e decide o que fazer. */
export async function processarLoginInstagram(params: {
  empresaId: string;
  usuarioId: string;
  conta: { userId: string; username: string };
}): Promise<ResultadoLoginInstagram> {
  const { empresaId, usuarioId, conta } = params;
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, include: { membros: true } });
  if (!empresa) throw new ErroReivindicacao("Negócio não encontrado.");

  if (conta.username !== empresa.instagramUsername) {
    return { tipo: "conta_diferente", conectada: conta.username };
  }
  if (empresa.membros.some((m) => m.usuarioId === usuarioId)) {
    return { tipo: "verificada" };
  }

  const conflitos = await conflitosDeVerificacao({ empresa, usuarioId, instagramUserId: conta.userId });

  const reivindicacao = await db.$transaction(async (tx) => {
    await bloquearPessoa(tx, usuarioId);
    await exigirLimiteDiario(tx, usuarioId);
    await bloquearEmpresa(tx, empresaId);
    // Tentativas anteriores pelo mesmo caminho ficam obsoletas.
    await tx.reivindicacao.updateMany({
      where: { empresaId, usuarioId, metodo: "instagram_login", status: "pendente" },
      data: { status: "cancelada" },
    });
    return tx.reivindicacao.create({
      data: {
        empresaId,
        usuarioId,
        metodo: "instagram_login",
        instagramUserId: conta.userId,
        notas: conflitos.length > 0 ? linhaDeNota(`Login confirmado como @${conta.username}. ${conflitos.join(" ")}`) : "",
        expiraEm: daquiA(VALIDADE_ANALISE_DIAS * DIA),
      },
    });
  });

  if (conflitos.length > 0) return { tipo: "em_analise" };
  await aprovar({ reivindicacaoId: reivindicacao.id, revisorId: null });
  return { tipo: "verificada" };
}

// ---------------------------------------------------------------------------
// Caminho 2: documento
// ---------------------------------------------------------------------------

/**
 * Negócio sem dono e no ar: a reivindicação pelos dados do negócio é aprovada sozinha.
 * Menos para quem a moderação já tirou dos donos deste negócio: esse pedido vai para a
 * moderação.
 */
export function aprovaSozinhoPorDocumento(empresa: { moderacao: string; membros: unknown[] }, tiradaDosDonos: boolean): boolean {
  return !tiradaDosDonos && empresa.moderacao !== "rejeitada" && empresa.membros.length === 0;
}

const NOTA_TIRADA_DOS_DONOS = "A moderação já tirou esta conta dos donos deste negócio. Confira antes de aprovar.";

/** Se a moderação já tirou esta conta dos donos do negócio (um pedido dela ficou "revogada"). */
export async function foiTiradaDosDonos(
  empresaId: string,
  usuarioId: string,
  cliente: Pick<Prisma.TransactionClient, "reivindicacao"> = db,
): Promise<boolean> {
  const revogada = await cliente.reivindicacao.findFirst({ where: { empresaId, usuarioId, status: "revogada" }, select: { id: true } });
  return revogada !== null;
}

/**
 * Recebe os dados do negócio. Devolve a solicitação já aprovada quando o negócio
 * não tem dono, ou pendente para a moderação decidir.
 */
export async function solicitarPorDocumento(params: {
  empresaId: string;
  usuarioId: string;
  cnpj: string | null;
  site: string | null;
  relacao: string;
  contato: string;
  mensagem: string | null;
}) {
  await exigirQueNaoSejaDono(params.empresaId, params.usuarioId);

  const { reivindicacao, tiradaDosDonos } = await db.$transaction(async (tx) => {
    await bloquearPessoa(tx, params.usuarioId);
    const emAnalise = await tx.reivindicacao.findFirst({
      where: { empresaId: params.empresaId, usuarioId: params.usuarioId, metodo: "documento", status: "pendente" },
    });
    if (emAnalise) throw new ErroReivindicacao("Você já enviou os dados deste negócio e eles estão em análise.");
    await exigirLimiteDiario(tx, params.usuarioId);
    const tirada = await foiTiradaDosDonos(params.empresaId, params.usuarioId, tx);

    const criada = await tx.reivindicacao.create({
      data: {
        empresaId: params.empresaId,
        usuarioId: params.usuarioId,
        metodo: "documento",
        cnpj: params.cnpj,
        site: params.site,
        relacao: params.relacao,
        contato: params.contato,
        mensagem: params.mensagem,
        notas: tirada ? linhaDeNota(NOTA_TIRADA_DOS_DONOS) : "",
        expiraEm: daquiA(VALIDADE_ANALISE_DIAS * DIA),
      },
    });
    return { reivindicacao: criada, tiradaDosDonos: tirada };
  });

  const empresa = await db.empresa.findUniqueOrThrow({ where: { id: params.empresaId }, include: { membros: true } });
  if (!aprovaSozinhoPorDocumento(empresa, tiradaDosDonos)) return reivindicacao;
  await aprovar({ reivindicacaoId: reivindicacao.id, revisorId: null });
  return db.reivindicacao.findUniqueOrThrow({ where: { id: reivindicacao.id } });
}

/**
 * Os pedidos pendentes pelos dados do negócio que `aprovarPendentesSemDono` aprova de fato:
 * negócio no ar e sem dono, conta que não foi tirada dos donos dele, e só o primeiro pedido
 * elegível de cada negócio. Usada na tela da moderação e na ação em lote.
 */
export async function pendentesQueAprovamSozinhos(): Promise<{ id: string; empresaId: string; usuarioId: string }[]> {
  const candidatos = await db.reivindicacao.findMany({
    where: {
      status: "pendente",
      metodo: "documento",
      empresa: { moderacao: { not: "rejeitada" }, membros: { none: {} } },
    },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    select: {
      id: true,
      empresaId: true,
      usuarioId: true,
      empresa: { select: { moderacao: true, membros: { select: { usuarioId: true } } } },
    },
  });
  if (candidatos.length === 0) return [];

  const revogadas = await db.reivindicacao.findMany({
    where: {
      status: "revogada",
      OR: candidatos.map(({ empresaId, usuarioId }) => ({ empresaId, usuarioId })),
    },
    select: { empresaId: true, usuarioId: true },
  });
  const tiradas = new Set(revogadas.map((r) => `${r.empresaId}:${r.usuarioId}`));

  const vistos = new Set<string>();
  const elegiveis: { id: string; empresaId: string; usuarioId: string }[] = [];
  for (const { id, empresaId, usuarioId, empresa } of candidatos) {
    if (vistos.has(empresaId)) continue;
    if (!aprovaSozinhoPorDocumento(empresa, tiradas.has(`${empresaId}:${usuarioId}`))) continue;
    vistos.add(empresaId);
    elegiveis.push({ id, empresaId, usuarioId });
  }
  return elegiveis;
}

/**
 * Aplica a regra acima às solicitações pelos dados do negócio que ficaram na fila.
 * Vale a ordem de chegada: se duas pessoas pediram o mesmo negócio, a primeira vira
 * dona e a segunda continua com a moderação. Devolve as solicitações aprovadas.
 */
export async function aprovarPendentesSemDono(revisorId: string): Promise<string[]> {
  const pendentes = await pendentesQueAprovamSozinhos();

  const aprovadas: string[] = [];
  for (const { id, empresaId, usuarioId } of pendentes) {
    const empresa = await db.empresa.findUniqueOrThrow({ where: { id: empresaId }, include: { membros: true } });
    if (!aprovaSozinhoPorDocumento(empresa, await foiTiradaDosDonos(empresaId, usuarioId))) continue;
    try {
      await aprovar({ reivindicacaoId: id, revisorId });
      aprovadas.push(id);
    } catch (erro) {
      // Outra pessoa da moderação decidiu esta solicitação no meio do caminho.
      if (!(erro instanceof ErroReivindicacao)) throw erro;
    }
  }
  return aprovadas;
}

// ---------------------------------------------------------------------------
// Decisões
// ---------------------------------------------------------------------------

/**
 * Situações que impedem a aprovação automática. A lista vazia significa
 * "pode aprovar sozinho".
 */
async function conflitosDeVerificacao(params: {
  empresa: { id: string; instagramUserId: string | null; membros: { usuarioId: string }[] };
  usuarioId: string;
  instagramUserId: string;
}): Promise<string[]> {
  const { empresa, usuarioId, instagramUserId } = params;
  const conflitos: string[] = [];

  if (empresa.membros.some((m) => m.usuarioId !== usuarioId)) {
    conflitos.push("O negócio já tem dono: decida entre adicionar como co-dono ou transferir.");
  }
  if (empresa.instagramUserId && empresa.instagramUserId !== instagramUserId) {
    conflitos.push("A conta do Instagram é diferente da registrada antes: o @ pode ter mudado de dono.");
  }
  if (await foiTiradaDosDonos(empresa.id, usuarioId)) conflitos.push(NOTA_TIRADA_DOS_DONOS);
  const outra = await db.empresa.findFirst({
    where: { id: { not: empresa.id }, instagramUserId },
    select: { instagramUsername: true },
  });
  if (outra) {
    conflitos.push(`Esta conta do Instagram já está ligada ao perfil @${outra.instagramUsername} (talvez o @ tenha mudado).`);
  }
  return conflitos;
}

export type ModoAprovacao = "adicionar" | "transferir";

/**
 * Aprova a reivindicação: a pessoa vira dona e o perfil fica marcado como assumido.
 * `revisorId` null significa aprovação automática.
 * `transferir` remove os donos anteriores (usado em disputas).
 *
 * A primeira instrução trava o negócio com FOR UPDATE: toda aprovação segue a ordem negócio,
 * depois pedidos, a mesma de quem cria pedidos. Sem isso, duas aprovações de pedidos da mesma
 * pessoa podem esperar uma pela outra (deadlock). O nível é FOR UPDATE porque a aprovação pode
 * trocar o ID do Instagram, que é chave única: essa escrita conflita com o FOR KEY SHARE de
 * `bloquearEmpresa`, então a trava já nasce no mesmo nível.
 */
export async function aprovar(params: {
  reivindicacaoId: string;
  revisorId: string | null;
  modo?: ModoAprovacao;
  instagramUserId?: string;
}): Promise<void> {
  const { reivindicacaoId, revisorId, modo = "adicionar" } = params;

  await db.$transaction(async (tx) => {
    const travados = await tx.$queryRaw<{ id: string }[]>`
      SELECT e.id FROM "Empresa" e
      WHERE e.id = (SELECT r."empresaId" FROM "Reivindicacao" r WHERE r.id = ${reivindicacaoId})
      FOR UPDATE OF e`;
    if (travados.length === 0) throw new ErroReivindicacao("Esta solicitação não está mais pendente.");

    const { count } = await tx.reivindicacao.updateMany({
      where: { id: reivindicacaoId, status: "pendente" },
      data: { status: "aprovada", revisadoPorId: revisorId, revisadoEm: new Date() },
    });
    if (count === 0) throw new ErroReivindicacao("Esta solicitação não está mais pendente.");
    const reivindicacao = await tx.reivindicacao.findUniqueOrThrow({ where: { id: reivindicacaoId } });
    // Só pedidos antigos por código de DM trazem o IGSID de quem mandou a DM.
    const { empresaId, usuarioId, instagramIgsid } = reivindicacao;
    const instagramUserId = params.instagramUserId ?? reivindicacao.instagramUserId;

    if (modo === "transferir") {
      await tx.empresaMembro.deleteMany({ where: { empresaId, usuarioId: { not: usuarioId } } });
    }
    await tx.empresaMembro.upsert({
      where: { empresaId_usuarioId: { empresaId, usuarioId } },
      create: { empresaId, usuarioId, papel: "dono" },
      update: {},
    });

    // A conta do Instagram pertence a quem acabou de provar o controle dela:
    // se estava ligada a outro perfil (troca de @), deixa de estar.
    if (instagramUserId) {
      await tx.empresa.updateMany({
        where: { instagramUserId, id: { not: empresaId } },
        data: { instagramUserId: null },
      });
    }
    if (instagramIgsid) {
      await tx.empresa.updateMany({
        where: { instagramIgsid, id: { not: empresaId } },
        data: { instagramIgsid: null },
      });
    }
    await tx.empresa.update({
      where: { id: empresaId },
      data: {
        status: "verificada",
        moderacao: "aprovada",
        ...(instagramUserId ? { instagramUserId } : {}),
        ...(instagramIgsid ? { instagramIgsid } : {}),
      },
    });

    await tx.reivindicacao.update({
      where: { id: reivindicacaoId },
      data: { instagramUserId, instagramIgsid },
    });
    await tx.reivindicacao.updateMany({
      where: { empresaId, usuarioId, status: "pendente", id: { not: reivindicacaoId } },
      data: { status: "cancelada" },
    });

    await registrarAuditoria(tx, {
      usuarioId: revisorId,
      acao: modo === "transferir" ? "reivindicacao.aprovada_com_transferencia" : "reivindicacao.aprovada",
      alvoTipo: "empresa",
      alvoId: empresaId,
      detalhes: `Reivindicação ${reivindicacaoId} (${reivindicacao.metodo}) do usuário ${usuarioId}.`,
    });
  });
}

export async function recusar(params: { reivindicacaoId: string; revisorId: string; motivo: string }): Promise<void> {
  await db.$transaction(async (tx) => {
    const { count } = await tx.reivindicacao.updateMany({
      where: { id: params.reivindicacaoId, status: "pendente" },
      data: {
        status: "recusada",
        motivoRecusa: params.motivo,
        revisadoPorId: params.revisorId,
        revisadoEm: new Date(),
      },
    });
    if (count === 0) throw new ErroReivindicacao("Esta solicitação não está mais pendente.");
    const reivindicacao = await tx.reivindicacao.findUniqueOrThrow({ where: { id: params.reivindicacaoId } });
    await registrarAuditoria(tx, {
      usuarioId: params.revisorId,
      acao: "reivindicacao.recusada",
      alvoTipo: "empresa",
      alvoId: reivindicacao.empresaId,
      detalhes: `Reivindicação ${params.reivindicacaoId}: ${params.motivo}`,
    });
  });
}

export async function cancelar(reivindicacaoId: string, usuarioId: string): Promise<void> {
  await db.reivindicacao.updateMany({
    where: { id: reivindicacaoId, usuarioId, status: "pendente" },
    data: { status: "cancelada" },
  });
}

// ---------------------------------------------------------------------------
// Tirar um dono
// ---------------------------------------------------------------------------

/** O motivo que a liberação do Clube do Bem recebe quando a pessoa deixa de ser dona. */
export const MOTIVO_CLUBE_SEM_DONO = "Deixou de ser dono do negócio";

export type ResultadoRemocao =
  | { removido: false; username: string }
  | { removido: true; username: string; nome: string; semDono: boolean; ofertasSuspensas: number };

/**
 * A moderação tira uma conta dos donos do negócio, com um motivo, que a pessoa recebe por
 * e-mail. Tudo numa transação:
 * - o pedido aprovado dela vira "revogada", com o motivo. Um pedido novo dela para este
 *   negócio vai para a moderação, sem a aprovação na hora;
 * - a liberação do Clube do Bem fica suspensa (ou, em análise, recusada), e as ofertas
 *   que ela criou e ainda estavam valendo saem do ar;
 * - sem nenhum dono, o perfil volta a `indicada` e a ficar visível (`oculta: false`): some o
 *   selo "Perfil assumido" e volta o botão "Sou o dono".
 * Devolve `removido: false` se a pessoa já não era dona, e null se o negócio não existe.
 */
export async function removerDono(params: {
  empresaId: string;
  usuarioId: string;
  moderadorId: string;
  motivo: string;
}): Promise<ResultadoRemocao | null> {
  const { empresaId, usuarioId, moderadorId, motivo } = params;
  return db.$transaction(async (tx) => {
    // Trava o negócio: duas remoções ao mesmo tempo, ou uma remoção e uma aprovação, contam
    // os donos que sobraram uma depois da outra.
    const [empresa] = await tx.$queryRaw<{ instagramUsername: string }[]>`
      SELECT "instagramUsername" FROM "Empresa" WHERE id = ${empresaId} FOR NO KEY UPDATE`;
    if (!empresa) return null;
    const username = empresa.instagramUsername;
    const { count } = await tx.empresaMembro.deleteMany({ where: { empresaId, usuarioId } });
    if (count === 0) return { removido: false, username };

    const { nome } = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { nome: true } });
    const agora = new Date();
    await tx.reivindicacao.updateMany({
      where: { empresaId, usuarioId, status: "aprovada" },
      data: { status: "revogada", motivoRecusa: motivo, revisadoPorId: moderadorId, revisadoEm: agora },
    });

    const liberacao = await tx.liberacaoClube.findUnique({ where: { empresaId_usuarioId: { empresaId, usuarioId } } });
    if (liberacao?.status === "liberada" || liberacao?.status === "pendente") {
      const status = liberacao.status === "liberada" ? "suspensa" : "recusada";
      await tx.liberacaoClube.update({
        where: { id: liberacao.id },
        data: { status, motivo: MOTIVO_CLUBE_SEM_DONO, decididoPorId: moderadorId, decididoEm: agora },
      });
      await registrarAuditoria(tx, {
        usuarioId: moderadorId,
        acao: status === "suspensa" ? "clube.suspenso" : "clube.recusado",
        alvoTipo: "empresa",
        alvoId: empresaId,
        detalhes: `@${username} · ${nome} · ${MOTIVO_CLUBE_SEM_DONO}`,
      });
    }
    const { count: ofertasSuspensas } = await suspenderOfertasQueValem(
      tx,
      { empresaId, criadaPorId: usuarioId },
      agora,
    );

    const semDono = (await tx.empresaMembro.count({ where: { empresaId } })) === 0;
    if (semDono) await tx.empresa.update({ where: { id: empresaId }, data: { status: "indicada", oculta: false } });

    await registrarAuditoria(tx, {
      usuarioId: moderadorId,
      acao: "empresa.dono_removido",
      alvoTipo: "empresa",
      alvoId: empresaId,
      detalhes: `@${username} · ${nome} · ${motivo}`,
    });
    return { removido: true, username, nome, semDono, ofertasSuspensas };
  });
}

function linhaDeNota(texto: string): string {
  return `[${formatarDataHora(new Date())}] ${texto}`;
}
