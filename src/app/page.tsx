import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BuscaDiretorio } from "@/components/BuscaDiretorio";
import { Contador } from "@/components/Contador";
import { IconeCategoria } from "@/components/IconeCategoria";
import { JsonLd } from "@/components/JsonLd";
import { listarCidades, resumoDoDiretorio } from "@/lib/consultas";
import { hrefCidade, hrefDiretorio } from "@/lib/diretorio";
import { CATEGORIAS } from "@/lib/dominio";
import { DESCRICAO_DO_SITE, jsonLdDoSite, metadadosDaPagina } from "@/lib/seo";

export const metadata: Metadata = metadadosDaPagina({ descricao: DESCRICAO_DO_SITE, caminho: "/" });

const CIDADES_NA_INICIAL = 12;

// Atalhos de "Experimente:": levam direto para o diretório já filtrado.
const ATALHOS = [
  { rotulo: "Café e padaria", href: hrefDiretorio({ tipos: ["Café e padaria"] }) },
  { rotulo: "Liderado por mulheres", href: hrefDiretorio({ causas: ["liderado-por-mulheres"] }) },
  { rotulo: "Opções veganas", href: hrefDiretorio({ causas: ["opcoes-veganas"] }) },
  { rotulo: "Afroempreendedor", href: hrefDiretorio({ causas: ["afroempreendedor"] }) },
  { rotulo: "Pet friendly", href: hrefDiretorio({ causas: ["pet-friendly"] }) },
];

