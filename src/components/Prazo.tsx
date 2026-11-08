"use client";

import { useEffect, useState } from "react";
import { textoDoPrazo } from "@/lib/texto";

/** Quanto falta para a oferta acabar, atualizado a cada meio minuto. */
export function Prazo({ fim, className = "" }: { fim: string; className?: string }) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const relogio = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(relogio);
  }, []);
  // O servidor e o navegador podem estar um minuto distantes: o texto do navegador vale.
  return (
    <span className={className} suppressHydrationWarning>
      {textoDoPrazo(new Date(fim), agora)}
    </span>
  );
}
