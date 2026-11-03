import type { MetadataRoute } from "next";
import { INDEXAVEL, urlAbsoluta } from "@/lib/seo";

// Todos os robôs podem ler o site, inclusive os de busca com IA (OAI-SearchBot
// e GPTBot do ChatGPT, PerplexityBot, ClaudeBot). Ficam de fora só as áreas de
// quem está logado. Login, cadastro e reivindicação continuam abertos para o
// robô ler o noindex dessas páginas; bloqueadas aqui, poderiam aparecer na
// busca só com o endereço.
//
// O /explorar com filtros (/explorar?...) também fica de fora. Os filtros se
// combinam sem fim, cada combinação consulta o banco e todas têm o /explorar
// como canônico, então nada delas entra na busca. Em 30/10/2026 o GPTBot abriu
// essas combinações sem parar e esgotou a cota do Neon (#141). O diretório
// continua chegando aos robôs pelo /explorar, pelas páginas de cidade, causa e
// tipo e pelo sitemap.
export default function robots(): MetadataRoute.Robots {
  if (!INDEXAVEL) {
    // Previews do Vercel: nada entra no índice, para não competir com a produção.
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/painel", "/moderacao", "/api/", "/explorar?"] },
    sitemap: urlAbsoluta("/sitemap.xml"),
  };
}
