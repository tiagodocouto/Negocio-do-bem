// Filtros do diretório (/explorar): o que vem na URL, os links que mudam um filtro
// e o campo "Onde?". Também os endereços das páginas de cidade, causa e tipo.
// Sem banco, para valer no servidor, no navegador e nos testes.
// As consultas ficam em src/lib/consultas.ts.

import { buscarCausa, filtrarCausas } from "@/lib/causas";
import { CATEGORIAS, NOMES_UF, UFS, type Uf } from "@/lib/dominio";
import { normalizarTexto } from "@/lib/texto";

export const ORDENS = {
  verificados: "Verificados primeiro",
  recentes: "Mais recentes",
  az: "Nome (A–Z)",
} as const;
export type Ordem = keyof typeof ORDENS;

export type FiltrosDiretorio = {
  q: string;
  /** O "Onde?" como a pessoa escreveu ou escolheu: "Recife, PE" ou "Pernambuco (estado)". */
  onde: string;
  /** Nomes das categorias marcadas (na URL vão como slug). */
  tipos: string[];
  causas: string[];
  verificados: boolean;
  ordem: Ordem;
  vista: "grade" | "lista";
  pagina: number;
};

export const SEM_FILTROS: FiltrosDiretorio = {
  q: "",
  onde: "",
  tipos: [],
  causas: [],
  verificados: false,
  ordem: "verificados",
  vista: "grade",
  pagina: 1,
};

function paraSlug(texto: string): string {
  return normalizarTexto(texto).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Endereço de uma categoria na URL: "Café e padaria" → "cafe-e-padaria". */
export function slugCategoria(categoria: string): string {
  return paraSlug(categoria);
}

/**
 * Endereço da página de uma cidade: "São Paulo", "SP" → "sao-paulo-sp". Sem acento
 * nem maiúscula, então grafias diferentes da mesma cidade dão o mesmo endereço.
 */
export function slugCidade(cidade: string, uf: string): string {
  return paraSlug(`${cidade} ${uf}`);
}

const CATEGORIA_POR_SLUG = new Map<string, string>(CATEGORIAS.map((c) => [slugCategoria(c), c]));

function lista(valor: string | string[] | undefined): string[] {
  if (valor === undefined) return [];
  return Array.isArray(valor) ? valor : [valor];
}

/** Lê e limpa os filtros da URL do diretório. */
export function lerFiltros(params: Record<string, string | string[] | undefined>): FiltrosDiretorio {
  const primeiro = (nome: string) => lista(params[nome])[0]?.trim() ?? "";
  // Links antigos usavam ?uf=PE.
  const uf = primeiro("uf").toUpperCase();
  const onde = primeiro("onde") || ((UFS as readonly string[]).includes(uf) ? rotuloEstado(uf as Uf) : "");
  const tipos = new Set(lista(params.tipo).map((slug) => CATEGORIA_POR_SLUG.get(slug)));
  const ordem = primeiro("ordem");
  const pagina = Number.parseInt(primeiro("pagina") || "1", 10);
  return {
    q: primeiro("q").slice(0, 100),
    onde: onde.slice(0, 80),
    tipos: CATEGORIAS.filter((c) => tipos.has(c)),
    causas: filtrarCausas(lista(params.causa)),
    verificados: primeiro("verificados") === "sim",
    ordem: Object.hasOwn(ORDENS, ordem) ? (ordem as Ordem) : "verificados",
    vista: primeiro("vista") === "lista" ? "lista" : "grade",
    pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 500) : 1,
  };
}

/** Link do diretório com esses filtros. Só vai para a URL o que foge do padrão. */
export function hrefDiretorio(filtros: Partial<FiltrosDiretorio> = {}): string {
  const f = { ...SEM_FILTROS, ...filtros };
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.onde) params.set("onde", f.onde);
  for (const tipo of f.tipos) params.append("tipo", slugCategoria(tipo));
  for (const causa of f.causas) params.append("causa", causa);
  if (f.verificados) params.set("verificados", "sim");
  if (f.ordem !== "verificados") params.set("ordem", f.ordem);
  if (f.vista !== "grade") params.set("vista", f.vista);
  if (f.pagina > 1) params.set("pagina", String(f.pagina));
  const texto = params.toString();
  return texto ? `/explorar?${texto}` : "/explorar";
}

