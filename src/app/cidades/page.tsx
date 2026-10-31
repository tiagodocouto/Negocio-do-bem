import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listarCidades } from "@/lib/consultas";
import { hrefCidade, type CidadeComNegocios } from "@/lib/diretorio";
import { NOMES_UF, type Uf } from "@/lib/dominio";
import { metadadosDaPagina } from "@/lib/seo";

// Todas as cidades com negócios no diretório, por estado: a porta de entrada das
// páginas de cidade para quem navega e para os robôs dos buscadores.
export const metadata: Metadata = metadadosDaPagina({
  titulo: "Negócios do bem por cidade",
  descricao: "Encontre negócios com consciência social e raízes na comunidade na sua cidade, em todos os estados do Brasil.",
  caminho: "/cidades",
});

export default function Cidades() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-6">
      <nav aria-label="Você está em" className="flex items-center gap-2 text-sm text-suave">
        <Link href="/" className="inline-flex items-center gap-1.5 font-semibold text-coral-700 hover:underline">
          <span aria-hidden="true">←</span> Início
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Cidades</span>
      </nav>
      <h1 className="mt-6 font-serif text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
        Negócios do bem por cidade
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-suave">
        As cidades que já têm negócios no diretório. Não achou a sua? Indique um negócio de lá.
      </p>
      <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-3xl bg-superficie" aria-busy="true" />}>
        <PorEstado />
      </Suspense>
    </div>
  );
}

async function PorEstado() {
  const porUf = new Map<string, CidadeComNegocios[]>();
  for (const cidade of await listarCidades()) porUf.set(cidade.uf, [...(porUf.get(cidade.uf) ?? []), cidade]);
  const estados = [...porUf.keys()].sort((a, b) => NOMES_UF[a as Uf].localeCompare(NOMES_UF[b as Uf], "pt-BR"));

  if (estados.length === 0) {
    return (
      <div className="cartao mt-10 px-6 py-14 text-center">
        <p className="font-serif text-2xl">Ainda não há negócios no diretório.</p>
        <Link href="/participar" className="botao-coral mt-6">
          Indicar um negócio
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {estados.map((uf) => (
        <section key={uf} className="cartao p-5">
          <h2 className="font-serif text-xl font-semibold">{NOMES_UF[uf as Uf]}</h2>
          <ul className="mt-3 flex flex-col gap-1">
            {porUf.get(uf)!.map((cidade) => (
              <li key={cidade.cidade}>
                <Link
                  href={hrefCidade(cidade.cidade, cidade.uf)}
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition hover:bg-papel"
                >
                  <span className="font-medium">{cidade.cidade}</span>
                  <span className="text-sm text-suave tabular-nums">
                    {cidade.total} {cidade.total === 1 ? "negócio" : "negócios"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
