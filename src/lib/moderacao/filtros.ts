// Seções e filtros do painel da moderação (/moderacao), lidos da URL.
// Como no diretório, só valores conhecidos passam: o resto volta para o padrão.

export const ABAS = {
  "visao-geral": "Visão geral",
  reivindicacoes: "Reivindicações",
  indicacoes: "Indicações",
  denuncias: "Denúncias",
  negocios: "Negócios",
  contas: "Contas",
  depoimentos: "Depoimentos",
  auditoria: "Auditoria",
  sistema: "Sistema",
} as const;
export type Aba = keyof typeof ABAS;

export const SITUACOES_NEGOCIO = {
  todos: "Todos",
  diretorio: "No diretório",
  "fora-do-ar": "Tirados do ar",
  ocultos: "Ocultos pelo dono",
  pendentes: "Aguardando moderação",
  verificados: "Verificados",
  "sem-dono": "Sem dono",
  "sem-foto": "No diretório, sem foto",
  "sem-contato": "No diretório, sem contato",
  "sem-historia": "No diretório, sem história",
} as const;
export type SituacaoNegocio = keyof typeof SITUACOES_NEGOCIO;

export const SITUACOES_CONTA = {
  todas: "Todas",
  moderacao: "Moderação",
  donos: "Donos de negócio",
  novas: "Novas (7 dias)",
  "sem-atividade": "Sem atividade",
} as const;
export type SituacaoConta = keyof typeof SITUACOES_CONTA;

export const SITUACOES_DEPOIMENTO = {
  todos: "Todos",
  publicados: "Publicados",
  denunciados: "Com denúncia aberta",
  removidos: "Removidos",
  "sem-resposta": "Sem resposta do dono",
} as const;
export type SituacaoDepoimento = keyof typeof SITUACOES_DEPOIMENTO;

/** O que pode ser alvo de um registro da auditoria. */
export const TIPOS_DE_ALVO = ["empresa", "usuario", "reivindicacao", "depoimento"] as const;
export type Alvo = { tipo: (typeof TIPOS_DE_ALVO)[number]; id: string };

export const POR_PAGINA = 30;
export const POR_PAGINA_AUDITORIA = 50;
const ULTIMA_PAGINA = 1000;

export const DIA = 24 * 60 * 60 * 1000;
const SEMANA = 7 * DIA;

type Params = Record<string, string | string[] | undefined>;

function primeiro(params: Params, nome: string): string {
  const valor = params[nome];
  return (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? "";
}

/** Uma das chaves de `opcoes`, ou o padrão. `Object.hasOwn` recusa "constructor" e afins. */
function opcao<T extends string>(valor: string, opcoes: Record<T, string>, padrao: T): T {
  return Object.hasOwn(opcoes, valor) ? (valor as T) : padrao;
}

/** Os ids do banco são cuid: letras minúsculas e números. */
export function lerId(valor: unknown): string | null {
  return typeof valor === "string" && /^[a-z0-9]{1,40}$/.test(valor) ? valor : null;
}

export type FiltrosModeracao = {
  aba: Aba;
  q: string;
  pagina: number;
  negocios: SituacaoNegocio;
  contas: SituacaoConta;
  depoimentos: SituacaoDepoimento;
  /** Auditoria: uma ação (`empresa.aprovada`), quem fez (id da conta ou "sistema") e o alvo. */
  acao: string;
  pessoa: string;
  alvo: Alvo | null;
};

/** Lê e limpa os filtros da URL do painel. A situação vem em `situacao`, e vale para a aba aberta. */
export function lerFiltros(params: Params): FiltrosModeracao {
  const aba = opcao(primeiro(params, "aba"), ABAS, "visao-geral");
  const situacao = primeiro(params, "situacao");
  const pagina = Number.parseInt(primeiro(params, "pagina") || "1", 10);
  const acao = primeiro(params, "acao");
  const pessoa = primeiro(params, "pessoa");
  const [tipoAlvo, idAlvo] = primeiro(params, "alvo").split(":");
  const alvoValido = (TIPOS_DE_ALVO as readonly string[]).includes(tipoAlvo ?? "") && lerId(idAlvo);
  return {
    aba,
    q: primeiro(params, "q").slice(0, 100),
    pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, ULTIMA_PAGINA) : 1,
    negocios: opcao(situacao, SITUACOES_NEGOCIO, "todos"),
    contas: opcao(situacao, SITUACOES_CONTA, "todas"),
    depoimentos: opcao(situacao, SITUACOES_DEPOIMENTO, "todos"),
    acao: /^[a-z_]{1,30}\.[a-z_]{1,40}$/.test(acao) ? acao : "",
    pessoa: pessoa === "sistema" ? pessoa : (lerId(pessoa) ?? ""),
    alvo: alvoValido ? { tipo: tipoAlvo as Alvo["tipo"], id: idAlvo! } : null,
  };
}

/** Link para uma aba do painel. Só vai para a URL o que foge do padrão. */
export function hrefModeracao(aba: Aba, params: Record<string, string | number | undefined> = {}): string {
  const busca = new URLSearchParams();
  if (aba !== "visao-geral") busca.set("aba", aba);
  for (const [nome, valor] of Object.entries(params)) {
    if (valor === undefined || valor === "") continue;
    if (nome === "pagina" && Number(valor) <= 1) continue;
    if (nome === "situacao" && (valor === "todos" || valor === "todas")) continue;
    busca.set(nome, String(valor));
  }
  const texto = busca.toString();
  return texto ? `/moderacao?${texto}` : "/moderacao";
}

/**
 * Para onde uma ação da moderação volta: só caminhos da própria moderação, para
 * o campo escondido do formulário não virar um redirecionamento para outro lugar.
 */
export function destinoNaModeracao(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.includes("\\") || valor.includes("//")) return null;
  return /^\/moderacao(?:[/?]|$)/.test(valor) ? valor : null;
}

/** O mesmo caminho com `?aviso=` no lugar de um aviso anterior. */
export function comAviso(caminho: string, aviso: string): string {
  const url = new URL(caminho, "http://x");
  url.searchParams.set("aviso", aviso);
  return `${url.pathname}${url.search}`;
}

export type Semana = { inicio: Date; fim: Date; total: number };

/**
 * Conta as datas por semana, nas `semanas` semanas que terminam em `agora`, da
 * mais antiga para a mais recente. Cada semana são 7 dias corridos, então a
 * última não fica pela metade.
 */
export function agruparPorSemana(datas: Date[], agora: Date, semanas: number): Semana[] {
  const totais = new Array<number>(semanas).fill(0);
  for (const data of datas) {
    const atras = Math.max(0, Math.floor((agora.getTime() - data.getTime()) / SEMANA));
    if (atras < semanas) totais[semanas - 1 - atras]! += 1;
  }
  return totais.map((total, i) => {
    const fim = new Date(agora.getTime() - (semanas - 1 - i) * SEMANA);
    return { inicio: new Date(fim.getTime() - SEMANA), fim, total };
  });
}
