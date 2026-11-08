"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { PerfilDaBarra } from "@/lib/navegacao";

// Barra de navegação do celular (some a partir de sm:). Quem instala o app não tem a
// barra do navegador, então o menu fica sempre à mão, no rodapé, ao alcance do polegar.

const TRACO = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden="true" {...TRACO}>
      {children}
    </svg>
  );
}

const ICONES = {
  inicio: <path d="M3 11l9-7.5L21 11M5.5 9.5V20h13V9.5M10 20v-6h4v6" />,
  explorar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  cupons: <path d="M3 9V6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5V9a3 3 0 000 6v2.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5V15a3 3 0 000-6zM14 5.5v13" strokeDasharray="2 2.4" />,
  favoritos: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.3a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z" />,
  conta: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c.8-4 3.7-6 7.5-6s6.7 2 7.5 6" />
    </>
  ),
  validar: <path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M4 12h16" />,
  negocio: <path d="M4 9.5L5.5 4h13L20 9.5M4 9.5a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20" />,
};

type Aba = {
  rotulo: string;
  href: string;
  icone: keyof typeof ICONES;
  /** Os caminhos em que a aba aparece marcada. */
  rotas: string[];
  numero?: number;
  centro?: boolean;
};

const COMECA_COM = (caminho: string, rotas: string[]) => rotas.some((rota) => (rota === "/" ? caminho === "/" : caminho === rota || caminho.startsWith(`${rota}/`)));

export function BarraInferior({ perfil }: { perfil: PerfilDaBarra }) {
  const caminho = usePathname();
  const cupons: Aba = { rotulo: "Cupons", href: "/cupons", icone: "cupons", rotas: ["/cupons", "/clube-do-bem"], numero: perfil.ofertas };
  const inicio: Aba = { rotulo: "Início", href: "/", icone: "inicio", rotas: ["/"] };
  const conta: Aba = { rotulo: "Conta", href: "/conta", icone: "conta", rotas: ["/conta", "/entrar", "/painel", "/instalacao"] };
  const abas: Aba[] =
    perfil.tipo === "dono"
      ? [
          inicio,
          cupons,
          { rotulo: "Validar", href: "/validar", icone: "validar", rotas: ["/validar"], centro: true },
          { rotulo: "Negócio", href: perfil.negocio, icone: "negocio", rotas: ["/negocio"] },
          conta,
        ]
      : [
          inicio,
          { rotulo: "Explorar", href: "/explorar", icone: "explorar", rotas: ["/explorar", "/empresas", "/cidades", "/causas", "/tipos"] },
          cupons,
          { rotulo: "Favoritos", href: "/favoritos", icone: "favoritos", rotas: ["/favoritos"] },
          conta,
        ];

  return (
    <nav
      aria-label="Menu principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-linha bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end px-1 pt-1.5 pb-1.5">
        {abas.map((aba) => {
          const ativa = COMECA_COM(caminho, aba.rotas);
          return (
            <li key={aba.rotulo} className="flex justify-center">
              <Link
                href={aba.href}
                aria-current={ativa ? "page" : undefined}
                className={`relative flex w-full min-w-0 flex-col items-center gap-0.5 py-1.5 text-[11px] leading-none font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-coral ${
                  aba.centro ? "-mt-6 font-bold text-coral-700" : ativa ? "font-bold text-coral-700" : "text-suave"
                }`}
              >
                {ativa && !aba.centro && <span aria-hidden="true" className="absolute -top-1.5 h-[3px] w-6 rounded-b-full bg-coral" />}
                {aba.centro ? (
                  <span className={`grid h-13 w-13 place-items-center rounded-full border-4 border-superficie bg-coral text-white shadow-lg shadow-coral/40 ${ativa ? "ring-2 ring-coral-700" : ""}`}>
                    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...TRACO}>
                      {ICONES[aba.icone]}
                    </svg>
                  </span>
                ) : (
                  <Icone>{ICONES[aba.icone]}</Icone>
                )}
                {aba.rotulo}
                {aba.numero ? (
                  <span className="absolute top-0 left-1/2 ml-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
                    <span className="sr-only">{aba.numero === 1 ? "1 oferta valendo" : `${aba.numero} ofertas valendo`}</span>
                    <span aria-hidden="true">{aba.numero > 99 ? "99+" : aba.numero}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
