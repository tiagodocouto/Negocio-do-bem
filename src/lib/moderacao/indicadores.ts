import "server-only";
import { NO_DIRETORIO } from "@/lib/consultas";
import { db, type Prisma } from "@/lib/db";
import { agruparPorSemana, DIA } from "@/lib/moderacao/filtros";
import { nomeOficial } from "@/lib/municipios";

// Os números da visão geral do painel da moderação. Contam tudo o que está no
// banco, inclusive o que não aparece para o público, salvo quando o nome diz
// "no diretório".

/** Contas que se cadastraram e não indicaram, não escreveram, não pediram nem são donas de nada. */
export const SEM_ATIVIDADE = {
  indicacoes: { none: {} },
  depoimentos: { none: {} },
  denuncias: { none: {} },
  reivindicacoes: { none: {} },
  empresas: { none: {} },
} satisfies Prisma.UsuarioWhereInput;

export type Contagem = { chave: string; total: number };

function ordenar(lista: Contagem[]): Contagem[] {
  return lista.sort((a, b) => b.total - a.total || a.chave.localeCompare(b.chave, "pt-BR"));
}

async function numerosDosNegocios(semanaPassada: Date) {
  const [grupos, semDono, novos] = await Promise.all([
    db.empresa.groupBy({ by: ["moderacao", "oculta", "status"], _count: { _all: true } }),
    db.empresa.count({ where: { membros: { none: {} } } }),
    db.empresa.count({ where: { criadoEm: { gt: semanaPassada } } }),
  ]);
  const somar = (condicao: (g: (typeof grupos)[number]) => boolean) =>
    grupos.filter(condicao).reduce((soma, g) => soma + g._count._all, 0);
  return {
    total: somar(() => true),
    noDiretorio: somar((g) => g.moderacao === "aprovada" && !g.oculta),
    verificados: somar((g) => g.status === "verificada"),
    foraDoAr: somar((g) => g.moderacao === "rejeitada"),
    ocultos: somar((g) => g.oculta),
    pendentes: somar((g) => g.moderacao === "pendente"),
    semDono,
    novos,
  };
}

async function numerosDasContas(agora: Date, semanaPassada: Date) {
  const [papeis, donos, novas, comSessao, semAtividade] = await Promise.all([
    db.usuario.groupBy({ by: ["papel"], _count: { _all: true } }),
    db.usuario.count({ where: { empresas: { some: {} } } }),
    db.usuario.count({ where: { criadoEm: { gt: semanaPassada } } }),
    db.usuario.count({ where: { sessoes: { some: { expiraEm: { gt: agora } } } } }),
    db.usuario.count({ where: SEM_ATIVIDADE }),
  ]);
  return {
    total: papeis.reduce((soma, p) => soma + p._count._all, 0),
    moderacao: papeis.find((p) => p.papel === "moderador")?._count._all ?? 0,
    donos,
    novas,
    comSessao,
    semAtividade,
  };
}

async function numerosDosDepoimentos(semanaPassada: Date) {
  const [grupos, respondidos, novos] = await Promise.all([
    db.depoimento.groupBy({ by: ["status", "denunciado"], _count: { _all: true } }),
    db.depoimento.count({ where: { status: "publicado", resposta: { not: null } } }),
    db.depoimento.count({ where: { criadoEm: { gt: semanaPassada } } }),
  ]);
  const somar = (condicao: (g: (typeof grupos)[number]) => boolean) =>
    grupos.filter(condicao).reduce((soma, g) => soma + g._count._all, 0);
  return {
    publicados: somar((g) => g.status === "publicado"),
    removidos: somar((g) => g.status === "removido"),
    denunciados: somar((g) => g.status === "publicado" && g.denunciado),
    respondidos,
    novos,
  };
}

async function numerosDasReivindicacoes() {
  const grupos = await db.reivindicacao.groupBy({ by: ["status"], _count: { _all: true } });
  const porStatus = Object.fromEntries(grupos.map((g) => [g.status, g._count._all])) as Record<string, number>;
  return {
    total: grupos.reduce((soma, g) => soma + g._count._all, 0),
    pendentes: porStatus.pendente ?? 0,
    aprovadas: porStatus.aprovada ?? 0,
    recusadas: porStatus.recusada ?? 0,
  };
}

