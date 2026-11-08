import type { Metadata } from "next";
import Link from "next/link";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { CartaoEmbaixador } from "@/components/Embaixadores";
import { EMAIL_DO_PROJETO, NOMES_UF, UFS, type Uf } from "@/lib/dominio";
import { atualizarSeguidoresDoDia, embaixadoresNoSite, formatarSeguidores, type EmbaixadorNoSite } from "@/lib/embaixadores";
import { metadadosDaPagina } from "@/lib/seo";

// Todos os embaixadores do bem, com filtro por estado (?estado=BA) e o convite
// para quem quer ser um. O cadastro é da moderação (aba Embaixadores).
export const metadata: Metadata = metadadosDaPagina({
  titulo: "Embaixadores do bem",
  descricao:
    "Quem leva o Negócio do Bem para cada cidade e estado: siga os embaixadores no Instagram e conheça os negócios do bem de onde eles vivem.",
  caminho: "/embaixadores",
});

export default function Embaixadores(props: PageProps<"/embaixadores">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-6">
      <nav aria-label="Você está em" className="flex items-center gap-2 text-sm text-suave">
        <Link href="/" className="inline-flex items-center gap-1.5 font-semibold text-coral-700 hover:underline">
          <span aria-hidden="true">←</span> Início
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Embaixadores</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-stretch gap-7">
        <div className="flex min-w-0 flex-[999_1_30rem] flex-col justify-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Comunidade</p>
          <h1 className="mt-2 font-serif text-5xl leading-[1.02] font-semibold tracking-tight sm:text-6xl">
            Embaixadores do <span className="text-coral italic">bem</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-suave">
            Pessoas que levam o Negócio do Bem para as suas cidades: indicam negócios, contam as histórias deles e chamam a
            comunidade para comprar de quem faz o bem. Siga cada um no Instagram e veja os negócios de onde moram.
          </p>
        </div>
        <Suspense fallback={<div className="min-h-64 flex-[1_1_24rem] animate-pulse rounded-[2rem] bg-superficie" aria-busy="true" />}>
          <Alcance />
        </Suspense>
      </div>

      <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-3xl bg-superficie" aria-busy="true" />}>
        <Lista searchParams={props.searchParams} />
      </Suspense>

      <section className="mt-16 flex flex-col items-start justify-between gap-5 rounded-3xl bg-tinta px-8 py-10 text-papel sm:flex-row sm:items-center escuro:bg-superficie escuro:text-tinta escuro:ring-1 escuro:ring-linha">
        <div>
          <h2 className="font-serif text-3xl font-semibold">Quer ser embaixador do bem?</h2>
          <p className="mt-1 max-w-xl text-papel/70 escuro:text-suave">
            Se você fala da sua cidade nas redes e quer levar mais gente aos negócios de lá, escreva para a gente.
          </p>
        </div>
        <a href={`mailto:${EMAIL_DO_PROJETO}?subject=Quero ser embaixador do bem`} className="botao-coral shrink-0 px-6 py-3 text-base">
          Escrever para {EMAIL_DO_PROJETO}
        </a>
      </section>
    </div>
  );
}

