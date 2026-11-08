"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (public/sw.js). Só em produção: em desenvolvimento
 * ele guardaria arquivos que mudam a cada edição.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sem service worker, o site funciona igual; só não mostra a página "sem conexão".
    });
  }, []);

  return null;
}
