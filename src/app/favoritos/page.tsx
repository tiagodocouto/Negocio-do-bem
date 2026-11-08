import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmpresaCard } from "@/components/EmpresaCard";
import { Paginacao } from "@/components/Paginacao";
import { exigirUsuario } from "@/lib/auth/sessao";
import { buscarFavoritos, coracoesDaLista } from "@/lib/consultas";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Favoritos", robots: FORA_DA_BUSCA };

export default function Favoritos(props: PageProps<"/favoritos">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Favoritos</h1>
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const hrefPagina = (pagina: number) => (pagina > 1 ? `/favoritos?pagina=${pagina}` : "/favoritos");

async function Conteudo({ searchParams }: Pick<PageProps<"/favoritos">, "searchParams">) {
  const { pagina: paginaDaUrl } = await searchParams;
  const usuario = await exigirUsuario("/favoritos");
  const pedida = Number.parseInt(typeof paginaDaUrl === "string" ? paginaDaUrl : "1", 10);
  const { total, paginas, pagina, empresas } = await buscarFavoritos(usuario.id, Number.isFinite(pedida) && pedida > 0 ? pedida : 1);
  // O coração de cada card tira o negócio dos favoritos sem sair da página: o card fica,
  // com o coração vazio, e dá para favoritar de novo. Ele some da lista na próxima visita.
  const coracoes = await coracoesDaLista(usuario, empresas.map((empresa) => empresa.id), hrefPagina(pagina));

  return (
    <div className="mt-2 space-y-8">
      <p className="text-suave">
        {total === 0
          ? "Os negócios que você favoritar aparecem aqui. Só você vê esta lista."
          : `${total} ${total === 1 ? "negócio favorito" : "negócios favoritos"}. Só você vê esta lista.`}
      </p>

      {total === 0 ? (
        <div className="cartao p-8 text-center">
          <p className="font-serif text-2xl">Você ainda não tem favoritos</p>
          <p className="mx-auto mt-2 max-w-md text-suave">
            Toque no coração de um negócio, no diretório ou no perfil dele, para guardá-lo aqui.
          </p>
          <Link href="/explorar" className="botao-coral mt-6">
            Explorar o diretório
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {empresas.map((empresa) => (
              <EmpresaCard key={empresa.id} empresa={empresa} favorito={coracoes(empresa.id)} />
            ))}
          </div>
          <Paginacao atual={pagina} total={paginas} href={hrefPagina} />
        </>
      )}
    </div>
  );
}
