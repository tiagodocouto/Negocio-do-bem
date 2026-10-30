"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { ControleMovimento } from "./cortejo/ControleMovimento";
import { AlternarTema } from "./AlternarTema";

export function MenuMobile({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const painel = useId();
  useEffect(() => {
    function fechar(devolverFoco = false) {
      if (!menu.current?.open) return;
      menu.current.open = false;
      if (devolverFoco) menu.current.querySelector("summary")?.focus({ preventScroll: true });
    }
    function fora(event: PointerEvent) {
      if (menu.current && event.target instanceof Node && !menu.current.contains(event.target)) fechar(menu.current.contains(document.activeElement));
    }
    function tecla(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) { event.preventDefault(); fechar(true); }
    }
    function foco(event: FocusEvent) { if (event.target instanceof Node && !menu.current?.contains(event.target)) fechar(); }
    function historico() { fechar(); }
    const desktop = matchMedia("(min-width: 40rem)");
    function ajustar() { if (desktop.matches) fechar(); }
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    document.addEventListener("focusin", foco);
    window.addEventListener("popstate", historico);
    window.addEventListener("pageshow", historico);
    desktop.addEventListener("change", ajustar);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", tecla); document.removeEventListener("focusin", foco); window.removeEventListener("popstate", historico); window.removeEventListener("pageshow", historico); desktop.removeEventListener("change", ajustar); };
  }, []);
  return <details ref={menu} className="menu-comunidade">
    <summary aria-controls={painel}><span>Menu</span><svg className="menu-comunidade-icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g className="menu-icone-abrir"><path d="M4 6h16M4 12h16M4 18h16" /></g><g className="menu-icone-fechar"><path d="m6 6 12 12M18 6 6 18" /></g></svg></summary>
    <div id={painel} className="menu-comunidade-painel" onClick={e => { if (e.target instanceof Element && e.target.closest("a") && menu.current) menu.current.open = false; }}>
      <p className="menu-comunidade-titulo">Perto de quem faz o bem</p>
      <nav aria-label="Principal no celular">
        <Link href="/explorar">Explorar negócios <span aria-hidden="true">↗</span></Link>
        <Link href="/cidades">Encontrar por cidade <span aria-hidden="true">↗</span></Link>
        <Link href="/sobre">Como funciona <span aria-hidden="true">↗</span></Link>
        <Link href="/sobre#dono">Participar <span aria-hidden="true">↗</span></Link>
        <Link href="/indicar" className="menu-comunidade-indicar">Indicar negócio <span aria-hidden="true">↗</span></Link>
      </nav>
      <div className="menu-comunidade-conta">{children}</div>
      <section className="menu-comunidade-preferencias" aria-label="Preferências"><h2>Do seu jeito</h2><div className="menu-comunidade-tema"><span>Aparência</span><AlternarTema /></div><ControleMovimento className="menu-controle-movimento" /></section>
    </div>
  </details>;
}
