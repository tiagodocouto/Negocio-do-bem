"use client";

import { useRouter } from "next/navigation";
import { ORDENS, type Ordem } from "@/lib/diretorio";

/** Seletor de ordenação: cada opção já vem com o link do diretório reordenado. */
export function OrdenarPor({ atual, links }: { atual: Ordem; links: Record<Ordem, string> }) {
  const router = useRouter();
  return (
    // No celular, a opção já diz a ordem ("Verificados primeiro") e o rótulo some,
    // para o seletor caber na linha ao lado da grade/lista com a letra de 16px.
    <label className="inline-flex items-center gap-2 text-sm text-suave">
      <span className="max-sm:sr-only">Ordenar</span>
      <select
        value={atual}
        onChange={(evento) => router.push(links[evento.target.value as Ordem], { scroll: false })}
        className="rounded-full border border-linha bg-superficie py-2 pr-8 pl-3 text-base font-medium text-tinta sm:text-sm"
      >
        {(Object.keys(ORDENS) as Ordem[]).map((ordem) => (
          <option key={ordem} value={ordem}>
            {ORDENS[ordem]}
          </option>
        ))}
      </select>
    </label>
  );
}
