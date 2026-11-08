import Link from "next/link";
import { paletaDe } from "@/components/Monograma";
import { tituloNaCidade, type EmbaixadorNoSite } from "@/lib/embaixadores";
import { ehFotoDoSite } from "@/lib/fotos";
import { iniciais } from "@/lib/texto";

// Peças dos embaixadores do bem: o rosto, o cartão de /embaixadores e o bloco da
// página da cidade. A faixa da página inicial fica em FaixaEmbaixadores.tsx, e a
// página de cada embaixador, em src/app/embaixadores/[usuario]. Os links do nome
// e do @ levam a essa página; o Instagram fica no botão "Seguir" de lá.

type Rosto = { nome: string; instagramUsername: string; fotoUrl: string | null };

/** A foto do embaixador; sem foto, as iniciais. O tamanho, a letra e o anel vêm do `className`. */
export function RostoDoEmbaixador({ embaixador, className }: { embaixador: Rosto; className: string }) {
  if (ehFotoDoSite(embaixador.fotoUrl)) {
    return (
      // As fotos já chegam reduzidas e quadradas (ver reduzirFoto.ts).
      // eslint-disable-next-line @next/next/no-img-element
      <img src={embaixador.fotoUrl} alt="" className={`shrink-0 rounded-full bg-superficie object-cover ${className}`} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-serif font-semibold ${paletaDe(embaixador.instagramUsername)} ${className}`}
    >
      {iniciais(embaixador.nome)}
    </span>
  );
}

export function IconeLugar({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

/** O cartão de /embaixadores: rosto, @, seguidores e o link para os negócios de onde a pessoa vive. */
export function CartaoEmbaixador({ embaixador }: { embaixador: EmbaixadorNoSite }) {
  return (
    <article className="cartao flex flex-col gap-4 p-5 sm:p-6">
      <Link href={embaixador.href} className="group flex items-center gap-4">
        <RostoDoEmbaixador embaixador={embaixador} className="h-16 w-16 text-xl ring-2 ring-coral ring-offset-[3px] ring-offset-superficie" />
        <div className="min-w-0">
          <h2 className="font-serif text-xl leading-tight font-semibold group-hover:text-coral-700">{embaixador.nome}</h2>
          <p className="mt-0.5 text-sm break-all text-suave">@{embaixador.instagramUsername}</p>
        </div>
      </Link>
      {embaixador.seguidores && (
        <p className="text-sm text-suave">
          <strong className="font-serif text-2xl font-semibold text-tinta">{embaixador.seguidores}</strong> seguidores no Instagram
        </p>
      )}
      <Link
        href={embaixador.destino.href}
        className="mt-auto flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-papel px-3.5 py-3 transition hover:bg-coral-50"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <IconeLugar className="h-5 w-5 shrink-0 text-coral-700" />
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold">{embaixador.lugar}</span>
            <span className="text-[13px] text-suave">{embaixador.destino.detalhe}</span>
          </span>
        </span>
        <span aria-hidden="true" className="font-semibold text-coral-700">
          →
        </span>
      </Link>
    </article>
  );
}

/** Na página da cidade, abaixo da introdução: quem divulga a cidade e quem cobre o estado inteiro. */
export function EmbaixadoresDaCidade({ embaixadores }: { embaixadores: EmbaixadorNoSite[] }) {
  const [principal, ...outros] = embaixadores;
  if (!principal) return null;
  return (
    <section aria-label="Embaixadores do bem" className="cartao border-coral-100 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <RostoDoEmbaixador embaixador={principal} className="h-15 w-15 text-xl ring-2 ring-coral ring-offset-[3px] ring-offset-superficie" />
        <div className="min-w-0 flex-[1_1_12rem]">
          <p className="text-xs font-semibold tracking-[0.12em] text-coral-700 uppercase">{tituloNaCidade(principal)}</p>
          <p className="mt-0.5 font-serif text-xl font-semibold">{principal.nome}</p>
          <p className="text-sm text-suave">
            @{principal.instagramUsername}
            {principal.seguidores && ` · ${principal.seguidores} seguidores`}
          </p>
        </div>
        <Link href={principal.href} className="botao-claro">
          Ver a página <span aria-hidden="true">→</span>
        </Link>
      </div>
      {outros.length > 0 && (
        <ul className="mt-4 space-y-2.5 border-t border-linha pt-4">
          {outros.map((e) => (
            <li key={e.id} className="flex items-center gap-2.5 text-sm text-suave">
              <RostoDoEmbaixador embaixador={e} className="h-8 w-8 text-xs" />
              <p>
                {tituloNaCidade(e)}:{" "}
                <Link href={e.href} className="font-semibold text-tinta hover:text-coral-700">
                  {e.nome}, @{e.instagramUsername}
                </Link>
                {e.seguidores && ` · ${e.seguidores} seguidores`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
