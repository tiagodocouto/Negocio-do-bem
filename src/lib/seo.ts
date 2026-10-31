// Endereço público, textos padrão e dados estruturados (JSON-LD) para buscadores
// como o Google e o Bing, e para assistentes que buscam na web (ChatGPT, Perplexity).

import type { Metadata } from "next";
import { hrefCidade } from "@/lib/diretorio";
import { REPOSITORIO } from "@/lib/dominio";
import { ehFotoDoSite } from "@/lib/fotos";
import { linkPerfil, perfilOficial } from "@/lib/instagram";
import { nomeOficial } from "@/lib/municipios";

/**
 * Endereço público do site, sem barra no final, para os links absolutos (canônico,
 * sitemap, imagens de compartilhamento). No Vercel é o domínio de produção, até
 * nos previews, para os buscadores conhecerem um endereço só. Fora dele, o APP_URL.
 */
export const ENDERECO_DO_SITE = (
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.APP_URL || "http://localhost:3000"
).replace(/\/+$/, "");

/** Só a produção entra nos buscadores. Previews do Vercel ficam de fora. */
export const INDEXAVEL = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : process.env.NODE_ENV === "production";

export const NOME_DO_SITE = "Negócio do Bem";

export const TITULO_DO_SITE = "Negócio do Bem — compre de quem faz o bem";

export const DESCRICAO_DO_SITE =
  "Diretório de negócios com consciência social e raízes na comunidade. Encontre, indique e fortaleça quem compartilha dos seus valores.";

export function urlAbsoluta(caminho: string): string {
  return new URL(caminho, `${ENDERECO_DO_SITE}/`).toString();
}

/** Para páginas como login e painel, que não devem aparecer na busca. */
export const FORA_DA_BUSCA = { index: false, follow: true } as const;

/**
 * Título, descrição, endereço canônico e prévia de compartilhamento de uma página
 * pública. O openGraph de uma página substitui o do layout inteiro, por isso o
 * nome do site e o idioma vêm de novo aqui. A imagem vem do opengraph-image.tsx.
 */
export function metadadosDaPagina({ titulo, descricao, caminho }: { titulo?: string; descricao: string; caminho: string }): Metadata {
  return {
    ...(titulo ? { title: titulo } : {}),
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: NOME_DO_SITE,
      title: titulo ?? TITULO_DO_SITE,
      description: descricao,
      url: caminho,
    },
  };
}

const ID_ORGANIZACAO = `${ENDERECO_DO_SITE}/#organizacao`;
const ID_SITE = `${ENDERECO_DO_SITE}/#site`;

/** Quem é o site: o Google usa o nome e o logo nos resultados. Vai na página inicial. */
export function jsonLdDoSite() {
  const instagram = perfilOficial();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ID_ORGANIZACAO,
        name: NOME_DO_SITE,
        url: urlAbsoluta("/"),
        logo: urlAbsoluta("/icones/icone-512.png"),
        description: DESCRICAO_DO_SITE,
        sameAs: [REPOSITORIO, ...(instagram ? [linkPerfil(instagram)] : [])],
      },
      {
        "@type": "WebSite",
        "@id": ID_SITE,
        name: NOME_DO_SITE,
        alternateName: "Negocio do Bem",
        url: urlAbsoluta("/"),
        description: DESCRICAO_DO_SITE,
        inLanguage: "pt-BR",
        publisher: { "@id": ID_ORGANIZACAO },
      },
    ],
  };
}

type NegocioPublico = {
  instagramUsername: string;
  nome: string;
  resumo: string;
  categoria: string;
  cidade: string;
  uf: string;
  fotoUrl: string | null;
  site: string | null;
  whatsapp: string | null;
  emailContato: string | null;
};

/** Ficha do negócio (LocalBusiness) e o caminho até ele, pela cidade (BreadcrumbList). Só para perfis públicos. */
export function jsonLdDoNegocio(empresa: NegocioPublico, causas: string[]) {
  const pagina = urlAbsoluta(`/empresas/${empresa.instagramUsername}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${pagina}#negocio`,
        name: empresa.nome,
        description: empresa.resumo,
        url: pagina,
        ...(ehFotoDoSite(empresa.fotoUrl) && { image: urlAbsoluta(empresa.fotoUrl) }),
        address: {
          "@type": "PostalAddress",
          addressLocality: empresa.cidade,
          addressRegion: empresa.uf,
          addressCountry: "BR",
        },
        ...(empresa.whatsapp ? { telephone: `+${empresa.whatsapp}` } : {}),
        ...(empresa.emailContato ? { email: empresa.emailContato } : {}),
        sameAs: [linkPerfil(empresa.instagramUsername), ...(empresa.site ? [empresa.site] : [])],
        keywords: [empresa.categoria, ...causas].join(", "),
      },
      jsonLdDoCaminho([
        { nome: "Início", caminho: "/" },
        paginaDaCidade(empresa.cidade, empresa.uf),
        { nome: empresa.nome, caminho: `/empresas/${empresa.instagramUsername}` },
      ]),
    ],
  };
}

/** Um passo do caminho até uma página ("Início › Cidades › Salvador, BA"). */
export type Migalha = { nome: string; caminho: string };

/**
 * A página da cidade de um negócio, com o nome oficial, como na lista de cidades
 * do diretório: um cadastro antigo gravado como "Tubarão-SC" leva a Tubarão, SC.
 */
export function paginaDaCidade(cidade: string, uf: string): Migalha {
  const nome = nomeOficial(cidade, uf) ?? cidade;
  return { nome: `${nome}, ${uf}`, caminho: hrefCidade(nome, uf) };
}

function jsonLdDoCaminho(migalhas: Migalha[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: migalhas.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: m.nome, item: urlAbsoluta(m.caminho) })),
  };
}

/**
 * Página de cidade, causa ou tipo: a coleção (CollectionPage) com os negócios que
 * ela mostra (ItemList) e o caminho até ela. `sobre` diz do que a página trata,
 * como a cidade.
 */
export function jsonLdDaVitrine({
  titulo,
  descricao,
  migalhas,
  negocios,
  sobre,
}: {
  titulo: string;
  descricao: string;
  migalhas: Migalha[];
  negocios: { instagramUsername: string; nome: string }[];
  sobre?: object;
}) {
  const pagina = urlAbsoluta(migalhas[migalhas.length - 1]!.caminho);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": pagina,
        url: pagina,
        name: titulo,
        description: descricao,
        inLanguage: "pt-BR",
        isPartOf: { "@id": ID_SITE },
        ...(sobre ? { about: sobre } : {}),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: negocios.length,
          itemListElement: negocios.map((n, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: n.nome,
            url: urlAbsoluta(`/empresas/${n.instagramUsername}`),
          })),
        },
      },
      jsonLdDoCaminho(migalhas),
    ],
  };
}
