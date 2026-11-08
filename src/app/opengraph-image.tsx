import { ImageResponse } from "next/og";
import { FONTES, ImagemDoSite, TAMANHO } from "@/lib/compartilhamento";
import { ALT_DA_IMAGEM_DO_SITE } from "@/lib/seo";

// Prévia dos links do site. Gerada no build; o perfil de cada negócio e cada
// cidade têm a sua (empresas/[usuario] e cidades/[cidade]). As outras páginas
// apontam para esta pelo metadadosDaPagina, em src/lib/seo.ts.
export const alt = ALT_DA_IMAGEM_DO_SITE;
export const size = TAMANHO;
export const contentType = "image/png";

export default function Imagem() {
  return new ImageResponse(<ImagemDoSite />, { ...TAMANHO, fonts: FONTES });
}
