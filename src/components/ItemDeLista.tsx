import Link from "next/link";
import type { ReactNode } from "react";

/** Linha de uma lista de atalhos das telas de celular (Negócio e Conta): ícone, texto e seta. */
export function ItemDeLista({
  href,
  icone,
  titulo,
  detalhe,
  externo,
}: {
  href: string;
  icone: ReactNode;
  titulo: string;
  detalhe?: string;
  externo?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-papel focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-coral"
      >
        <span className="text-coral-700" aria-hidden="true">
          {icone}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{titulo}</span>
          {detalhe && <span className="block text-sm text-suave">{detalhe}</span>}
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-suave" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </li>
  );
}

const TRACO = { viewBox: "0 0 24 24", className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ICONES_DE_LISTA = {
  cupom: (
    <svg {...TRACO}>
      <path d="M3 9V6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5V9a3 3 0 000 6v2.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5V15a3 3 0 000-6zM14 5.5v13" strokeDasharray="2 2.4" />
    </svg>
  ),
  lapis: (
    <svg {...TRACO}>
      <path d="M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19l-4 1z" />
    </svg>
  ),
  balao: (
    <svg {...TRACO}>
      <path d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v9a1.5 1.5 0 01-1.5 1.5H10l-5 4v-4h-.5A.5.5 0 014 15.5z" />
    </svg>
  ),
  link: (
    <svg {...TRACO}>
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </svg>
  ),
  loja: (
    <svg {...TRACO}>
      <path d="M4 9.5L5.5 4h13L20 9.5M4 9.5a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20" />
    </svg>
  ),
  coracao: (
    <svg {...TRACO}>
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.3a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z" />
    </svg>
  ),
  painel: (
    <svg {...TRACO}>
      <path d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" />
    </svg>
  ),
  escudo: (
    <svg {...TRACO}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    </svg>
  ),
  baixar: (
    <svg {...TRACO}>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />
    </svg>
  ),
  ajuda: (
    <svg {...TRACO}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.100-1.5 2M12 17h.01" />
    </svg>
  ),
  lua: (
    <svg {...TRACO}>
      <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
    </svg>
  ),
};
