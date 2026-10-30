import { tintaDoNegocio, type Tinta } from "@/lib/cortejo";

export type FaseCortina = "oculta" | "fechando" | "coberta" | "abrindo";
export type EventoCortina = "iniciar" | "cobrir" | "revelar" | "terminar" | "cancelar";
export type CliqueDaCortina = {
  atual: string;
  href: string;
  botao?: number;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  alvo?: string | null;
  download?: boolean;
  prevenido?: boolean;
  desativado?: boolean;
  teclado?: boolean;
  pausado?: boolean;
};
export type DestinoCortina = { href: string; caminho: string; tinta: Tinta | "verde-escuro" };

const caminho = (valor: string) => valor.replace(/\/+$/, "") || "/";

/** Só links comuns de página: filtros, arquivos e ações seguem o navegador. */
export function destinoDaCortina(clique: CliqueDaCortina): DestinoCortina | null {
  if (clique.teclado || clique.pausado || clique.prevenido || clique.desativado || clique.download || (clique.botao ?? 0) !== 0 || clique.ctrl || clique.meta || clique.shift || clique.alt) return null;
  if (clique.alvo && clique.alvo.toLowerCase() !== "_self") return null;

  let atual: URL;
  let destino: URL;
  try {
    atual = new URL(clique.atual);
    destino = new URL(clique.href, atual);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(destino.protocol) || destino.origin !== atual.origin || caminho(destino.pathname) === caminho(atual.pathname)) return null;
  if (/^\/(?:api|_next|enviados)(?:\/|$)/.test(destino.pathname) || /\.[a-z0-9]{2,5}$/i.test(destino.pathname) && !destino.pathname.startsWith("/empresas/")) return null;

  const negocio = /^\/empresas\/([a-z0-9._]+)\/?$/i.exec(destino.pathname)?.[1];
  return {
    href: `${destino.pathname}${destino.search}${destino.hash}`,
    caminho: caminho(destino.pathname),
    tinta: negocio ? tintaDoNegocio(negocio.toLowerCase()) : "verde-escuro",
  };
}

export function proximaFaseCortina(fase: FaseCortina, evento: EventoCortina): FaseCortina {
  if (evento === "cancelar") return "oculta";
  if (fase === "oculta" && evento === "iniciar") return "fechando";
  if (fase === "fechando" && evento === "cobrir") return "coberta";
  if (fase === "coberta" && evento === "revelar") return "abrindo";
  if (fase === "abrindo" && evento === "terminar") return "oculta";
  return fase;
}
