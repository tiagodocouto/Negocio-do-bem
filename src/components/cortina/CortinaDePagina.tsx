"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type TransitionEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { destinoDaCortina, proximaFaseCortina, type DestinoCortina, type EventoCortina, type FaseCortina } from "@/lib/cortina";
import "./cortina.css";

type Navegacao = DestinoCortina & { origem: string; enviada: boolean };

export function CortinaDePagina() {
  const caminho = usePathname();
  const router = useRouter();
  const roteador = useRef(router);
  const pendente = useRef<Navegacao | null>(null);
  const faseAtual = useRef<FaseCortina>("oculta");
  const seguranca = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const direita = useRef<HTMLDivElement>(null);
  const [fase, setFase] = useState<FaseCortina>("oculta");
  const [tinta, setTinta] = useState<DestinoCortina["tinta"]>("verde-escuro");

  useEffect(() => { roteador.current = router; }, [router]);

  const mudar = useCallback((evento: EventoCortina) => {
    const proxima = proximaFaseCortina(faseAtual.current, evento);
    faseAtual.current = proxima;
    setFase(proxima);
  }, []);

  const liberar = useCallback(() => {
    clearTimeout(seguranca.current);
    pendente.current = null;
    mudar("cancelar");
  }, [mudar]);

  useEffect(() => {
    const movimento = matchMedia("(prefers-reduced-motion: reduce)");

    function seguirSemCortina() {
      const navegacao = pendente.current;
      liberar();
      if (navegacao && !navegacao.enviada) roteador.current.push(navegacao.href);
    }

    function clicar(evento: MouseEvent) {
      if (movimento.matches || (window.__abertura && window.__abertura !== "aberta")) return;
      const alvo = evento.target instanceof Element ? evento.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!alvo) return;
      const destino = destinoDaCortina({
        atual: location.href,
        href: alvo.href,
        botao: evento.button,
        ctrl: evento.ctrlKey,
        meta: evento.metaKey,
        shift: evento.shiftKey,
        alt: evento.altKey,
        alvo: alvo.getAttribute("target"),
        download: alvo.hasAttribute("download"),
        prevenido: evento.defaultPrevented,
        desativado: alvo.hasAttribute("data-sem-cortina") || alvo.getAttribute("aria-disabled") === "true",
        teclado: evento.detail === 0,
        pausado: document.documentElement.dataset.movimento === "pausado",
      });
      if (!destino) return;
      evento.preventDefault();
      if (pendente.current) return;
      pendente.current = { ...destino, origem: location.pathname, enviada: false };
      setTinta(destino.tinta);
      mudar("iniciar");
      // Se o roteador ou um evento de transição falhar, a tela nunca prende a pessoa.
      seguranca.current = setTimeout(seguirSemCortina, 3200);
    }

    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") liberar();
    }
    function preferencia() {
      if (movimento.matches) seguirSemCortina();
    }

    document.addEventListener("click", clicar, true);
    document.addEventListener("keydown", tecla);
    window.addEventListener("popstate", liberar);
    window.addEventListener("pageshow", liberar);
    movimento.addEventListener("change", preferencia);
    return () => {
      document.removeEventListener("click", clicar, true);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("popstate", liberar);
      window.removeEventListener("pageshow", liberar);
      movimento.removeEventListener("change", preferencia);
      clearTimeout(seguranca.current);
      pendente.current = null;
    };
  }, [liberar, mudar]);

  useEffect(() => {
    const navegacao = pendente.current;
    if (!navegacao?.enviada || !caminho || caminho === navegacao.origem) return;
    const quadro = requestAnimationFrame(() => {
      if (pendente.current === navegacao) mudar("revelar");
    });
    return () => cancelAnimationFrame(quadro);
  }, [caminho, mudar]);

  function terminou(evento: TransitionEvent<HTMLDivElement>) {
    if (evento.target !== direita.current || evento.propertyName !== "transform") return;
    if (faseAtual.current === "fechando") {
      const navegacao = pendente.current;
      if (!navegacao) return;
      mudar("cobrir");
      navegacao.enviada = true;
      try {
        roteador.current.push(navegacao.href);
      } catch (erro) {
        liberar();
        throw erro;
      }
    } else if (faseAtual.current === "abrindo") {
      mudar("terminar");
      clearTimeout(seguranca.current);
      pendente.current = null;
    }
  }

  return (
    <div className="cortina-navegacao" data-fase={fase} aria-hidden="true" onTransitionEnd={terminou}
      style={{ "--cortina-tinta": `var(--color-${tinta}, #1f5a3c)` } as CSSProperties}>
      <div className="cortina-folha cortina-folha-esquerda" />
      <div className="cortina-folha cortina-folha-direita" ref={direita} />
    </div>
  );
}
