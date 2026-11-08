import Link from "next/link";
import type { ReactNode } from "react";

// Peças dos tutoriais de /instalacao/android e /instalacao/iphone.

export { Passo, Passos } from "@/components/Passos";

/** Cabeçalho do tutorial, com o link para voltar à escolha do aparelho. */
export function CabecaDoTutorial({ aparelho, titulo, children }: { aparelho: string; titulo: string; children: ReactNode }) {
  return (
    <>
      <Link href="/instalacao" className="text-sm font-medium text-suave hover:text-tinta">
        ← Trocar de celular
      </Link>
      <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">{aparelho}</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">{titulo}</h1>
      <p className="mt-3 text-lg leading-relaxed text-suave">{children}</p>
    </>
  );
}

/** Um botão do sistema desenhado no meio do texto, como o Compartilhar do Safari. */
function BotaoDoSistema({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <span
      role="img"
      aria-label={rotulo}
      className="mx-0.5 inline-grid h-7 w-7 place-items-center rounded-lg border border-linha bg-superficie align-middle text-sky-800"
    >
      {children}
    </span>
  );
}

export function IconeCompartilhar() {
  return (
    <BotaoDoSistema rotulo="Compartilhar">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12M8 7l4-4 4 4" />
        <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
      </svg>
    </BotaoDoSistema>
  );
}

export function IconeTresPontos({ deitado = false }: { deitado?: boolean }) {
  return (
    <BotaoDoSistema rotulo="Mais opções">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        {deitado ? (
          <>
            <circle cx="5" cy="12" r="2.2" />
            <circle cx="12" cy="12" r="2.2" />
            <circle cx="19" cy="12" r="2.2" />
          </>
        ) : (
          <>
            <circle cx="12" cy="5" r="2.2" />
            <circle cx="12" cy="12" r="2.2" />
            <circle cx="12" cy="19" r="2.2" />
          </>
        )}
      </svg>
    </BotaoDoSistema>
  );
}

export function IconeAdicionar() {
  return (
    <BotaoDoSistema rotulo="Adicionar à Tela de Início">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M12 8.5v7M8.5 12h7" />
      </svg>
    </BotaoDoSistema>
  );
}

/** O ícone que aparece na tela do celular depois de instalar. */
export function IconeDoApp() {
  return (
    <span className="mt-3 flex items-center gap-3 text-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icones/icone-192.png" alt="" className="h-12 w-12 rounded-xl" />
      É este o ícone do app.
    </span>
  );
}
