import "../paginas-internas.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/components/Editorial";
import { BuscaDiretorio } from "@/components/BuscaDiretorio";
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
    <div className="pagina-cidades container-editorial pagina-operacional">
      <nav aria-label="Você está em" className="flex items-center gap-2 text-sm text-suave">
        <Link href="/" className="inline-flex items-center gap-1.5 font-semibold text-coral-700 hover:underline">
          <span aria-hidden="true">←</span> Início
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Cidades</span>
      </nav>
      <CabecalhoPagina titulo="O bem também acontece na sua cidade." descricao="Escolha uma cidade para conhecer os negócios que já estão no diretório. Não achou a sua? Indique um negócio de lá.">
        <Link href="/indicar" className="botao-claro">Indicar um negócio <span aria-hidden="true">↗</span></Link>
      </CabecalhoPagina>
      <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-3xl bg-superficie" aria-busy="true" />}>
        <PorEstado />
      </Suspense>
    </div>
  );
}

async function PorEstado() {
  const cidades = await listarCidades();
  const porUf = new Map<string, CidadeComNegocios[]>();
  for (const cidade of cidades) porUf.set(cidade.uf, [...(porUf.get(cidade.uf) ?? []), cidade]);
  const estados = [...porUf.keys()].sort((a, b) => NOMES_UF[a as Uf].localeCompare(NOMES_UF[b as Uf], "pt-BR"));

  if (estados.length === 0) {
    return (
      <div className="cartao mt-10 px-6 py-14 text-center">
        <p className="font-serif text-2xl">Ainda não há negócios no diretório.</p>
        <Link href="/indicar" className="botao-coral mt-6">
          Indicar um negócio
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className="cidades-busca"><BuscaDiretorio cidades={cidades} /></div>
      <div className="cidades-orientacao">
        <p><strong>{cidades.length.toLocaleString("pt-BR")}</strong> {cidades.length === 1 ? "cidade" : "cidades"} em <strong>{estados.length}</strong> {estados.length === 1 ? "estado" : "estados"}</p>
        <span>Escolha um estado para ir direto à lista.</span>
      </div>
      <nav className="cidades-estados" aria-label="Estados com negócios no diretório">
        {estados.map(uf => <a key={uf} href={`#estado-${uf.toLowerCase()}`}>{NOMES_UF[uf as Uf]} <span>{uf}</span></a>)}
      </nav>
    <div className="cidades-grade">
      {estados.map((uf) => (
        <section id={`estado-${uf.toLowerCase()}`} key={uf} className="cidade-estado cartao">
          <header><h2>{NOMES_UF[uf as Uf]}</h2><span>{uf}</span></header>
          <ul className="mt-3 flex flex-col gap-1">
            {porUf.get(uf)!.map((cidade) => (
              <li key={cidade.cidade}>
                <Link
                  href={hrefCidade(cidade.cidade, cidade.uf)}
                  className="cidade-destino"
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
    </>
  );
}
