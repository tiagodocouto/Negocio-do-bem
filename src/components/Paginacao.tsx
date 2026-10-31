import Link from "next/link";

/** Números da paginação: todos até 7 páginas; depois, a primeira, a última e as vizinhas da atual. */
export function paginasVisiveis(atual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const perto = [1, atual - 1, atual, atual + 1, total].filter((p) => p >= 1 && p <= total);
  const unicas = [...new Set(perto)].sort((a, b) => a - b);
  return unicas.flatMap((p, i) => (i > 0 && p - unicas[i - 1]! > 1 ? [null, p] : [p]));
}

/** Links das páginas de uma lista. Some quando há uma página só. */
export function Paginacao({ atual, total, href }: { atual: number; total: number; href: (pagina: number) => string }) {
  if (total <= 1) return null;
  return (
    <nav aria-label="Paginação" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {paginasVisiveis(Math.min(atual, total), total).map((pagina, i) =>
        pagina === null ? (
          <span key={`intervalo-${i}`} className="px-1 text-suave" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={pagina}
            href={href(pagina)}
            aria-current={pagina === atual ? "page" : undefined}
            className={`grid h-10 min-w-10 place-items-center rounded-full border px-3 text-sm font-semibold transition ${
              pagina === atual ? "border-tinta bg-tinta text-papel" : "border-linha bg-superficie hover:border-tinta/40"
            }`}
          >
            {pagina}
          </Link>
        ),
      )}
    </nav>
  );
}
