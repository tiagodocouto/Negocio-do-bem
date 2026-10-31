import "server-only";
import { NO_DIRETORIO } from "@/lib/consultas";
import { db, type Prisma } from "@/lib/db";
import {
  DIA,
  POR_PAGINA,
  POR_PAGINA_AUDITORIA,
  type Alvo,
  type SituacaoConta,
  type SituacaoDepoimento,
  type SituacaoNegocio,
} from "@/lib/moderacao/filtros";
import { SEM_ATIVIDADE } from "@/lib/moderacao/indicadores";
import { normalizarTexto } from "@/lib/texto";

// As listas do painel da moderação. Nenhuma consulta daqui lê o hash da senha:
// as contas vêm sempre com `select`.

function paginar<T>(total: number, itens: T[], porPagina: number) {
  return { total, itens, paginas: Math.max(1, Math.ceil(total / porPagina)) };
}

/** Palavras da busca, sem o "@" de quem cola o perfil do Instagram. */
function termos(q: string): string[] {
  return normalizarTexto(q)
    .split(" ")
    .map((t) => t.replace(/^@/, ""))
    .filter(Boolean)
    .slice(0, 6);
}

const CONDICAO_NEGOCIO: Record<SituacaoNegocio, Prisma.EmpresaWhereInput> = {
  todos: {},
  diretorio: NO_DIRETORIO,
  "fora-do-ar": { moderacao: "rejeitada" },
  ocultos: { oculta: true },
  pendentes: { moderacao: "pendente" },
  verificados: { status: "verificada" },
  "sem-dono": { membros: { none: {} } },
  // Os três últimos olham só o diretório, como os números da visão geral.
  "sem-foto": { ...NO_DIRETORIO, fotoUrl: null },
  "sem-contato": { ...NO_DIRETORIO, site: null, whatsapp: null, emailContato: null },
  "sem-historia": { ...NO_DIRETORIO, historia: "" },
};

/** Todos os negócios, em qualquer situação, dos atualizados mais recentemente aos mais antigos. */
export async function listarNegocios(filtros: { q: string; situacao: SituacaoNegocio; pagina: number }) {
  const where: Prisma.EmpresaWhereInput = {
    ...CONDICAO_NEGOCIO[filtros.situacao],
    AND: termos(filtros.q).map((termo) => ({ busca: { contains: termo } })),
  };
  const [total, itens] = await Promise.all([
    db.empresa.count({ where }),
    db.empresa.findMany({
      where,
      orderBy: [{ atualizadoEm: "desc" }, { id: "desc" }],
      skip: (filtros.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        membros: { orderBy: { criadoEm: "asc" }, select: { usuario: { select: { id: true, nome: true } } } },
        indicadaPor: { select: { id: true, nome: true } },
        _count: { select: { depoimentos: { where: { status: "publicado" } } } },
      },
    }),
  ]);
  return paginar(total, itens, POR_PAGINA);
}

function condicaoConta(situacao: SituacaoConta, agora: Date): Prisma.UsuarioWhereInput {
  switch (situacao) {
    case "moderacao":
      return { papel: "moderador" };
    case "donos":
      return { empresas: { some: {} } };
    case "novas":
      return { criadoEm: { gt: new Date(agora.getTime() - 7 * DIA) } };
    case "sem-atividade":
      return SEM_ATIVIDADE;
    default:
      return {};
  }
}

/** As contas, das mais novas para as mais antigas. A busca procura no nome e no e-mail. */
export async function listarContas(filtros: { q: string; situacao: SituacaoConta; pagina: number }, agora = new Date()) {
  const palavras = filtros.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  const where: Prisma.UsuarioWhereInput = {
    ...condicaoConta(filtros.situacao, agora),
    AND: palavras.map((p) => ({
      OR: [{ nome: { contains: p, mode: "insensitive" } }, { email: { contains: p, mode: "insensitive" } }],
    })),
  };
  const [total, itens] = await Promise.all([
    db.usuario.count({ where }),
    db.usuario.findMany({
      where,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: (filtros.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        criadoEm: true,
        sessoes: { where: { expiraEm: { gt: agora } }, orderBy: { criadoEm: "desc" }, take: 1, select: { criadoEm: true } },
        _count: { select: { empresas: true, indicacoes: true, depoimentos: true, reivindicacoes: true } },
      },
    }),
  ]);
  return paginar(total, itens, POR_PAGINA);
}