/** Os blocos de números do topo da visão geral. */
export async function resumoDoPainel(agora = new Date()) {
  const semanaPassada = new Date(agora.getTime() - 7 * DIA);
  const [negocios, contas, depoimentos, reivindicacoes] = await Promise.all([
    numerosDosNegocios(semanaPassada),
    numerosDasContas(agora, semanaPassada),
    numerosDosDepoimentos(semanaPassada),
    numerosDasReivindicacoes(),
  ]);
  return { negocios, contas, depoimentos, reivindicacoes };
}

/** Quantos negócios, contas, depoimentos e pedidos entraram em cada uma das últimas semanas. */
export async function atividadeSemanal(agora = new Date(), semanas = 12) {
  const onde = { criadoEm: { gt: new Date(agora.getTime() - semanas * 7 * DIA) } };
  const select = { criadoEm: true } as const;
  const [negocios, contas, depoimentos, reivindicacoes] = await Promise.all([
    db.empresa.findMany({ where: onde, select }),
    db.usuario.findMany({ where: onde, select }),
    db.depoimento.findMany({ where: onde, select }),
    db.reivindicacao.findMany({ where: onde, select }),
  ]);
  const agrupar = (linhas: { criadoEm: Date }[]) => agruparPorSemana(linhas.map((l) => l.criadoEm), agora, semanas);
  return {
    negocios: agrupar(negocios),
    contas: agrupar(contas),
    depoimentos: agrupar(depoimentos),
    reivindicacoes: agrupar(reivindicacoes),
  };
}

/** Os negócios do diretório por estado, por tipo e por causa, do maior para o menor. */
export async function distribuicaoDoDiretorio() {
  const [porUf, porCategoria, porCausa] = await Promise.all([
    db.empresa.groupBy({ by: ["uf"], where: NO_DIRETORIO, _count: { _all: true } }),
    db.empresa.groupBy({ by: ["categoria"], where: NO_DIRETORIO, _count: { _all: true } }),
    db.empresaCausa.groupBy({ by: ["causa"], where: { empresa: NO_DIRETORIO }, _count: { _all: true } }),
  ]);
  return {
    porUf: ordenar(porUf.map((g) => ({ chave: g.uf, total: g._count._all }))),
    porCategoria: ordenar(porCategoria.map((g) => ({ chave: g.categoria, total: g._count._all }))),
    porCausa: ordenar(porCausa.map((g) => ({ chave: g.causa, total: g._count._all }))),
  };
}

/** O que está incompleto ou fora do padrão e merece uma olhada. */
export async function saudeDosDados(agora = new Date()) {
  const [semFoto, semContato, semHistoria, cidades, pedidosVencidos, sessoesVencidas] = await Promise.all([
    db.empresa.count({ where: { ...NO_DIRETORIO, fotoUrl: null } }),
    db.empresa.count({ where: { ...NO_DIRETORIO, site: null, whatsapp: null, emailContato: null } }),
    db.empresa.count({ where: { ...NO_DIRETORIO, historia: "" } }),
    db.empresa.groupBy({ by: ["cidade", "uf"], _count: { _all: true } }),
    db.reivindicacao.count({ where: { status: "pendente", expiraEm: { lte: agora } } }),
    db.sessao.count({ where: { expiraEm: { lte: agora } } }),
  ]);
  // Cidades gravadas antes da lista do IBGE, com outra grafia ("Sao Paulo"). `oficial` é o nome
  // que o `npm run cidades:corrigir` grava, ou null quando a cidade não está na lista.
  const cidadesForaDaLista = cidades
    .map((c) => ({ cidade: c.cidade, uf: c.uf, total: c._count._all, oficial: nomeOficial(c.cidade, c.uf) }))
    .filter((c) => c.oficial !== c.cidade)
    .sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, "pt-BR"));
  return { semFoto, semContato, semHistoria, cidadesForaDaLista, pedidosVencidos, sessoesVencidas };
}
