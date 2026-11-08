import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { RostoDoEmbaixador } from "@/components/Embaixadores";
import { Atalhos, Vitrine, VitrineCarregando } from "@/components/Vitrine";
import { CAUSAS } from "@/lib/causas";
import { buscarDiretorio } from "@/lib/consultas";
import { hrefDiretorio, SEM_FILTROS } from "@/lib/diretorio";
import { CATEGORIAS, NOMES_UF, type Uf } from "@/lib/dominio";
import {
  atualizarSeguidoresDoDia,
  embaixadorDoEndereco,
  embaixadoresNoSite,
  ondeDoEmbaixador,
  tituloComLugar,
  type EmbaixadorNoSite,
} from "@/lib/embaixadores";
import { linkPerfil } from "@/lib/instagram";
import { jsonLdDaVitrine, metadadosDaPagina, type Migalha } from "@/lib/seo";

// A página de cada embaixador do bem (#259), com link próprio para divulgar no
// Instagram: quem é, o "Sobre" escrito pela moderação e, abaixo, os negócios da
// cidade ou do estado. Um @ que não é de embaixador no site mostra "Não
// encontramos esta página". A prévia do link vem do opengraph-image.tsx desta pasta.

function textos(embaixador: EmbaixadorNoSite) {
  const regiao = embaixador.cidade ? `${embaixador.cidade}, ${embaixador.uf}` : `o estado inteiro (${NOMES_UF[embaixador.uf as Uf]})`;
  return {
    regiao,
    titulo: `${embaixador.nome} · ${tituloComLugar(embaixador)}`,
    descricao: `${embaixador.nome} (@${embaixador.instagramUsername}) leva o Negócio do Bem para ${regiao}. Siga no Instagram e conheça os negócios do bem de lá, indicados por quem é cliente.`,
    migalhas: [
      { nome: "Início", caminho: "/" },
      { nome: "Embaixadores", caminho: "/embaixadores" },
      { nome: embaixador.nome, caminho: embaixador.href },
    ] satisfies Migalha[],
  };
}

export async function generateMetadata(props: PageProps<"/embaixadores/[usuario]">): Promise<Metadata> {
  const embaixador = await embaixadorDoEndereco((await props.params).usuario);
  if (!embaixador) notFound();
  const { titulo, descricao } = textos(embaixador);
  return metadadosDaPagina({ titulo, descricao, caminho: embaixador.href, imagemPropria: true });
}

export default function PaginaDoEmbaixador(props: PageProps<"/embaixadores/[usuario]">) {
  return (
    <Suspense fallback={<VitrineCarregando />}>
      <Embaixador params={props.params} />
    </Suspense>
  );
}

async function Embaixador({ params }: Pick<PageProps<"/embaixadores/[usuario]">, "params">) {
  // Na hora do pedido, nunca no build: o after abaixo não pode rodar na publicação.
  await connection();
  const embaixador = await embaixadorDoEndereco((await params).usuario);
  if (!embaixador) notFound();
  after(atualizarSeguidoresDoDia);

  const { regiao, titulo, descricao, migalhas } = textos(embaixador);
  const onde = ondeDoEmbaixador(embaixador);
  const [resultado, todos] = await Promise.all([buscarDiretorio({ ...SEM_FILTROS, onde }), embaixadoresNoSite()]);
  const naRegiao = embaixador.cidade ? `em ${embaixador.cidade}` : "no estado";

  return (
    <Vitrine
      migalhas={migalhas}
      rotulo={tituloComLugar(embaixador)}
      titulo={embaixador.nome}
      introducao={
        embaixador.sobre ? (
          <p className="whitespace-pre-line">{embaixador.sobre}</p>
        ) : (
          <p>
            {embaixador.nome} leva o Negócio do Bem para {regiao} e chama a comunidade para comprar de quem faz o bem. Abaixo, os
            negócios do bem de lá, indicados por quem é cliente.
          </p>
        )
      }
      capa={<Perfil embaixador={embaixador} />}
      tituloDaLista={embaixador.cidade ? `Negócios do bem em ${embaixador.cidade}, ${embaixador.uf}` : "Negócios do bem em todo o estado"}
      total={resultado.total}
      itens={resultado.itens}
      hrefNoDiretorio={hrefDiretorio({ onde })}
      jsonLd={jsonLdDaVitrine({
        titulo,
        descricao,
        migalhas,
        negocios: resultado.itens,
        sobre: { "@type": "Person", name: embaixador.nome, sameAs: [linkPerfil(embaixador.instagramUsername)] },
      })}
    >
      <Atalhos
        titulo={`Tipos de negócio ${naRegiao}`}
        itens={CATEGORIAS.filter((tipo) => resultado.porCategoria[tipo]).map((tipo) => ({
          chave: tipo,
          rotulo: tipo,
          total: resultado.porCategoria[tipo],
          href: hrefDiretorio({ onde, tipos: [tipo] }),
        }))}
      />
      <Atalhos
        titulo={`Causas ${naRegiao}`}
        itens={CAUSAS.filter((causa) => resultado.porCausa[causa.slug]).map((causa) => ({
          chave: causa.slug,
          rotulo: `${causa.emoji} ${causa.nome}`,
          total: resultado.porCausa[causa.slug],
          href: hrefDiretorio({ onde, causas: [causa.slug] }),
        }))}
      />
      <Atalhos
        titulo="Outros embaixadores do bem"
        itens={todos.filter((e) => e.id !== embaixador.id).map((e) => ({ chave: e.id, rotulo: e.nome, href: e.href }))}
      />
    </Vitrine>
  );
}

/** Ao lado do título (em cima, no celular): a foto, o @, os seguidores e o link do Instagram. */
function Perfil({ embaixador }: { embaixador: EmbaixadorNoSite }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-[2rem] bg-tinta px-6 py-9 text-center text-papel escuro:bg-superficie escuro:text-tinta escuro:ring-1 escuro:ring-linha">
      <RostoDoEmbaixador
        embaixador={embaixador}
        className="mb-4 h-40 w-40 text-5xl ring-[3px] ring-coral ring-offset-4 ring-offset-tinta escuro:ring-offset-superficie"
      />
      <p className="text-lg font-semibold break-all">@{embaixador.instagramUsername}</p>
      {embaixador.seguidores && (
        <p className="text-papel/75 escuro:text-suave">
          <strong className="font-serif text-3xl font-semibold text-papel escuro:text-tinta">{embaixador.seguidores}</strong> seguidores no
          Instagram
        </p>
      )}
      <a
        href={linkPerfil(embaixador.instagramUsername)}
        target="_blank"
        rel="noopener noreferrer"
        className="botao-coral mt-4 px-6 py-3 text-base"
      >
        Seguir no Instagram <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
