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
- [Embaixadores do bem](${urlAbsoluta("/embaixadores")}): quem divulga o projeto em cada cidade ou estado. Cada um tem a própria página (\`/embaixadores/<@>\`), com o Instagram e os negócios da região.
- [Como funciona](${urlAbsoluta("/sobre")}): manifesto, moderação, como o dono assume o perfil e privacidade.
- [Clube do Bem](${urlAbsoluta("/clube-do-bem")}): como funcionam os cupons de desconto, para quem compra e para o dono do negócio, e como os negócios são verificados.
- [Cadastrar um negócio](${urlAbsoluta("/participar")}): cadastro por etapas para indicar um negócio do bem ou cadastrar o próprio, com ou sem Instagram.
- [Instale o app](${urlAbsoluta("/instalacao")}): passo a passo para instalar o site como app no iPhone e no Android.

## Perfis dos negócios

Cada negócio tem uma página em ${urlAbsoluta("/empresas/")} seguido do @ do Instagram do negócio. A lista completa, com a data da última atualização de cada perfil, está no [sitemap](${urlAbsoluta("/sitemap.xml")}).

## Causas

${CAUSAS.map((causa) => `- [${causa.titulo}](${urlAbsoluta(hrefCausa(causa.slug))}): ${causa.descricao}`).join("\n")}

## Tipos de negócio

${CATEGORIAS.filter(temPaginaDeTipo).map((tipo) => `- [${tipo}](${urlAbsoluta(hrefTipo(tipo))})`).join("\n")}
`;
  return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
