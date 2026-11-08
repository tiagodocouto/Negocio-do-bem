import Link from "next/link";

/** As duas partes da aba Cupons: as ofertas de todos os negócios e os cupons da própria pessoa. */
export function AbasCupons({ ativa, ofertas, meus }: { ativa: "ofertas" | "meus"; ofertas?: number; meus?: number }) {
  const abas = [
    { id: "ofertas", href: "/cupons", texto: "Ofertas", numero: ofertas },
    { id: "meus", href: "/cupons/meus", texto: "Meus cupons", numero: meus },
  ] as const;
  return (
    <nav aria-label="Cupons" className="grid grid-cols-2 rounded-full bg-linha/70 p-1 text-sm font-semibold">
      {abas.map((aba) => (
        <Link
          key={aba.id}
          href={aba.href}
          aria-current={ativa === aba.id ? "page" : undefined}
          className={`rounded-full py-2 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
            ativa === aba.id ? "bg-superficie text-tinta shadow-sm" : "text-suave hover:text-tinta"
          }`}
        >
          {aba.texto}
          {aba.numero ? <span className="ml-1.5 text-coral-700">{aba.numero}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