/** Link para o mesmo diretório com uma mudança nos filtros, voltando para a página 1. */
export function mudarFiltro(filtros: FiltrosDiretorio, mudanca: Partial<FiltrosDiretorio>): string {
  return hrefDiretorio({ ...filtros, pagina: 1, ...mudanca });
}

/** Tira o valor da lista se ele já está nela; senão, acrescenta. */
export function alternar(valores: string[], valor: string): string[] {
  return valores.includes(valor) ? valores.filter((v) => v !== valor) : [...valores, valor];
}

// --- Páginas de cidade, causa e tipo ------------------------------------------
// Páginas fixas para a busca do Google ("negócios do bem em Salvador"). O
// /explorar com filtros tem sempre o mesmo canônico e não entra na busca.

export function hrefCidade(cidade: string, uf: string): string {
  return `/cidades/${slugCidade(cidade, uf)}`;
}

export function hrefCausa(slug: string): string {
  return `/causas/${slug}`;
}

/** "Outros" não tem página: não diz nada para quem busca. */
export function temPaginaDeTipo(categoria: string): boolean {
  return categoria !== "Outros" && CATEGORIA_POR_SLUG.has(slugCategoria(categoria));
}

export function hrefTipo(categoria: string): string {
  return `/tipos/${slugCategoria(categoria)}`;
}

/** A categoria de um endereço de /tipos, ou undefined se ela não tem página. */
export function categoriaDoSlug(slug: string): string | undefined {
  const categoria = CATEGORIA_POR_SLUG.get(slug);
  return categoria && temPaginaDeTipo(categoria) ? categoria : undefined;
}

/** "Negócios de café e padaria": título da página de um tipo. */
export function tituloDoTipo(categoria: string): string {
  return `Negócios de ${categoria.toLowerCase()}`;
}

// --- "Onde?" ---------------------------------------------------------------

/** Uma cidade que tem negócios no diretório. */
export type CidadeComNegocios = { cidade: string; uf: string; total: number };

/** O lugar escolhido no "Onde?". Sem `uf`, vale a cidade com esse nome em qualquer estado. */
export type Local = { cidade?: string; uf?: string; rotulo: string };

export function rotuloEstado(uf: Uf): string {
  return `${NOMES_UF[uf]} (estado)`;
}

const ESTADOS = UFS.map((uf) => ({ uf, nome: NOMES_UF[uf], busca: normalizarTexto(NOMES_UF[uf]) }));

/**
 * Entende o "Onde?": um estado ("PE", "Pernambuco" ou "Pernambuco (estado)"),
 * "Cidade, UF" ou só o nome da cidade. Um nome que é de estado e de cidade
 * (São Paulo) vale como estado, que inclui a cidade. Um lugar sem negócios
 * volta como está, para o diretório dizer que ainda não há ninguém lá.
 */
export function interpretarLocal(texto: string, cidades: CidadeComNegocios[]): Local | null {
  const busca = normalizarTexto(texto).replace(/\s*\((todo o )?estado\)$/, "");
  if (!busca) return null;

  const estado = ESTADOS.find((e) => e.busca === busca || e.uf.toLowerCase() === busca);
  if (estado) return { uf: estado.uf, rotulo: estado.nome };

  const partes = /^(.+?)\s*(?:,|\/|\s-|\s)\s*([a-z]{2})$/.exec(busca);
  const uf = partes && UFS.find((u) => u.toLowerCase() === partes[2]);
  if (partes && uf) {
    const cidade = cidades.find((c) => c.uf === uf && normalizarTexto(c.cidade) === partes[1]);
    if (cidade) return { cidade: cidade.cidade, uf, rotulo: `${cidade.cidade}, ${uf}` };
    const nome = texto.trim().replace(/\s*(?:,|\/|\s-|\s)\s*[a-z]{2}$/i, "");
    return { cidade: nome, uf, rotulo: `${nome}, ${uf}` };
  }

  const mesmoNome = cidades.filter((c) => normalizarTexto(c.cidade) === busca);
  if (mesmoNome.length === 1) {
    const [cidade] = mesmoNome;
    return { cidade: cidade!.cidade, uf: cidade!.uf, rotulo: `${cidade!.cidade}, ${cidade!.uf}` };
  }
  if (mesmoNome.length > 1) return { cidade: mesmoNome[0]!.cidade, rotulo: mesmoNome[0]!.cidade };

  const original = texto.trim();
  return { cidade: original, rotulo: original };
}

