import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IconeCategoria } from "@/components/IconeCategoria";
import { Atalhos, Vitrine, VitrineCarregando } from "@/components/Vitrine";
import { CAUSAS } from "@/lib/causas";
import { buscarDiretorio, cidadesCom } from "@/lib/consultas";
import { categoriaDoSlug, hrefDiretorio, hrefTipo, SEM_FILTROS, temPaginaDeTipo, tituloDoTipo } from "@/lib/diretorio";
import { CATEGORIAS } from "@/lib/dominio";
import { FORA_DA_BUSCA, jsonLdDaVitrine, metadadosDaPagina, type Migalha } from "@/lib/seo";

// "Negócios de café e padaria": uma página por tipo de negócio, menos "Outros".
// Sem negócios, a página existe, mas fica fora da busca.

function textos(categoria: string, total: number, cidades: number) {
  const titulo = tituloDoTipo(categoria);
  const onde = cidades === 1 ? "1 cidade" : `${cidades} cidades`;
  return {
    titulo,
    caminho: hrefTipo(categoria),
    descricao:
      total > 0
        ? `${titulo} com consciência social e raízes na comunidade: ${total} no diretório, em ${onde}, com causas, contatos e depoimentos de quem é cliente.`
        : `${titulo} com consciência social e raízes na comunidade. Conhece algum? Indique no Negócio do Bem.`,
    migalhas: [
      { nome: "Início", caminho: "/" },
      { nome: "Diretório", caminho: "/explorar" },
      { nome: categoria, caminho: hrefTipo(categoria) },
    ] satisfies Migalha[],
  };
}

/** O tipo do endereço e as cidades onde ele aparece. A lista é lida uma vez por requisição. */
async function dados(params: PageProps<"/tipos/[tipo]">["params"]) {
  const categoria = categoriaDoSlug((await params).tipo);
  if (!categoria) notFound();
  const cidades = await cidadesCom("categoria", categoria);
  return { categoria, cidades, total: cidades.reduce((soma, c) => soma + c.total, 0) };
}

export async function generateMetadata(props: PageProps<"/tipos/[tipo]">): Promise<Metadata> {
  const { categoria, cidades, total } = await dados(props.params);
  const { titulo, caminho, descricao } = textos(categoria, total, cidades.length);
  return { ...metadadosDaPagina({ titulo, descricao, caminho }), ...(total === 0 ? { robots: FORA_DA_BUSCA } : {}) };
}

export default function PaginaDoTipo(props: PageProps<"/tipos/[tipo]">) {
  return (
    <Suspense fallback={<VitrineCarregando />}>
      <PaginaTipo params={props.params} />
    </Suspense>
  );
}

async function PaginaTipo({ params }: Pick<PageProps<"/tipos/[tipo]">, "params">) {
  const { categoria, cidades, total } = await dados(params);
  const { titulo, descricao, migalhas } = textos(categoria, total, cidades.length);
  const resultado = await buscarDiretorio({ ...SEM_FILTROS, tipos: [categoria] });

  return (
    <Vitrine
      migalhas={migalhas}
      rotulo={
        <span className="inline-flex items-center gap-1.5">
          <IconeCategoria categoria={categoria} className="h-4 w-4" />
          Tipo de negócio
        </span>
      }
      titulo={titulo}
      introducao={
        <p>
          {categoria} com consciência social e raízes na comunidade, de todo o Brasil. Escolha pela cidade ou pelas causas que
          importam para você.
        </p>
      }
      total={resultado.total}
      itens={resultado.itens}
      hrefNoDiretorio={hrefDiretorio({ tipos: [categoria] })}
      jsonLd={jsonLdDaVitrine({ titulo, descricao, migalhas, negocios: resultado.itens })}
    >
      <Atalhos
        titulo="Em quais cidades"
        itens={cidades.map((c) => ({
          chave: `${c.cidade}-${c.uf}`,
          rotulo: `${c.cidade}, ${c.uf}`,
          total: c.total,
          href: hrefDiretorio({ onde: `${c.cidade}, ${c.uf}`, tipos: [categoria] }),
        }))}
      />
      <Atalhos
        titulo="Causas"
        itens={CAUSAS.filter((causa) => resultado.porCausa[causa.slug]).map((causa) => ({
          chave: causa.slug,
          rotulo: `${causa.emoji} ${causa.nome}`,
          total: resultado.porCausa[causa.slug],
          href: hrefDiretorio({ tipos: [categoria], causas: [causa.slug] }),
        }))}
      />
      <Atalhos
        titulo="Outros tipos de negócio"
        itens={CATEGORIAS.filter((tipo) => tipo !== categoria && temPaginaDeTipo(tipo)).map((tipo) => ({
          chave: tipo,
          rotulo: tipo,
          href: hrefTipo(tipo),
        }))}
      />
    </Vitrine>
  );
}
