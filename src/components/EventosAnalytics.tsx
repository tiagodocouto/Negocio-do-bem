"use client";

import { useEffect } from "react";
import { abertoComoApp } from "@/lib/app";
import { COOKIE_EVENTOS, enviarEvento, lerEventos } from "@/lib/medicao";

// Os eventos do servidor chegam no cookie depois de um redirecionamento: uma página nova,
// só um `?aviso=` na mesma página ou a volta do Google. Seguir a URL pediria `usePathname` e
// `useSearchParams` dentro de um Suspense, e nas páginas com parâmetro dinâmico (o perfil do
// negócio) esse Suspense nunca se resolvia. Conferir o cookie a cada segundo é uma leitura de
// texto, vale para todos os casos e também espera o script do Analytics, que carrega depois.
const INTERVALO_MS = 1000;

function lerCookie(nome: string): string | undefined {
  const par = document.cookie.split("; ").find((item) => item.startsWith(`${nome}=`));
  return par === undefined ? undefined : decodeURIComponent(par.slice(nome.length + 1));
}

/**
 * Manda ao Google Analytics os eventos que o servidor deixou no cookie (`medir`), os
 * cliques em elementos com `data-medir` e a abertura pelo app instalado (`app_aberto`).
 */
export function EventosAnalytics() {
  useEffect(() => {
    function enviarPendentes() {
      if (!window.gtag) return;
      const valor = lerCookie(COOKIE_EVENTOS);
      if (!valor) return;
      // Apaga antes de mandar: a próxima conferência não repete os eventos.
      document.cookie = `${COOKIE_EVENTOS}=; Max-Age=0; Path=/; SameSite=Lax`;
      for (const { nome, params } of lerEventos(valor)) enviarEvento(nome, params);
    }
    enviarPendentes();
    const intervalo = setInterval(enviarPendentes, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      const alvo = evento.target instanceof Element ? evento.target.closest<HTMLElement>("[data-medir]") : null;
      const { medir: nome, ...params } = alvo?.dataset ?? {};
      if (nome) enviarEvento(nome, params);
    }
    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, []);

  useEffect(() => {
    // O site aberto pelo ícone do app instalado. O layout não recarrega entre as páginas,
    // então conta uma vez por abertura. Espera o script do Analytics carregar.
    if (!abertoComoApp()) return;
    const intervalo = setInterval(() => {
      if (!window.gtag) return;
      clearInterval(intervalo);
      enviarEvento("app_aberto", {});
    }, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, []);

  return null;
}
