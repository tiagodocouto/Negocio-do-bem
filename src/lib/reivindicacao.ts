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

/** Negócio sem dono e no ar: a reivindicação pelos dados do negócio é aprovada sozinha. */
function aprovaSozinhoPorDocumento(empresa: { moderacao: string; membros: unknown[] }): boolean {
  return empresa.moderacao !== "rejeitada" && empresa.membros.length === 0;
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

  const reivindicacao = await db.$transaction(async (tx) => {
    await bloquearPessoa(tx, params.usuarioId);
    const emAnalise = await tx.reivindicacao.findFirst({
      where: { empresaId: params.empresaId, usuarioId: params.usuarioId, metodo: "documento", status: "pendente" },
    });
    if (emAnalise) throw new ErroReivindicacao("Você já enviou os dados deste negócio e eles estão em análise.");
    await exigirLimiteDiario(tx, params.usuarioId);

    return tx.reivindicacao.create({
      data: {
        empresaId: params.empresaId,
        usuarioId: params.usuarioId,
        metodo: "documento",
        cnpj: params.cnpj,
        site: params.site,
        relacao: params.relacao,
        contato: params.contato,
        mensagem: params.mensagem,
        expiraEm: daquiA(VALIDADE_ANALISE_DIAS * DIA),
      },
    });
  });

  const empresa = await db.empresa.findUniqueOrThrow({ where: { id: params.empresaId }, include: { membros: true } });
  if (!aprovaSozinhoPorDocumento(empresa)) return reivindicacao;
  await aprovar({ reivindicacaoId: reivindicacao.id, revisorId: null });
  return db.reivindicacao.findUniqueOrThrow({ where: { id: reivindicacao.id } });
}

/**
 * Aplica a regra acima às solicitações pelos dados do negócio que ficaram na fila.
 * Vale a ordem de chegada: se duas pessoas pediram o mesmo negócio, a primeira vira
 * dona e a segunda continua com a moderação. Devolve as solicitações aprovadas.
 */
export async function aprovarPendentesSemDono(revisorId: string): Promise<string[]> {
  const pendentes = await db.reivindicacao.findMany({
    where: { status: "pendente", metodo: "documento" },
    orderBy: { criadoEm: "asc" },
    select: { id: true, empresaId: true },
  });

  const aprovadas: string[] = [];
  for (const { id, empresaId } of pendentes) {
    const empresa = await db.empresa.findUniqueOrThrow({ where: { id: empresaId }, include: { membros: true } });
    if (!aprovaSozinhoPorDocumento(empresa)) continue;
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
    conflitos.push("O negócio já tem dono verificado: decida entre adicionar como co-dono ou transferir.");
  }
  if (empresa.instagramUserId && empresa.instagramUserId !== instagramUserId) {
    conflitos.push("A conta do Instagram é diferente da registrada antes: o @ pode ter mudado de dono.");
  }
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
 * Aprova a reivindicação: a pessoa vira dona e o negócio fica verificado.
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

function linhaDeNota(texto: string): string {
  return `[${formatarDataHora(new Date())}] ${texto}`;
}
