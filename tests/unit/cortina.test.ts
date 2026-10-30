import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { destinoDaCortina, proximaFaseCortina, type CliqueDaCortina } from "@/lib/cortina";

const clique = (mudanca: Partial<CliqueDaCortina> = {}): CliqueDaCortina => ({
  atual: "https://exemplo.com/explorar?causa=escala-5x2",
  href: "/empresas/padaria.florescer.exemplo",
  botao: 0,
  ...mudanca,
});

describe("destinoDaCortina", () => {
  it("reconhece uma página interna e conserva sua busca e âncora", () => {
    expect(destinoDaCortina(clique({ href: "/sobre?origem=guia#privacidade" }))).toEqual({
      href: "/sobre?origem=guia#privacidade",
      caminho: "/sobre",
      tinta: "verde-escuro",
    });
  });

  it("usa a tinta do negócio sem consultar o banco", () => {
    const destino = destinoDaCortina(clique());
    expect(destino?.caminho).toBe("/empresas/padaria.florescer.exemplo");
    expect(["azul", "rosa", "amarelo", "verde", "terracota"]).toContain(destino?.tinta);
  });

  it("aceita um clique primário entre páginas", () => {
    expect(destinoDaCortina(clique({ href: "/participar" }))).not.toBeNull();
  });

  it.each([
    { href: "/explorar?causa=antirracista" },
    { href: "/explorar#resultados" },
    { href: "/explorar/" },
    { href: "#resultados" },
    { href: "https://outro.com/sobre" },
    { href: "mailto:oi@exemplo.com" },
    { href: "tel:+5511999999999" },
    { href: "javascript:alert(1)" },
    { href: "/enviados/foto.jpg" },
    { href: "/manual.pdf" },
    { href: "/api/link?codigo=exemplo" },
    { ctrl: true },
    { meta: true },
    { shift: true },
    { alt: true },
    { botao: 1 },
    { alvo: "_blank" },
    { alvo: "_parent" },
    { download: true },
    { prevenido: true },
    { desativado: true },
    { teclado: true },
    { pausado: true },
  ])("mantém a navegação nativa para %j", (mudanca) => {
    expect(destinoDaCortina(clique(mudanca))).toBeNull();
  });
});

describe("abertura pulada", () => {
  it("reinicia a saída do contêiner sem aproveitar o tempo da abertura normal", () => {
    const css = readFileSync(new URL("../../src/components/cortina/cortina.css", import.meta.url), "utf8");
    const pulada = css.match(/html\[data-abertura="pulada"\] \.cortina-abertura \{([^}]+)\}/)![1];
    expect(pulada).toContain("animation: cortina-abertura-pula-finaliza 1ms linear 550ms both");
    expect(css).toContain("@keyframes cortina-abertura-pula-finaliza");
  });
});

describe("proximaFaseCortina", () => {
  it("só troca de página depois de cobrir e só termina depois de revelar", () => {
    expect(proximaFaseCortina("oculta", "iniciar")).toBe("fechando");
    expect(proximaFaseCortina("fechando", "cobrir")).toBe("coberta");
    expect(proximaFaseCortina("coberta", "revelar")).toBe("abrindo");
    expect(proximaFaseCortina("abrindo", "terminar")).toBe("oculta");
  });

  it("não pula etapas nem reinicia uma transição ocupada", () => {
    expect(proximaFaseCortina("fechando", "revelar")).toBe("fechando");
    expect(proximaFaseCortina("coberta", "iniciar")).toBe("coberta");
    expect(proximaFaseCortina("oculta", "terminar")).toBe("oculta");
  });

  it.each(["oculta", "fechando", "coberta", "abrindo"] as const)("cancelar libera a fase %s", (fase) => {
    expect(proximaFaseCortina(fase, "cancelar")).toBe("oculta");
  });
});
