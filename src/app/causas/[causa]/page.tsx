import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Atalhos, Vitrine, VitrineCarregando } from "@/components/Vitrine";
import { buscarCausa, CAUSAS, GRUPOS, type Causa } from "@/lib/causas";
import { buscarDiretorio, cidadesCom } from "@/lib/consultas";
import { hrefCausa, hrefDiretorio, SEM_FILTROS } from "@/lib/diretorio";
import { CATEGORIAS } from "@/lib/dominio";
import { FORA_DA_BUSCA, jsonLdDaVitrine, metadadosDaPagina, type Migalha } from "@/lib/seo";

// "Negócios liderados por mulheres": uma página por causa (src/lib/causas.ts).
// Sem negócios, a página existe, mas fica fora da busca.

function textos(causa: Causa, total: number, cidades: number) {
  const onde = cidades === 1 ? "1 cidade" : `${cidades} cidades`;
  return {
    caminho: hrefCausa(causa.slug),
    descricao:
      total > 0
        ? `${causa.descricao} ${total} ${total === 1 ? "negócio do bem" : "negócios do bem"} em ${onde}, com contatos e depoimentos de quem é cliente.`
        : `${causa.descricao} Conhece um negócio assim? Indique no Negócio do Bem.`,
    migalhas: [
      { nome: "Início", caminho: "/" },
      { nome: "Diretório", caminho: "/explorar" },
      { nome: causa.nome, caminho: hrefCausa(causa.slug) },
    ] satisfies Migalha[],
  };
}

/** A causa do endereço e as cidades onde ela aparece. A lista é lida uma vez por requisição. */
async function dados(params: PageProps<"/causas/[causa]">["params"]) {
  const causa = buscarCausa((await params).causa);
  if (!causa) notFound();
  const cidades = await cidadesCom("causa", causa.slug);
  return { causa, cidades, total: cidades.reduce((soma, c) => soma + c.total, 0) };
}

export async function generateMetadata(props: PageProps<"/causas/[causa]">): Promise<Metadata> {
  const { causa, cidades, total } = await dados(props.params);
  const { caminho, descricao } = textos(causa, total, cidades.length);
  return { ...metadadosDaPagina({ titulo: causa.titulo, descricao, caminho }), ...(total === 0 ? { robots: FORA_DA_BUSCA } : {}) };
}

export default function PaginaDaCausa(props: PageProps<"/causas/[causa]">) {
  return (
    <Suspense fallback={<VitrineCarregando />}>
      <PaginaCausa params={props.params} />
    </Suspense>
  );
}

async function PaginaCausa({ params }: Pick<PageProps<"/causas/[causa]">, "params">) {
  const { causa, cidades, total } = await dados(params);
  const { descricao, migalhas } = textos(causa, total, cidades.length);
  const resultado = await buscarDiretorio({ ...SEM_FILTROS, causas: [causa.slug] });

  return (
    <Vitrine
      migalhas={migalhas}
      rotulo={
        <>
          <span aria-hidden="true">{causa.emoji}</span> {GRUPOS[causa.grupo]}
        </>
      }
      titulo={causa.titulo}
      introducao={
        <p>
          {causa.descricao} Estes são os negócios do diretório que abraçam essa causa, indicados pela comunidade ou cadastrados pelos
          donos.
        </p>
      }
      total={resultado.total}
      itens={resultado.itens}
      hrefNoDiretorio={hrefDiretorio({ causas: [causa.slug] })}
      jsonLd={jsonLdDaVitrine({ titulo: causa.titulo, descricao, migalhas, negocios: resultado.itens })}
    >
      <Atalhos
        titulo="Em quais cidades"
        itens={cidades.map((c) => ({
          chave: `${c.cidade}-${c.uf}`,
          rotulo: `${c.cidade}, ${c.uf}`,
          total: c.total,
          href: hrefDiretorio({ onde: `${c.cidade}, ${c.uf}`, causas: [causa.slug] }),
        }))}
      />
      <Atalhos
        titulo="Tipos de negócio"
        itens={CATEGORIAS.filter((tipo) => resultado.porCategoria[tipo]).map((tipo) => ({
          chave: tipo,
          rotulo: tipo,
          total: resultado.porCategoria[tipo],
          href: hrefDiretorio({ tipos: [tipo], causas: [causa.slug] }),
        }))}
      />
      <Atalhos
        titulo={`Outras causas de ${GRUPOS[causa.grupo].toLowerCase()}`}
        itens={CAUSAS.filter((c) => c.grupo === causa.grupo && c.slug !== causa.slug).map((c) => ({
          chave: c.slug,
          rotulo: `${c.emoji} ${c.nome}`,
          href: hrefCausa(c.slug),
        }))}
      />
    </Vitrine>
  );
}
