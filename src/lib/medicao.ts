// Os eventos que o site manda ao Google Analytics 4, além do que a medição otimizada já
// conta (páginas vistas, rolagem, cliques para fora e buscas). Nenhum leva dado que
// identifique alguém: só o método, o tipo, a categoria e o lugar do negócio, que já são
// públicos no perfil. Sem o Analytics carregado (fora de produção), nada é mandado.

/** O cookie em que o servidor deixa os eventos para o navegador mandar na próxima página. */
export const COOKIE_EVENTOS = "ndb_eventos";

/** Quantos eventos esperam no cookie, no máximo. Uma ação gera um só. */
const MAXIMO_DE_EVENTOS = 5;

export type MetodoDeAcesso = "senha" | "google" | "link";
export type TipoDeCadastro = "indicacao" | "dono";
export type CanalDeContato = "telefone" | "whatsapp" | "instagram" | "site" | "email";

/** Os eventos que só o servidor sabe que deram certo (veja `medir`). */
export type Evento =
  | { nome: "sign_up"; params: { method: Exclude<MetodoDeAcesso, "link"> } }
  | { nome: "login"; params: { method: MetodoDeAcesso } }
  | {
      nome: "negocio_cadastrado";
      params: { tipo: TipoDeCadastro; categoria: string; uf: string; cidade: string; com_instagram: "sim" | "nao" };
    }
  | { nome: "perfil_reivindicado"; params: { method: "documento" | "instagram"; resultado: "verificada" | "em_analise" } }
  | { nome: "depoimento_publicado"; params: { categoria: string } };

type EventoLido = { nome: string; params: Record<string, string> };

function ehEvento(item: unknown): item is EventoLido {
  if (typeof item !== "object" || item === null) return false;
  const { nome, params } = item as Record<string, unknown>;
  return (
    typeof nome === "string" &&
    /^[a-z_]{1,40}$/.test(nome) &&
    typeof params === "object" &&
    params !== null &&
    Object.values(params).every((valor) => typeof valor === "string")
  );
}

/** Os eventos guardados no cookie. O que estiver fora do formato é ignorado. */
export function lerEventos(valor: string | undefined): EventoLido[] {
  if (!valor) return [];
  let dados: unknown;
  try {
    dados = JSON.parse(valor);
  } catch {
    return [];
  }
  return Array.isArray(dados) ? dados.filter(ehEvento).slice(-MAXIMO_DE_EVENTOS) : [];
}

/** O valor novo do cookie, com o evento no fim da fila. */
export function juntarEvento(valor: string | undefined, evento: Evento): string {
  return JSON.stringify([...lerEventos(valor), evento].slice(-MAXIMO_DE_EVENTOS));
}

declare global {
  interface Window {
    // Criado pelo script do Analytics (`GoogleAnalytics` no layout).
    gtag?: (...argumentos: unknown[]) => void;
  }
}

/** Manda um evento ao Analytics, se ele carregou nesta página. Só no navegador. */
export function enviarEvento(nome: string, params: Record<string, string | undefined>): void {
  const definidos = Object.fromEntries(Object.entries(params).filter(([, valor]) => valor !== undefined));
  window.gtag?.("event", nome, definidos);
}

/**
 * Atributos que fazem o clique num contato do negócio virar o evento `contato_negocio`:
 * quantas pessoas o diretório levou até cada negócio, e por qual canal.
 */
export function medirContato(canal: CanalDeContato, empresa: { categoria: string; uf: string }) {
  return { "data-medir": "contato_negocio", "data-canal": canal, "data-categoria": empresa.categoria, "data-uf": empresa.uf };
}