/** Uma sugestão do "Onde?". `valor` é o que vai para o campo (vazio é "Todo o Brasil"). */
export type SugestaoLocal = { valor: string; nome: string; detalhe: string; total: number; tipo: "brasil" | "estado" | "cidade" };

/**
 * Sugestões do "Onde?": sem texto, "Todo o Brasil" e as cidades com mais negócios;
 * com texto, os estados e as cidades que batem, primeiro os que começam com ele.
 */
export function sugerirLocais(texto: string, cidades: CidadeComNegocios[], limite = 8): SugestaoLocal[] {
  const busca = normalizarTexto(texto);
  const porUf = new Map<string, number>();
  for (const c of cidades) porUf.set(c.uf, (porUf.get(c.uf) ?? 0) + c.total);
  const deCidade = (c: CidadeComNegocios): SugestaoLocal => ({
    valor: `${c.cidade}, ${c.uf}`,
    nome: c.cidade,
    detalhe: c.uf,
    total: c.total,
    tipo: "cidade",
  });

  if (!busca) {
    const total = cidades.reduce((soma, c) => soma + c.total, 0);
    const maiores = [...cidades].sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, "pt-BR"));
    return [
      { valor: "", nome: "Todo o Brasil", detalhe: "", total, tipo: "brasil" as const },
      ...maiores.slice(0, limite - 1).map(deCidade),
    ];
  }

  const nivel = (texto: string) => {
    const inicio = texto.indexOf(busca);
    if (inicio < 0) return -1;
    return inicio === 0 ? 0 : texto[inicio - 1] === " " || texto[inicio - 1] === "-" ? 1 : 2;
  };
  const achados: { nivel: number; sugestao: SugestaoLocal }[] = [];
  for (const e of ESTADOS) {
    const n = e.uf.toLowerCase() === busca ? 0 : nivel(e.busca);
    if (n >= 0 && n < 2) {
      achados.push({
        nivel: n,
        sugestao: { valor: rotuloEstado(e.uf), nome: e.nome, detalhe: "todo o estado", total: porUf.get(e.uf) ?? 0, tipo: "estado" },
      });
    }
  }
  for (const c of cidades) {
    const n = nivel(normalizarTexto(c.cidade));
    if (n >= 0) achados.push({ nivel: n, sugestao: deCidade(c) });
  }
  return achados
    .sort(
      (a, b) =>
        a.nivel - b.nivel ||
        b.sugestao.total - a.sugestao.total ||
        (a.sugestao.tipo === "estado" ? 1 : 0) - (b.sugestao.tipo === "estado" ? 1 : 0) ||
        a.sugestao.nome.localeCompare(b.sugestao.nome, "pt-BR"),
    )
    .slice(0, limite)
    .map((a) => a.sugestao);
}

// --- Textos da página ------------------------------------------------------

/** Título do diretório a partir dos filtros: "Café e padaria em Recife", "Resultados para “brechó”"… */
export function tituloDoDiretorio(filtros: FiltrosDiretorio, local: Local | null): string {
  let titulo = "Todos os negócios";
  if (filtros.q) titulo = `Resultados para “${filtros.q}”`;
  else if (filtros.tipos.length === 1) titulo = filtros.tipos[0]!;
  else if (filtros.causas.length === 1 && filtros.tipos.length === 0) titulo = buscarCausa(filtros.causas[0]!)?.nome ?? titulo;
  else if (filtros.tipos.length > 1 || filtros.causas.length > 0 || filtros.verificados) titulo = "Negócios do bem";
  if (local) titulo += ` em ${local.cidade ?? local.rotulo}`;
  return titulo;
}
