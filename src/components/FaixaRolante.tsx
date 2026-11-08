"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Uma faixa de itens que passa sozinha, num loop lento (a dos embaixadores, na
 * página inicial). Os itens vão duas vezes: quando a primeira volta sai pela
 * esquerda, a cópia está no mesmo lugar e a animação recomeça sem salto. A cópia
 * fica fora do leitor de tela e do Tab.
 *
 * Só anda quando os itens não cabem na largura; cabendo, eles ficam parados e no
 * centro. Para com o mouse em cima, com o foco do teclado e com o botão "Pausar",
 * e fica parada para quem pede menos movimento no aparelho. Sem JavaScript, é uma
 * lista que rola para o lado.
 */
export function FaixaRolante({ itens, segundosPorItem = 5, className = "" }: { itens: ReactNode[]; segundosPorItem?: number; className?: string }) {
  const janela = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [rolando, setRolando] = useState(false);
  const [pausada, setPausada] = useState(false);

  useEffect(() => {
    const medir = () => {
      if (janela.current && lista.current) setRolando(lista.current.scrollWidth > janela.current.clientWidth);
    };
    medir();
    const observador = new ResizeObserver(medir);
    if (janela.current) observador.observe(janela.current);
    return () => observador.disconnect();
  }, []);

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div ref={janela} className={`faixa-janela py-2 ${rolando ? "faixa-mascara overflow-hidden motion-reduce:overflow-x-auto" : "overflow-x-auto"}`}>
        <div
          className={`flex w-max ${rolando ? "faixa-rolando" : "mx-auto"}`}
          style={{ "--duracao-da-faixa": `${itens.length * segundosPorItem}s` } as CSSProperties}
          data-pausada={pausada || undefined}
        >
          <ul ref={lista} className="flex gap-4 pr-4">
            {itens}
          </ul>
          {rolando && (
            <ul className="flex gap-4 pr-4 motion-reduce:hidden" aria-hidden="true" inert>
              {itens}
            </ul>
          )}
        </div>
      </div>
      {rolando && (
        <button
          type="button"
          onClick={() => setPausada(!pausada)}
          className="inline-flex min-h-11 items-center gap-2 self-end rounded-full border border-papel/25 px-4 text-[13px] font-semibold transition hover:border-papel/60 motion-reduce:hidden escuro:border-linha escuro:hover:border-tinta/40"
        >
          {pausada ? (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 5l12 7-12 7z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M9 5v14M15 5v14" />
            </svg>
          )}
          {pausada ? "Continuar" : "Pausar"}
        </button>
      )}
    </div>
  );
}
