import type { MetadataRoute } from "next";
import { CORES_DA_MARCA } from "@/lib/marca";
import { DESCRICAO_DO_SITE, NOME_DO_SITE } from "@/lib/seo";

// Nome, cores e ícones quando alguém adiciona o site à tela de início.
// Os ícones são gerados por npm run marca:icones.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NOME_DO_SITE,
    short_name: NOME_DO_SITE,
    description: DESCRICAO_DO_SITE,
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: CORES_DA_MARCA.creme,
    theme_color: CORES_DA_MARCA.creme,
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