/** O quadro escuro ao lado do título: os seguidores somados e onde os embaixadores estão. */
async function Alcance() {
  // Na hora do pedido, nunca no build: o after abaixo não pode rodar na publicação.
  await connection();
  after(atualizarSeguidoresDoDia);
  const embaixadores = await embaixadoresNoSite();
  if (embaixadores.length === 0) return null;
  const seguidores = embaixadores.reduce((soma, e) => soma + (e.numeroDeSeguidores ?? 0), 0);
  const cidades = new Set(embaixadores.filter((e) => e.cidade).map((e) => `${e.cidade}|${e.uf}`)).size;
  const estados = new Set(embaixadores.filter((e) => !e.cidade).map((e) => e.uf)).size;

  return (
    <div className="flex flex-[1_1_24rem] flex-col justify-between gap-7 rounded-[2rem] bg-tinta p-8 text-papel escuro:bg-superficie escuro:text-tinta escuro:ring-1 escuro:ring-linha">
      {seguidores > 0 ? (
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-papel/70 uppercase escuro:text-suave">Alcance somado</p>
          <p className="mt-2.5 font-serif text-7xl leading-[0.95] font-semibold tracking-tight text-coral escuro:text-coral-700">
            {formatarSeguidores(seguidores)}
          </p>
          <p className="mt-2.5 text-xl font-medium">seguidores no Instagram</p>
        </div>
      ) : (
        <p className="font-serif text-3xl font-semibold">Gente que espalha a palavra pelo Brasil</p>
      )}
      <dl className="flex flex-wrap gap-x-7 gap-y-3 border-t border-papel/15 pt-4 escuro:border-linha">
        <Numero valor={embaixadores.length} rotulo={embaixadores.length === 1 ? "embaixador" : "embaixadores"} />
        <Numero valor={cidades} rotulo={cidades === 1 ? "cidade" : "cidades"} />
        <Numero valor={estados} rotulo={estados === 1 ? "estado inteiro" : "estados inteiros"} />
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

/** O estado do filtro, só se for uma UF de verdade. */
function lerEstado(valor: string | string[] | undefined): Uf | null {
  const uf = (Array.isArray(valor) ? valor[0] : valor)?.toUpperCase();
  return (UFS as readonly string[]).includes(uf ?? "") ? (uf as Uf) : null;
}

async function Lista({ searchParams }: Pick<PageProps<"/embaixadores">, "searchParams">) {
  const [embaixadores, params] = await Promise.all([embaixadoresNoSite(), searchParams]);
  if (embaixadores.length === 0) {
    return (
      <div className="cartao mt-10 px-6 py-14 text-center">
        <p className="font-serif text-2xl">Os primeiros embaixadores chegam em breve.</p>
        <p className="mx-auto mt-2 max-w-md text-suave">Enquanto isso, indique os negócios do bem da sua cidade.</p>
        <Link href="/participar" className="botao-coral mt-6">
          Indicar um negócio
        </Link>
      </div>
    );
  }

  const porEstado = new Map<Uf, EmbaixadorNoSite[]>();
  for (const e of embaixadores) porEstado.set(e.uf as Uf, [...(porEstado.get(e.uf as Uf) ?? []), e]);
  const estados = [...porEstado.keys()].sort((a, b) => NOMES_UF[a].localeCompare(NOMES_UF[b], "pt-BR"));
  const escolhido = lerEstado(params.estado);
  const lista = escolhido ? (porEstado.get(escolhido) ?? []) : embaixadores;
  const opcoes = [
    { href: "/embaixadores", rotulo: "Todos", total: embaixadores.length, ativo: !escolhido },
    ...estados.map((uf) => ({ href: `/embaixadores?estado=${uf}`, rotulo: NOMES_UF[uf], total: porEstado.get(uf)!.length, ativo: escolhido === uf })),
  ];

  return (
    <>
      {estados.length > 1 && (
        <nav aria-label="Filtrar por estado" className="mt-10 flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              scroll={false}
              aria-current={o.ativo ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
                o.ativo ? "border-tinta bg-tinta text-papel" : "border-linha bg-superficie hover:border-tinta/40"
              }`}
            >
              {o.rotulo} <span className="text-xs tabular-nums opacity-70">{o.total}</span>
            </Link>
          ))}
        </nav>
      )}

      <p className="mt-7 border-b border-linha pb-3.5 text-suave">
        <strong className="font-serif text-2xl font-semibold text-tinta">{lista.length}</strong>{" "}
        {lista.length === 1 ? "embaixador" : "embaixadores"}
        {escolhido ? ` · ${NOMES_UF[escolhido]}` : " em todo o Brasil"}
      </p>

      {lista.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((e) => (
            <CartaoEmbaixador key={e.id} embaixador={e} />
          ))}
        </div>
      ) : (
        <p className="cartao mt-5 p-8 text-center text-suave">Ainda não há embaixadores neste estado.</p>
      )}
    </>
  );
}