/** Quantos itens de cada lista a ficha mostra; o total aparece ao lado. */
export const LIMITE_DA_FICHA = 30;

/** Tudo o que uma conta fez no site, para a ficha da moderação. */
export async function fichaDaConta(id: string) {
  const ultimos = { orderBy: { criadoEm: "desc" }, take: LIMITE_DA_FICHA } as const;
  const empresa = { select: { nome: true, instagramUsername: true } } as const;
  const conta = await db.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      emailConfirmadoEm: true,
      criadoEm: true,
      sessoes: { orderBy: { criadoEm: "desc" }, select: { criadoEm: true, expiraEm: true } },
      empresas: {
        orderBy: { criadoEm: "asc" },
        select: {
          criadoEm: true,
          empresa: {
            select: {
              id: true,
              nome: true,
              instagramUsername: true,
              fotoUrl: true,
              cidade: true,
              uf: true,
              moderacao: true,
              oculta: true,
              status: true,
              _count: { select: { membros: true } },
            },
          },
        },
      },
      indicacoes: {
        ...ultimos,
        select: {
          id: true,
          nome: true,
          instagramUsername: true,
          fotoUrl: true,
          cidade: true,
          uf: true,
          moderacao: true,
          oculta: true,
          status: true,
          criadoEm: true,
        },
      },
      depoimentos: {
        ...ultimos,
        select: { id: true, texto: true, status: true, denunciado: true, resposta: true, criadoEm: true, empresa },
      },
      denuncias: {
        ...ultimos,
        select: {
          id: true,
          texto: true,
          status: true,
          denunciado: true,
          motivoDenuncia: true,
          criadoEm: true,
          autor: { select: { id: true, nome: true } },
          empresa,
        },
      },
      reivindicacoes: {
        ...ultimos,
        select: {
          id: true,
          metodo: true,
          status: true,
          motivoRecusa: true,
          criadoEm: true,
          revisadoEm: true,
          empresa,
          revisadoPor: { select: { id: true, nome: true } },
        },
      },
      _count: {
        select: { indicacoes: true, depoimentos: true, denuncias: true, reivindicacoes: true, revisoes: true, registrosAuditoria: true },
      },
    },
  });
  if (!conta) return null;

  // O que a auditoria guardou: o que a pessoa fez e o que fizeram com a conta dela.
  const registros = await db.registroAuditoria.findMany({
    where: { OR: [{ usuarioId: id }, { alvoTipo: "usuario", alvoId: id }] },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: 20,
    include: { usuario: { select: { id: true, nome: true } } },
  });
  return { ...conta, auditoria: await comAlvos(registros) };
}

const CONDICAO_DEPOIMENTO: Record<SituacaoDepoimento, Prisma.DepoimentoWhereInput> = {
  todos: {},
  publicados: { status: "publicado" },
  denunciados: { status: "publicado", denunciado: true },
  removidos: { status: "removido" },
  "sem-resposta": { status: "publicado", resposta: null },
};

/** Todos os depoimentos, dos mais novos para os mais antigos. A busca procura no texto, no autor e no negócio. */
export async function listarDepoimentos(filtros: { q: string; situacao: SituacaoDepoimento; pagina: number }) {
  const q = filtros.q.trim();
  const contem = { contains: q, mode: "insensitive" } as const;
  const where: Prisma.DepoimentoWhereInput = {
    ...CONDICAO_DEPOIMENTO[filtros.situacao],
    ...(q ? { OR: [{ texto: contem }, { autor: { nome: contem } }, { empresa: { nome: contem } }] } : {}),
  };
  const [total, itens] = await Promise.all([
    db.depoimento.count({ where }),
    db.depoimento.findMany({
      where,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: (filtros.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        autor: { select: { id: true, nome: true } },
        denunciadoPor: { select: { id: true, nome: true } },
        empresa: { select: { nome: true, instagramUsername: true } },
      },
    }),
  ]);
  return paginar(total, itens, POR_PAGINA);
}

export type AlvoDoRegistro = { rotulo: string; href: string };