export default function Inicio() {
  return (
    <>
      <JsonLd dados={jsonLdDoSite()} />
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div className="flex flex-wrap items-stretch gap-7">
          <div className="flex min-w-0 flex-[999_1_32rem] flex-col justify-center">
            <p className="inline-flex items-center gap-2 self-start rounded-full border border-coral/20 bg-superficie/70 px-4 py-1.5 text-sm font-medium text-coral-700">
              <span aria-hidden="true">🌱</span>
              <span>
                Um movimento do bem<span className="hidden sm:inline">, feito pela comunidade</span>
              </span>
            </p>
            <h1 className="mt-5 font-serif text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-7xl">
              Compre de quem <span className="text-coral italic">faz o bem.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-suave text-balance sm:text-xl">
              Negócios com consciência social e raízes na comunidade. Busque pelo que você precisa e pela sua cidade,
              ou comece por um tipo de negócio.
            </p>
          </div>
          <Suspense fallback={<NumerosCarregando />}>
            <Numeros />
          </Suspense>
        </div>

        <div className="mt-8">
          <Suspense fallback={<BuscaDiretorio cidades={[]} />}>
            <BuscaComCidades />
          </Suspense>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-suave">Experimente:</span>
          {ATALHOS.map((atalho) => (
            <Link
              key={atalho.rotulo}
              href={atalho.href}
              className="rounded-full border border-linha bg-superficie px-3.5 py-1.5 text-sm font-medium transition hover:border-tinta/40"
            >
              {atalho.rotulo}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Explore por tipo de negócio</h2>
          <Link href="/explorar" className="inline-flex items-center gap-1.5 font-semibold text-coral-700 hover:underline">
            Ver todos os negócios <span aria-hidden="true">→</span>
          </Link>
        </div>
        <Suspense fallback={<TiposCarregando />}>
          <TiposDeNegocio />
        </Suspense>
      </section>

      <Suspense>
        <CidadesComMaisNegocios />
      </Suspense>

      <ComoFunciona />
    </>
  );
}

async function Numeros() {
  const resumo = await resumoDoDiretorio();
  return (
    <div className="flex flex-[1_1_20rem] flex-col justify-between gap-7 rounded-[2rem] bg-tinta p-8 text-papel escuro:bg-superficie escuro:text-tinta escuro:ring-1 escuro:ring-linha">
      <div>
        <p className="text-xs font-semibold tracking-[0.08em] text-papel/70 uppercase escuro:text-suave">Já no diretório</p>
        <p className="mt-2.5 font-serif text-8xl leading-[0.92] font-semibold tracking-tight text-coral escuro:text-coral-700">
          <Contador valor={resumo.total} />
        </p>
        <p className="mt-2.5 text-xl font-medium">
          {resumo.total === 1 ? "negócio do bem cadastrado" : "negócios do bem cadastrados"}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-3 border-t border-papel/15 pt-4 escuro:border-linha">
        <Numero valor={resumo.cidades} rotulo={resumo.cidades === 1 ? "cidade" : "cidades"} />
        <Numero valor={resumo.estados} rotulo={resumo.estados === 1 ? "estado" : "estados"} />
        <Numero valor={resumo.verificados} rotulo="verificados pelo dono" />
      </dl>
    </div>
  );
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-0.5 text-sm text-papel/70 escuro:text-suave">{rotulo}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{valor.toLocaleString("pt-BR")}</dd>
    </div>
  );
}

function NumerosCarregando() {
  return <div className="min-h-72 flex-[1_1_20rem] animate-pulse rounded-[2rem] bg-superficie" aria-busy="true" />;
}

async function BuscaComCidades() {
  return <BuscaDiretorio cidades={await listarCidades()} />;
}

async function TiposDeNegocio() {
  const { porCategoria } = await resumoDoDiretorio();
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {CATEGORIAS.map((categoria) => {
        const total = porCategoria[categoria] ?? 0;
        return (
          <Link
            key={categoria}
            href={hrefDiretorio({ tipos: [categoria] })}
            className={`group cartao flex min-h-32 flex-col items-start gap-4 p-4 transition hover:-translate-y-0.5 hover:border-coral sm:p-5 ${total === 0 ? "opacity-60" : ""}`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-coral-50 text-coral-700">
              <IconeCategoria categoria={categoria} className="h-[22px] w-[22px]" />
            </span>
            <span>
              <span className="block leading-tight font-semibold group-hover:text-coral-700">{categoria}</span>
              <span className="mt-0.5 block text-sm text-suave">
                {total === 0 ? "nenhum ainda" : `${total} ${total === 1 ? "negócio" : "negócios"}`}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** As cidades com mais negócios, cada uma com a sua página. */
async function CidadesComMaisNegocios() {
  const cidades = [...(await listarCidades())].sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, "pt-BR"));
  if (cidades.length === 0) return null;
  return (
    <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Explore por cidade</h2>
        <Link href="/cidades" className="inline-flex items-center gap-1.5 font-semibold text-coral-700 hover:underline">
          Ver todas as cidades <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {cidades.slice(0, CIDADES_NA_INICIAL).map((cidade) => (
          <Link
            key={`${cidade.cidade}-${cidade.uf}`}
            href={hrefCidade(cidade.cidade, cidade.uf)}
            className="inline-flex items-center gap-2 rounded-full border border-linha bg-superficie px-4 py-2 font-medium transition hover:border-tinta/40"
          >
            {cidade.cidade}, {cidade.uf}
            <span className="text-sm text-suave tabular-nums">{cidade.total}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TiposCarregando() {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
      {CATEGORIAS.map((categoria) => (
        <div key={categoria} className="h-32 animate-pulse rounded-3xl bg-superficie" />
      ))}
    </div>
  );
}

function ComoFunciona() {
  const passos = [
    {
      emoji: "💌",
      titulo: "A comunidade indica",
      texto: "Qualquer pessoa pode indicar um negócio pelo @ do Instagram e contar por que ele faz o bem.",
    },
    {
      emoji: "🔑",
      titulo: "O dono assume o perfil",
      texto: "Quem cuida do negócio envia CNPJ, site e contato e já passa a contar a própria história no perfil.",
    },
    {
      emoji: "🤝",
      titulo: "Todo mundo fortalece",
      texto: "Clientes deixam depoimentos, escolhem pelas causas que importam e espalham a palavra.",
    },
  ];
  return (
    <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Como funciona</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {passos.map((passo, i) => (
          <div key={passo.titulo} className="cartao p-7">
            <span className="text-3xl" aria-hidden="true">
              {passo.emoji}
            </span>
            <p className="mt-4 text-xs font-semibold tracking-wide text-coral-700 uppercase">Passo {i + 1}</p>
            <h3 className="mt-1 font-serif text-2xl font-semibold">{passo.titulo}</h3>
            <p className="mt-2 leading-relaxed text-suave">{passo.texto}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-3xl bg-tinta px-8 py-10 text-papel sm:flex-row">
        <div>
          <p className="font-serif text-3xl font-semibold">Tem um negócio do bem?</p>
          <p className="mt-1 text-papel/70">Cadastre, mostre as causas que você abraça e conte a sua história.</p>
        </div>
        <Link href="/sobre#dono" className="botao-coral shrink-0 px-6 py-3 text-base">
          Sou dono de um negócio
        </Link>
      </div>
    </section>
  );
}
