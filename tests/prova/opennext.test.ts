import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { corrigirFonte } from "../../scripts/corrigir-opennext.mjs";

const ancora = "        minifyIdentifiers: false,\n";
const opcao = "        keepNames: true,\n";
const instalada = readFileSync(new URL("../../node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js", import.meta.url), "utf8");
const original = instalada.replace(opcao, "");
const corrigida = original.replace(ancora, ancora + opcao);

describe("pinned OpenNext compatibility", () => {
  it("preserves names and accepts an already corrected source", () => {
    expect(corrigirFonte("1.20.14", original)).toBe(corrigida);
    expect(corrigirFonte("1.20.14", corrigida)).toBe(corrigida);
    expect(corrigida.match(/keepNames: true/g)).toHaveLength(1);
  });
  it.each([
    ["1.20.15", original],
    ["1.20.14", original.replace(ancora, "")],
    ["1.20.14", original.replace(ancora, ancora + ancora)],
    ["1.20.14", original + "\n// changed source\n"],
  ])("refuses a different release, anchor, or source", (versao, fonte) => {
    expect(() => corrigirFonte(versao, fonte)).toThrow();
  });
  it("forwards the isolated config to both build and local preview", () => {
    const build = readFileSync(new URL("../../scripts/cloudflare-build.sh", import.meta.url), "utf8");
    const preview = readFileSync(new URL("../../scripts/cloudflare-local-preview.sh", import.meta.url), "utf8");
    expect(build).toContain('npx opennextjs-cloudflare build "$@"');
    expect(preview).toContain('npm run cf:build -- "$@"');
    expect(preview).toContain('opennextjs-cloudflare preview "$@"');
    expect(preview).not.toMatch(/remote|deploy|cf:preview/);
  });
});
