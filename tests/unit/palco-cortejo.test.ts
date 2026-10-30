import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Cortejo } from "@/components/cortejo/Cortejo";
import { CortejoInicial } from "@/app/inicio/CortejoInicial";
import { personagensDoCortejo } from "@/components/cortejo/dados";

// O HTML que o servidor manda: o que aparece sem JavaScript e o que o leitor de tela lê.
const html = renderToStaticMarkup(
  createElement(Cortejo, {
    personagens: personagensDoCortejo({ "Café e padaria": 12, "Moda e acessórios": 1, Saúde: 0, "Mercado e empório": 7 }),
    tecnicas: ["pintura", "xilogravura", "barro", "azulejo"],
  }),
);

function links(): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
}

describe("ciclos gerados", () => {
  it("o gerador de scripts reproduz o CSS do cortejo", () => {
    const script = fileURLToPath(new URL("../../scripts/gerar-ciclos.mjs", import.meta.url));
    const css = readFileSync(new URL("../../src/components/cortejo/ciclos.css", import.meta.url), "utf8");
    const gerado = execFileSync(process.execPath, [script], { encoding: "utf8" });
    // Git no Windows pode converter o arquivo para CRLF; as curvas devem ser idênticas.
    expect(gerado.replace(/\r\n/g, "\n")).toBe(css.replace(/\r\n/g, "\n"));
  });
});

describe("Cortejo antes dos dados", () => {
  it("leva às páginas rastreáveis de tipo sem inventar contagens", () => {
    const inicial = renderToStaticMarkup(createElement(CortejoInicial));
    const destinos = [...inicial.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(destinos).toEqual([
      "/tipos/cafe-e-padaria",
      "/tipos/moda-e-acessorios",
      "/tipos/saude",
      "/tipos/mercado-e-emporio",
    ]);
    expect(inicial).not.toContain("Nenhum negócio ainda");
    expect(inicial).not.toContain("0 negócios");
  });
});

describe("Cortejo no servidor", () => {
  it("cada pessoa é um link com o nome acessível do seu tipo de negócio", () => {
    const rotulos = links().map((tag) => tag.match(/aria-label="([^"]+)"/)?.[1]);
    expect(rotulos).toEqual([
      "Ver negócios de café e padaria",
      "Ver negócios de moda e acessórios",
      "Ver negócios de saúde",
      "Ver negócios de mercado e empório",
    ]);
  });

  it("o link descreve a categoria e a contagem com um texto que existe na página", () => {
    for (const tag of links()) {
      const alvo = tag.match(/aria-describedby="([^"]+)"/)?.[1];
      expect(alvo).toBeTruthy();
      expect(html).toContain(`id="${alvo}"`);
    }
    expect(html).toMatch(/Café e padaria<\/span><span class="sr-only">: <\/span><span[^>]*>12 negócios</);
    expect(html).toContain("1 negócio<");
    expect(html).toContain("Nenhum negócio ainda");
  });

  it("o caramelo fica fora dos links e da árvore de acessibilidade", () => {
    const inicio = html.indexOf("figura-caramelo");
    const antes = html.slice(0, inicio);
    expect(antes.lastIndexOf("<a ")).toBeLessThan(antes.lastIndexOf("</a>"));
    expect(antes.slice(antes.lastIndexOf("<div")).match(/aria-hidden="true"/)).toBeTruthy();
  });

  it("começa parado, na primeira técnica, até o JavaScript assumir", () => {
    expect(html).toMatch(/class="cortejo pintura[^"]*"/);
    expect(html).toContain('data-estado="parado"');
    expect(html).toContain('data-motivo="carregando"');
  });

  it("traz o controle de pausa, escondido até o JavaScript assumir (sem ele, o botão não faria nada)", () => {
    const [botao] = html.match(/<button\b[^>]*>/) ?? [""];
    expect(botao).toContain('type="button"');
    expect(botao).toMatch(/\shidden(=""|\s|>)/);
    expect(html).toContain("Pausar animações");
  });
});
