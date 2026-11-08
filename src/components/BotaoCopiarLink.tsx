"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Copia o endereço de uma página do site (`caminho`, como "/empresas/cafe") e avisa que copiou. */
export function BotaoCopiarLink({ caminho, className, children }: { caminho: string; className?: string; children: ReactNode }) {
  const [aviso, setAviso] = useState("");
  const relogio = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(relogio.current), []);

  async function copiar() {
    let texto = "Link copiado";
    try {
      await navigator.clipboard.writeText(new URL(caminho, window.location.origin).toString());
    } catch {
      texto = "Não deu para copiar. Use o endereço da barra do navegador.";
    }
    setAviso(texto);
    clearTimeout(relogio.current);
    relogio.current = setTimeout(() => setAviso(""), 3000);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={copiar} className={className}>
        {children}
      </button>
      <span role="status" className="text-xs text-suave empty:hidden">
        {aviso}
      </span>
    </span>
  );
}
