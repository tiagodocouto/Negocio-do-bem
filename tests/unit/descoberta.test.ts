import { execFileSync } from "node:child_process";
import { relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(import.meta.dirname, "../..");

describe("descoberta de testes", () => {
  it("não coleta cópias guardadas fora da pasta tests", () => {
    const saida = execFileSync(process.execPath, ["node_modules/vitest/vitest.mjs", "list", "--filesOnly", "--json"], {
      cwd: raiz, encoding: "utf8",
    });
    const arquivos = JSON.parse(saida) as { file: string }[];
    expect(arquivos.length).toBeGreaterThan(0);
    expect(arquivos.map(({ file }) => relative(raiz, file)).filter((nome) => !nome.startsWith(`tests${sep}`))).toEqual([]);
    expect(arquivos.some(({ file }) => relative(raiz, file).startsWith(`tests${sep}integracao${sep}`))).toBe(false);
  });
});
