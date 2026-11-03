import type { MetadataRoute } from "next";
import { CORES_DA_MARCA } from "@/lib/marca";
import { DESCRICAO_DO_SITE, NOME_DO_SITE } from "@/lib/seo";

// Nome, cores e ícones quando alguém instala o site como app ou o adiciona à
// tela de início. Os ícones são gerados por npm run marca:icones. O service
// worker fica em public/sw.js.
export default function manifest(): MetadataRoute.Manifest {
  return {
    // O id não pode mudar: é por ele que o celular reconhece o app já instalado.
    id: "/",
    name: NOME_DO_SITE,
    short_name: NOME_DO_SITE,
    description: DESCRICAO_DO_SITE,
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: CORES_DA_MARCA.creme,
    theme_color: CORES_DA_MARCA.creme,
    categories: ["lifestyle", "shopping", "social"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Aparecem ao segurar o ícone do app.
    shortcuts: [
      { name: "Explorar negócios", short_name: "Explorar", url: "/explorar" },
      { name: "Cadastrar um negócio", short_name: "Cadastrar", url: "/participar" },
      { name: "Meu painel", short_name: "Painel", url: "/painel" },
    ],
  };
}
