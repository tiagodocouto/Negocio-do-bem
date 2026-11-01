import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Upstream: https://github.com/opennextjs/opennextjs-cloudflare/pull/1465
// Remove this patch when the pinned adapter release includes keepNames. Refs #221.
const ANCORA = "        minifyIdentifiers: false,\n";
const OPCAO = "        keepNames: true,\n";
const HASH_ORIGINAL = "7427396fc97091cb7b1e649e411d690a2e836c2eaf14e5cc6c7ca7fe93afe307";
const HASH_CORRIGIDO = "4979c2622eee9b5a332bc75d2036016d9e80be1a07dd184cf9589bd41dcff631";

/** @param {string} versao @param {string} fonte */
export function corrigirFonte(versao, fonte) {
  if (versao !== "1.20.14") throw new Error("Unsupported OpenNext version. Expected 1.20.14.");
  if (fonte.split(ANCORA).length !== 2) throw new Error("Expected one OpenNext source anchor.");
  const hash = createHash("sha256").update(fonte).digest("hex");
  if (hash === HASH_CORRIGIDO) return fonte;
  if (hash !== HASH_ORIGINAL) throw new Error("Unexpected OpenNext source. Check the pinned adapter before this build.");
  return fonte.replace(ANCORA, ANCORA + OPCAO);
}

function corrigirInstalado() {
  const pacote = new URL("../node_modules/@opennextjs/cloudflare/", import.meta.url);
  const manifesto = new URL("package.json", pacote);
  const arquivo = new URL("dist/cli/build/bundle-server.js", pacote);
  if (statSync(manifesto).size > 16 * 1024 || statSync(arquivo).size > 64 * 1024) {
    throw new Error("Unexpected OpenNext file size. Check the pinned adapter before this build.");
  }
  const { version } = JSON.parse(readFileSync(manifesto, "utf8"));
  const fonte = readFileSync(arquivo, "utf8");
  const corrigida = corrigirFonte(version, fonte);
  if (corrigida !== fonte) writeFileSync(arquivo, corrigida);
  console.log(corrigida === fonte ? "OpenNext compatibility patch already applied." : "OpenNext compatibility patch applied.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    corrigirInstalado();
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : "The OpenNext compatibility patch failed.");
    process.exitCode = 1;
  }
}
