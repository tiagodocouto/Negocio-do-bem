import { CAUSAS } from "@/lib/causas";
import { hrefCausa, hrefTipo, temPaginaDeTipo } from "@/lib/diretorio";
import { CATEGORIAS } from "@/lib/dominio";
import { DESCRICAO_DO_SITE, NOME_DO_SITE, urlAbsoluta } from "@/lib/seo";

// Resumo do site em Markdown para assistentes de IA (formato llms.txt, ver
// https://llmstxt.org). Não depende do banco: é gerado no build.
export function GET() {
  const texto = `# ${NOME_DO_SITE}

> ${DESCRICAO_DO_SITE}

O ${NOME_DO_SITE} é um diretório gratuito e colaborativo de negócios brasileiros que cuidam das pessoas, da comunidade e do planeta. Qualquer pessoa pode indicar um negócio; a moderação confere cada indicação antes de publicar, e o dono pode assumir o perfil para contar a história do negócio. Cada perfil mostra cidade, tipo de negócio, causas, contatos e depoimentos de quem é cliente.

## Páginas principais

- [Explorar negócios](${urlAbsoluta("/explorar")}): busca por cidade, tipo de negócio e causa.
- [Negócios por cidade](${urlAbsoluta("/cidades")}): todas as cidades com negócios no diretório, cada uma com a sua página.
- [Como funciona](${urlAbsoluta("/sobre")}): manifesto, moderação, como o dono assume o perfil e privacidade.
- [Indicar um negócio](${urlAbsoluta("/indicar")}): formulário para sugerir um negócio do bem.

## Perfis dos negócios

Cada negócio tem uma página em ${urlAbsoluta("/empresas/")} seguido do @ do Instagram do negócio. A lista completa, com a data da última atualização de cada perfil, está no [sitemap](${urlAbsoluta("/sitemap.xml")}).

## Causas

${CAUSAS.map((causa) => `- [${causa.titulo}](${urlAbsoluta(hrefCausa(causa.slug))}): ${causa.descricao}`).join("\n")}

## Tipos de negócio

${CATEGORIAS.filter(temPaginaDeTipo).map((tipo) => `- [${tipo}](${urlAbsoluta(hrefTipo(tipo))})`).join("\n")}
`;
  return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
