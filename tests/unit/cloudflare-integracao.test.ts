import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { configuracaoLocal, erroServidor, ocultarConexao, validarBanco } from "../../scripts/testar-cloudflare";

const banco = "postgresql://postgres:postgres@127.0.0.1:5432/negocio_do_bem_cf_test";

describe("isolamento da prova Cloudflare", () => {
  it.each([
    "postgresql://postgres:postgres@banco.example/negocio_test",
    "postgresql://postgres:postgres@127.0.0.1:5432/negocio_do_bem",
    "postgresql://postgres:postgres@127.0.0.1:5432/negocio_test?host=banco.example",
    "postgresql://postgres:postgres@127.0.0.1:5432/negocio_test?sslmode=require",
    "postgresql://postgres@127.0.0.1:5432/negocio_test",
    "postgresql://postgres:postgres@127.0.0.1:5432/negocio_test#ignored",
    "https://127.0.0.1/negocio_test",
    "",
  ])("recusa destino inseguro antes de migrar ou compilar: %s", (url) => {
    expect(() => validarBanco(url)).toThrow("Use TEST_DATABASE_URL with a disposable local PostgreSQL database");
  });

  it("aceita somente um destino local explícito", () => {
    expect(validarBanco(banco)).toBe(banco);
  });

  it("usa o mesmo banco no Hyperdrive e nas variáveis do Worker", () => {
    const configuracao = configuracaoLocal(banco, "/tmp/projeto");
    expect(configuracao.hyperdrive[0].localConnectionString).toBe(banco);
    expect(configuracao.vars.DATABASE_URL).toBe(banco);
    expect(configuracao.vars.DATABASE_URL_UNPOOLED).toBe(banco);
    expect(Object.keys(configuracao).sort()).toEqual([
      "assets", "compatibility_date", "compatibility_flags", "hyperdrive", "main", "name", "r2_buckets", "vars",
    ]);
    expect(configuracao.hyperdrive[0].id).toBe("00000000000000000000000000000000");
    expect(configuracao.r2_buckets).toEqual([
      { binding: "NEXT_INC_CACHE_R2_BUCKET", bucket_name: "integration-cache", remote: false },
    ]);
    expect(JSON.stringify(configuracao)).not.toContain('"UPLOADS"');
  });

  it("oculta URLs completas e o formato truncado do log real do Wrangler", () => {
    expect(ocultarConexao(banco)).toBe("postgresql://postgres:[redacted]@127.0.0.1:5432/negocio_do_bem_cf_test");
    expect(ocultarConexao('env.DATABASE_URL ("postgresql://postgres:synthetic-prefix...")')).toBe(
      'env.DATABASE_URL ("postgresql://postgres:[redacted]")',
    );
    expect(ocultarConexao("")).toBe("");
    expect(ocultarConexao("[ERROR] Uncaught Error: The Workers runtime canceled this request")).toContain("Uncaught Error:");
  });

  it("recusa o erro real do Workerd e classes específicas de erro", () => {
    expect(erroServidor("Uncaught Error: The Workers runtime canceled this request because it detected that your Worker's code had hung")).toBe(true);
    expect(erroServidor("PrismaClientInitializationError: The loaded wasm module was unexpectedly undefined")).toBe(true);
    expect(erroServidor("[ERROR] failed")).toBe(true);
    expect(erroServidor("[wrangler:info] Ready on http://127.0.0.1:44141")).toBe(false);
    expect(erroServidor("ExperimentalWarning: WebAssembly modules")).toBe(false);
  });

  it("prepara o cache somente local antes de iniciar o Worker", () => {
    const fonte = readFileSync(new URL("../../scripts/testar-cloudflare.ts", import.meta.url), "utf8");
    const preparo = fonte.indexOf('["populateCache", "local", "--config", configuracao]');
    expect(preparo).toBeGreaterThan(-1);
    expect(preparo).toBeLessThan(fonte.indexOf('const worker = iniciar('));
    expect(fonte).not.toContain('["populateCache", "remote"');
  });

  it("usa metadados cf locais sem buscar a rede externa", () => {
    const fonte = readFileSync(new URL("../../scripts/testar-cloudflare.ts", import.meta.url), "utf8");
    const ambiente = fonte.match(/const ambiente = \{([\s\S]*?)\n  \};/)?.[1];
    expect(ambiente).toMatch(/CLOUDFLARE_CF_FETCH_ENABLED:\s*"false"/);
  });

  it("recusa uma configuração com banco remoto", () => {
    expect(() => configuracaoLocal("postgresql://postgres:postgres@remote.example/negocio_test", "/tmp/projeto")).toThrow();
  });

  it("a entrada do comando recusa o banco antes de executar ferramentas", () => {
    const resultado = spawnSync(process.execPath, ["--import", "tsx", "scripts/testar-cloudflare.ts"], {
      cwd: resolve(import.meta.dirname, "../.."),
      env: { NODE_ENV: "test", TEST_DATABASE_URL: "postgresql://127.0.0.1/production", PATH: "/nonexistent" },
      encoding: "utf8",
    });
    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain("Use TEST_DATABASE_URL with a disposable local PostgreSQL database");
    expect(resultado.stderr).not.toContain("ENOENT");
  });
});
