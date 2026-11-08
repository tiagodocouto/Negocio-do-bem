import Link from "next/link";
import { after, connection } from "next/server";
import { IconeLugar, RostoDoEmbaixador } from "@/components/Embaixadores";
import { FaixaRolante } from "@/components/FaixaRolante";
import { NOMES_UF, type Uf } from "@/lib/dominio";
import { atualizarSeguidoresDoDia, embaixadoresNoSite, type EmbaixadorNoSite } from "@/lib/embaixadores";

/**
 * A faixa escura da página inicial, com os rostos dos embaixadores marcados para
 * ela passando sozinhos. Sem nenhum marcado, não aparece. Depois de responder,
 * atualiza os seguidores de quem não foi consultado no dia (src/lib/embaixadores.ts).
 */
export async function FaixaEmbaixadores() {
  // Na hora do pedido, nunca no build: o after abaixo não pode rodar na publicação.
  await connection();
  after(atualizarSeguidoresDoDia);
  const todos = await embaixadoresNoSite();
  const naFaixa = todos.filter((e) => e.naInicial);
  if (naFaixa.length === 0) return null;

  return (
    <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-10 gap-y-6 rounded-[2rem] bg-tinta p-7 text-papel sm:p-10 escuro:bg-superficie escuro:text-tinta escuro:ring-1 escuro:ring-linha">
        <div className="min-w-0 flex-[1_1_16rem]">
          <p className="text-xs font-semibold tracking-[0.08em] text-coral-100 uppercase escuro:text-coral-700">Quem espalha a palavra</p>
          <h2 className="mt-2.5 font-serif text-4xl leading-[1.05] font-semibold tracking-tight">
            Embaixadores do <span className="text-coral italic escuro:text-coral-700">bem</span>
          </h2>
          <p className="mt-3 leading-relaxed text-papel/75 escuro:text-suave">
            Siga quem leva o Negócio do Bem para a própria cidade, e veja os negócios de lá.
          </p>
          <Link href="/embaixadores" className="botao-coral mt-5 px-5 py-3 text-[15px]">
            {todos.length === 1 ? "Ver os embaixadores" : `Conhecer todos os ${todos.length}`} <span aria-hidden="true">→</span>
          </Link>
        </div>
        <FaixaRolante className="min-w-0 flex-[999_1_32rem]" itens={naFaixa.map((e) => <Rosto key={e.id} embaixador={e} />)} />
      </div>
    </section>
  );
}

function Rosto({ embaixador }: { embaixador: EmbaixadorNoSite }) {
  const semNegocios = embaixador.destino.href === "/participar";
  return (
    <li className="flex w-40 shrink-0 flex-col items-center gap-1 text-center">
      <Link href={embaixador.href} className="group flex max-w-full flex-col items-center" title={`A página de ${embaixador.nome}`}>
        <RostoDoEmbaixador
          embaixador={embaixador}
          className="mb-3.5 h-21 w-21 text-[1.75rem] ring-2 ring-coral ring-offset-[3px] ring-offset-tinta transition group-hover:ring-4 escuro:ring-offset-superficie"
        />
        <span className="max-w-full truncate text-sm font-semibold group-hover:underline">@{embaixador.instagramUsername}</span>
      </Link>
      {embaixador.seguidores && <span className="text-[13px] text-papel/70 escuro:text-suave">{embaixador.seguidores} seguidores</span>}
      <Link
        href={embaixador.destino.href}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-papel/20 px-2.5 text-[13px] font-medium transition hover:border-papel/55 escuro:border-linha escuro:hover:border-tinta/40"
      >
        <IconeLugar className="h-3.5 w-3.5 shrink-0 text-coral-100 escuro:text-coral-700" />
        <span className="sr-only">{semNegocios ? "Indicar um negócio em " : "Negócios em "}</span>
        <span className="truncate">{embaixador.cidade ?? `${NOMES_UF[embaixador.uf as Uf] ?? embaixador.uf} (estado)`}</span>
      </Link>
    </li>
  );
}
