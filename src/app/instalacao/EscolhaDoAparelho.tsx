"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { IconeAndroid, IconeApple } from "@/components/IconesDosAparelhos";
import { aparelhoDaVisita } from "@/lib/app";

const semMudancas = () => () => {};

const APARELHOS = [
  {
    id: "iphone",
    nome: "iPhone",
    detalhe: "iPhone e iPad, com o Safari",
    Icone: IconeApple,
    corDoIcone: "text-tinta",
  },
  {
    id: "android",
    nome: "Android",
    detalhe: "Samsung, Motorola, Xiaomi e outros, com o Chrome",
    Icone: IconeAndroid,
    corDoIcone: "text-[#3ddc84]",
  },
] as const;

/**
 * Os dois cartões de /instalacao. Cada um leva ao passo a passo do aparelho. Depois
 * de carregar, o cartão do aparelho de quem visita ganha o selo "Este celular".
 */
export function EscolhaDoAparelho() {
  const daVisita = useSyncExternalStore(semMudancas, aparelhoDaVisita, () => null);

  return (
    <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5">
      {APARELHOS.map(({ id, nome, detalhe, Icone, corDoIcone }) => (
        <Link
          key={id}
          href={`/instalacao/${id}`}
          data-medir="instalacao_aparelho"
          data-aparelho={id}
          className={`cartao relative flex flex-col items-center px-3 pt-8 pb-6 text-center transition hover:border-tinta/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral sm:px-6 sm:pt-10 ${
            daVisita === id ? "border-coral ring-2 ring-coral/20" : ""
          }`}
        >
          {daVisita === id && (
            <span className="absolute -top-3 rounded-full bg-coral px-3 py-1 text-xs font-semibold text-white">
              Este celular
            </span>
          )}
          <Icone className={`h-14 w-14 sm:h-16 sm:w-16 ${corDoIcone}`} />
          <span className="mt-4 font-serif text-2xl font-semibold sm:text-3xl">{nome}</span>
          <span className="mt-1 text-sm text-suave">{detalhe}</span>
          <span className="mt-4 text-sm font-semibold text-coral-700">Ver o passo a passo&nbsp;→</span>
        </Link>
      ))}
    </div>
  );
}
