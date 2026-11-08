import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { caminhoSeguro } from "@/lib/auth/sessao";

const ORIGEM = "http://origem.invalid";

describe("caminhoSeguro", () => {
  it.each([
    "/",
    "/painel",
    "/painel/meu_negocio",
    "/entrar?voltar=%2Fpainel",
    "/busca?cidade=S%C3%A3o+Paulo&causa=educacao#resultados",
    "/moderacao?aba=empresas&pagina=2",
    "/a/b/../c",
    "/%09/x",
    "/busca?q=//origem.invalid/#resultados",
    "/painel#meu_negocio",
  ])("mantém o caminho interno %j sem mudar", (valor) => {
    expect(caminhoSeguro(valor)).toBe(valor);
  });

  it.each([
    ["TAB", "/\t/destino.invalid"],
    ["LF", "/\n/destino.invalid"],
    ["CR", "/\r/destino.invalid"],
    ["TAB no começo do caminho", "/\tdestino.invalid"],
    ["TAB depois da barra dupla", "/\t/\tdestino.invalid"],
    ["NUL", "/\u0000/destino.invalid"],
    ["US (U+001F)", "/\u001f/destino.invalid"],
    ["DEL (U+007F)", "/\u007f/destino.invalid"],
    ["TAB no fim", "/painel\t"],
    ["barra dupla", "//destino.invalid"],
    ["autoridade igual à origem fictícia", "//origem.invalid/"],
    ["credencial com ponto e vírgula", "//evil.example;@origem.invalid/"],
    ["barra invertida", "/\\destino.invalid"],
    ["sem barra inicial", "destino.invalid"],
    ["URL absoluta", "https://destino.invalid/x"],
    ["esquema javascript", "javascript:alert(1)"],
    ["texto vazio", ""],
  ])("recusa %s e volta ao padrão", (_nome, valor) => {
    expect(caminhoSeguro(valor)).toBe("/");
    expect(caminhoSeguro(valor, "/painel/negocio")).toBe("/painel/negocio");
  });

  it.each([undefined, null, 42, {}, ["/painel"]])("recusa o valor que não é texto %j", (valor) => {
    expect(caminhoSeguro(valor, "/inicio")).toBe("/inicio");
  });

  it("nenhum valor aceito sai da origem depois da interpretação WHATWG", () => {
    const candidatos: string[] = ["/", "/painel", "/a?b=c#d"];
    for (let codigo = 0; codigo < 0x100; codigo++) {
      const c = String.fromCharCode(codigo);
      candidatos.push(`/${c}/destino.invalid`, `/${c}${c}destino.invalid`, `/${c}`);
    }
    for (const valor of candidatos) {
      const aceito = caminhoSeguro(valor, "/padrao");
      expect(new URL(aceito, ORIGEM).origin).toBe(ORIGEM);
    }
  });
});

describe("cabeçalho de redirecionamento do Next", () => {
  const carregar = createRequire(import.meta.url);
  const fonte = readFileSync(carregar.resolve("next/dist/client/components/router-reducer/reducers/server-action-reducer"), "utf8");
  const inicio = fonte.indexOf("    const redirectHeader =");
  const fim = fonte.indexOf("    const contentType =", inicio);

  it.each([
    ["//origem.invalid/", "http://origem.invalid/"],
    ["//evil.example;@origem.invalid/", "http://evil.example/"],
  ])("mantém %s interno após o parser real do cabeçalho", (valor, destinoSemFiltro) => {
    expect(inicio).toBeGreaterThanOrEqual(0);
    expect(fim).toBeGreaterThan(inicio);
    // Executa o trecho instalado do parser, sem carregar o roteador nem acessar a rede.
    const interpretar = (destino: string): URL => runInNewContext(
      `(() => { ${fonte.slice(inicio, fim)} return redirectLocation; })()`,
      {
        res: new Response(null, { headers: { "x-action-redirect": `${destino};push` } }),
        state: { canonicalUrl: "/entrar" },
        window: { location: { href: "http://site.invalid/entrar" } },
        URL,
        _approuterheaders: carregar("next/dist/client/components/app-router-headers"),
        _actionrevalidationkind: carregar("next/dist/shared/lib/action-revalidation-kind"),
        _assignlocation: carregar("next/dist/client/assign-location"),
      },
    );
    expect(interpretar(valor).href).toBe(destinoSemFiltro);
    expect(interpretar(caminhoSeguro(valor)).href).toBe("http://site.invalid/");
  });
});

describe("quem usa o voltar passa por caminhoSeguro", () => {
  const ler = (arquivo: string) => readFileSync(path.resolve(import.meta.dirname, "../..", arquivo), "utf8");

  it("PaginaConta filtra o voltar antes do redirect e do campo oculto", () => {
    const fonte = ler("src/components/PaginaConta.tsx");
    expect(fonte).toMatch(/const voltar = caminhoSeguro\(/);
    expect(fonte).not.toMatch(/redirect\(\s*(?!voltar\b)/);
  });

  it("as ações de conta só redirecionam para um caminho fixo ou filtrado por caminhoSeguro", () => {
    const fonte = ler("src/acoes/conta.ts");
    // Variáveis que guardam o resultado de caminhoSeguro, como `const voltar = caminhoSeguro(...)`.
    const filtradas = new Set([...fonte.matchAll(/const (\w+) = caminhoSeguro\(/g)].map((m) => m[1]));
    const destinos = [...fonte.matchAll(/redirect\(([^;]*)\);/g)].map((m) => m[1]!.trim());
    expect(destinos.length).toBeGreaterThanOrEqual(2);
    for (const destino of destinos) {
      // Um texto fixo só vale se começa com uma barra seguida de outra coisa que não barra nem ${...}.
      const fixo = /^(["`])\/(?:\1|[^$/\\])/.test(destino);
      expect(fixo || destino.startsWith("caminhoSeguro(") || filtradas.has(destino), destino).toBe(true);
    }
  });
});
