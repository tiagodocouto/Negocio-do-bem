import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { corrigirFonte } from "../../scripts/corrigir-opennext.mjs";

const ancora = "        minifyIdentifiers: false,\n";
const opcao = "        keepNames: true,\n";
const instalada = readFileSync(new URL("../../node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js", import.meta.url), "utf8");
const original = instalada.replace(opcao, "");
const corrigida = original.replace(ancora, ancora + opcao);

describe("compatibilidade do bundle OpenNext", () => {
  it("preserva os nomes na fonte original da versão fixada", () => {
    expect(corrigirFonte("1.20.14", original)).toBe(corrigida);
    expect(corrigida.match(/keepNames: true/g)).toHaveLength(1);
  });

  it("aceita a fonte já corrigida sem uma segunda alteração", () => {
    expect(corrigirFonte("1.20.14", corrigida)).toBe(corrigida);
    expect(corrigirFonte("1.20.14", corrigirFonte("1.20.14", original))).toBe(corrigida);
  });

  it("recusa uma versão diferente antes de alterar a fonte", () => {
    expect(() => corrigirFonte("1.20.15", original)).toThrow("Unsupported OpenNext version");
  });

  it.each([
    original.replace(ancora, ""),
    original.replace(ancora, ancora + ancora),
  ])("recusa uma âncora ausente ou duplicada", (fonte) => {
    expect(() => corrigirFonte("1.20.14", fonte)).toThrow("Expected one OpenNext source anchor");
  });

  it("recusa outra alteração mesmo com a âncora intacta", () => {
    expect(() => corrigirFonte("1.20.14", `${original}\n// unexpected change\n`)).toThrow("Unexpected OpenNext source");
  });

  it("executa a correção no caminho comum antes das migrações", () => {
    const script = readFileSync(new URL("../../scripts/cloudflare-build.sh", import.meta.url), "utf8");
    const correcao = script.indexOf("node scripts/corrigir-opennext.mjs");
    expect(correcao).toBeGreaterThan(-1);
    expect(correcao).toBeLessThan(script.indexOf('if [ -n "$WORKERS_CI_BRANCH" ]; then'));
  });
});
