import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CapaDaCidade } from "@/components/CapaDaCidade";
import { Atalhos, Vitrine, VitrineCarregando } from "@/components/Vitrine";
import { CAUSAS } from "@/lib/causas";
import { buscarDiretorio, cidadeDoSlug, listarCidades } from "@/lib/consultas";
import { hrefCidade, hrefDiretorio, SEM_FILTROS, slugCidade, type CidadeComNegocios } from "@/lib/diretorio";
import { CATEGORIAS, NOMES_UF, type Uf } from "@/lib/dominio";
import { fotoDaCidade } from "@/lib/fotos-das-cidades";
import { jsonLdDaVitrine, metadadosDaPagina, type Migalha } from "@/lib/seo";

// "Negócios do bem em Salvador, BA": a página que responde a quem busca pela cidade.
// Só existe para cidades com negócios no diretório; as outras mostram "Não encontramos esta página".
// As cidades de fotos-das-cidades.json levam a foto no topo e têm a prévia do link
// pronta de antemão, em JPEG. As outras usam o opengraph-image.tsx desta pasta.

function textos(cidade: CidadeComNegocios) {
  const onde = `${cidade.cidade}, ${cidade.uf}`;
  const caminho = hrefCidade(cidade.cidade, cidade.uf);
  const quantos = `${cidade.total} ${cidade.total === 1 ? "negócio" : "negócios"}`;
  return {
    onde,
    caminho,
    titulo: `Negócios do bem em ${onde}`,
    descricao: `${quantos} do bem em ${onde}: negócios com consciência social e raízes na comunidade, indicados por quem é cliente. Veja tipos, causas, contatos e depoimentos.`,
    migalhas: [
      { nome: "Início", caminho: "/" },
      { nome: "Cidades", caminho: "/cidades" },
      { nome: onde, caminho },
    ] satisfies Migalha[],
  };
}

export async function generateMetadata(props: PageProps<"/cidades/[cidade]">): Promise<Metadata> {
  const cidade = await cidadeDoSlug((await props.params).cidade);
  if (!cidade) notFound();
  const { onde, titulo, descricao, caminho } = textos(cidade);
  const foto = fotoDaCidade(cidade.cidade, cidade.uf);
  return metadadosDaPagina({
    titulo,
    descricao,
    caminho,
    imagemPropria: true,
    previa: foto ? { url: foto.previa, alt: `${foto.alt}, com o texto "Negócios do bem em ${onde}"` } : undefined,
  });
}

export default function PaginaDaCidade(props: PageProps<"/cidades/[cidade]">) {
  return (
    <Suspense fallback={<VitrineCarregando />}>
      <Cidade params={props.params} />
    </Suspense>
  );
}

async function Cidade({ params }: Pick<PageProps<"/cidades/[cidade]">, "params">) {
  const cidade = await cidadeDoSlug((await params).cidade);
  if (!cidade) notFound();
  const { onde, titulo, descricao, migalhas } = textos(cidade);
  const [resultado, cidades] = await Promise.all([buscarDiretorio({ ...SEM_FILTROS, onde }), listarCidades()]);
  const estado = NOMES_UF[cidade.uf as Uf];
  const foto = fotoDaCidade(cidade.cidade, cidade.uf);
  const vizinhas = cidades
    .filter((c) => c.uf === cidade.uf && slugCidade(c.cidade, c.uf) !== slugCidade(cidade.cidade, cidade.uf))
    .sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, "pt-BR"));

  return (
    <Vitrine
      migalhas={migalhas}
      rotulo={estado}
      titulo={titulo}
      introducao={
        <p>
          Negócios de {cidade.cidade} que cuidam das pessoas, da comunidade e do planeta, indicados por quem é cliente. Escolha pelo
          tipo de negócio ou pelas causas que importam para você.
        </p>
      }
      capa={foto && <CapaDaCidade foto={foto} />}
      total={resultado.total}
      itens={resultado.itens}
      hrefNoDiretorio={hrefDiretorio({ onde })}
      jsonLd={jsonLdDaVitrine({
        titulo,
        descricao,
        migalhas,
        negocios: resultado.itens,
        sobre: { "@type": "City", name: cidade.cidade, containedInPlace: { "@type": "State", name: estado } },
        foto,
      })}
    >
      <Atalhos
        titulo={`Tipos de negócio em ${cidade.cidade}`}
        itens={CATEGORIAS.filter((tipo) => resultado.porCategoria[tipo]).map((tipo) => ({
          chave: tipo,
          rotulo: tipo,
          total: resultado.porCategoria[tipo],
          href: hrefDiretorio({ onde, tipos: [tipo] }),
        }))}
      />
      <Atalhos
        titulo={`Causas em ${cidade.cidade}`}
        itens={CAUSAS.filter((causa) => resultado.porCausa[causa.slug]).map((causa) => ({
          chave: causa.slug,
          rotulo: `${causa.emoji} ${causa.nome}`,
          total: resultado.porCausa[causa.slug],
          href: hrefDiretorio({ onde, causas: [causa.slug] }),
        }))}
      />
      <Atalhos
        titulo={`Outras cidades em ${estado}`}
        itens={vizinhas.map((c) => ({ chave: c.cidade, rotulo: c.cidade, total: c.total, href: hrefCidade(c.cidade, c.uf) }))}
      />
    </Vitrine>
  );
}
