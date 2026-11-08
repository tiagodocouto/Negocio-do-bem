import type { ReactNode } from "react";

// Passo a passo numerado, usado nos tutoriais de /instalacao e em /clube-do-bem.

export function Passos({ children, className = "mt-10" }: { children: ReactNode; className?: string }) {
  return <ol className={`space-y-8 ${className}`}>{children}</ol>;
}

/** Um passo. `nivel` é o do título: h2 nos tutoriais, h3 quando a página já tem seções com h2. */
export function Passo({
  numero,
  titulo,
  nivel = "h2",
  children,
}: {
  numero: number;
  titulo: ReactNode;
  nivel?: "h2" | "h3";
  children: ReactNode;
}) {
  const Titulo = nivel;
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-4">
      <span
        aria-hidden="true"
        className="grid h-10 w-10 place-items-center rounded-full bg-coral font-serif text-xl font-semibold text-white"
      >
        {numero}
      </span>
      <div className="min-w-0 pt-1.5">
        <Titulo className="font-serif text-xl font-semibold">
          <span className="sr-only">Passo {numero}: </span>
          {titulo}
        </Titulo>
        <div className="mt-1.5 space-y-2 leading-relaxed text-suave">{children}</div>
      </div>
    </li>
  );
}
