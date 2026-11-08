// Regras das fotos enviadas pelo site, usadas no navegador e no servidor.

export const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoDeFoto = (typeof TIPOS_DE_FOTO)[number];

/** Limite por foto, com folga para o limite de 4 MB das Server Actions (next.config.ts). */
export const TAMANHO_MAXIMO_FOTO = 3 * 1024 * 1024;

/**
 * Só mostramos imagens guardadas pelo próprio site: as do R2 ou, em
 * desenvolvimento, as da pasta public/enviados. Uma imagem de outro endereço
 * avisaria aquele servidor a cada visita ao perfil.
 *
 * O domínio do R2 vem da variável pública configurada para este ambiente. As
 * fotos antigas do Vercel Blob foram copiadas para o R2 em outubro de 2026 (#177),
 * e um endereço do Blob que sobrar no banco não aparece mais.
 */
export function ehFotoDoSite(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("/enviados/")) return !url.includes("..") && !url.includes("\\");
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;
    const dominioR2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    return dominioR2 ? new URL(dominioR2).hostname === hostname : false;
  } catch {
    return false;
  }
}
