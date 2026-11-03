import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ci = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const pacote = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

describe("verificação do Next no CI", () => {
  it("compila o produto antes de executar a integração", () => {
    expect(ci).toMatch(/^\s+- run: npm run build\s*$/m);
    expect(ci).toMatch(/^\s+- run: npm run test:integracao\s*$/m);
    expect(ci.indexOf("- run: npm run build")).toBeLessThan(ci.indexOf("- run: npm run test:integracao"));
  });

  it("seleciona a integração explicitamente sem depender de uma variável de ativação", () => {
    expect(pacote.scripts["test:integracao"]).toBe("vitest run --config vitest.integracao.config.mts");
    expect(pacote.scripts.test).toBe("vitest run");
  });

  it("mantém o check obrigatório e uma prova Cloudflare separada", () => {
    expect(ci).toContain("name: Lint, tipos e testes");
    expect(ci).toMatch(/^\s+- run: npm run test:cloudflare\s*$/m);
    expect(pacote.scripts["test:cloudflare"]).toBe("tsx scripts/testar-cloudflare.ts");
    expect(pacote.scripts.test).toBe("vitest run");
    expect(ci).toContain("TEST_DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5432/negocio_do_bem_teste");
  });

  it("usa no build o mesmo banco descartável migrado pelos testes", () => {
    const url = ci.match(/^\s+DATABASE_URL:\s*(\S+)\s*$/m)?.[1];
    expect(url).toBeTruthy();
    expect(new URL(url!).pathname).toBe("/negocio_do_bem_teste");
  });
});