/** Troca o tipo e o id do alvo de cada registro por um nome e um link, quando o alvo ainda existe. */
async function comAlvos<T extends { alvoTipo: string; alvoId: string }>(registros: T[]) {
  const ids = (tipo: Alvo["tipo"]) => [...new Set(registros.filter((r) => r.alvoTipo === tipo).map((r) => r.alvoId))];
  const empresa = { select: { nome: true, instagramUsername: true } } as const;
  const [empresas, usuarios, depoimentos, reivindicacoes] = await Promise.all([
    db.empresa.findMany({ where: { id: { in: ids("empresa") } }, select: { id: true, nome: true, instagramUsername: true } }),
    db.usuario.findMany({ where: { id: { in: ids("usuario") } }, select: { id: true, nome: true } }),
    db.depoimento.findMany({ where: { id: { in: ids("depoimento") } }, select: { id: true, autor: { select: { nome: true } }, empresa } }),
    db.reivindicacao.findMany({ where: { id: { in: ids("reivindicacao") } }, select: { id: true, empresa } }),
  ]);
  const alvos = new Map<string, AlvoDoRegistro>();
  for (const e of empresas) alvos.set(`empresa:${e.id}`, { rotulo: e.nome, href: `/moderacao/negocios/${e.instagramUsername}` });
  for (const u of usuarios) alvos.set(`usuario:${u.id}`, { rotulo: u.nome, href: `/moderacao/contas/${u.id}` });
  for (const d of depoimentos) {
    alvos.set(`depoimento:${d.id}`, {
      rotulo: `Depoimento de ${d.autor.nome} em ${d.empresa.nome}`,
      href: `/empresas/${d.empresa.instagramUsername}#depoimentos`,
    });
  }
  for (const r of reivindicacoes) {
    alvos.set(`reivindicacao:${r.id}`, { rotulo: `Pedido para ${r.empresa.nome}`, href: `/moderacao/negocios/${r.empresa.instagramUsername}` });
  }
  return registros.map((r) => ({ ...r, alvo: alvos.get(`${r.alvoTipo}:${r.alvoId}`) ?? null }));
}

/** A auditoria, do registro mais novo ao mais antigo, filtrada por ação, por quem fez e por alvo. */
export async function listarAuditoria(filtros: { acao: string; pessoa: string; alvo: Alvo | null; pagina: number }) {
  const where: Prisma.RegistroAuditoriaWhereInput = {
    ...(filtros.acao ? { acao: filtros.acao } : {}),
    ...(filtros.pessoa === "sistema" ? { usuarioId: null } : filtros.pessoa ? { usuarioId: filtros.pessoa } : {}),
    ...(filtros.alvo ? { alvoTipo: filtros.alvo.tipo, alvoId: filtros.alvo.id } : {}),
  };
  const [total, registros, acoes] = await Promise.all([
    db.registroAuditoria.count({ where }),
    db.registroAuditoria.findMany({
      where,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip: (filtros.pagina - 1) * POR_PAGINA_AUDITORIA,
      take: POR_PAGINA_AUDITORIA,
      include: { usuario: { select: { id: true, nome: true } } },
    }),
    db.registroAuditoria.groupBy({ by: ["acao"], _count: { _all: true }, orderBy: { acao: "asc" } }),
  ]);
  return {
    ...paginar(total, await comAlvos(registros), POR_PAGINA_AUDITORIA),
    acoes: acoes.map((a) => ({ acao: a.acao, total: a._count._all })),
  };
}

/** O nome de uma conta ou de um alvo, para o título dos filtros da auditoria. */
export async function descreverFiltroDaAuditoria(filtros: { pessoa: string; alvo: Alvo | null }) {
  const [pessoa, [alvo]] = await Promise.all([
    filtros.pessoa && filtros.pessoa !== "sistema"
      ? db.usuario.findUnique({ where: { id: filtros.pessoa }, select: { nome: true } })
      : null,
    filtros.alvo ? comAlvos([{ alvoTipo: filtros.alvo.tipo, alvoId: filtros.alvo.id }]) : [undefined],
  ]);
  return {
    pessoa: filtros.pessoa === "sistema" ? "Sistema" : (pessoa?.nome ?? null),
    alvo: alvo?.alvo?.rotulo ?? null,
  };
}
