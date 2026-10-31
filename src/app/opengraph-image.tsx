import { ImageResponse } from "next/og";
import { FONTES, ImagemDoSite, TAMANHO } from "@/lib/compartilhamento";

// Prévia dos links do site. Gerada no build; o perfil de cada negócio tem a sua
// em empresas/[usuario]/opengraph-image.tsx.
export const alt = "Negócio do Bem: compre de quem faz o bem";
export const size = TAMANHO;
export const contentType = "image/png";

export default function Imagem() {
  return new ImageResponse(<ImagemDoSite />, { ...TAMANHO, fonts: FONTES });
}
