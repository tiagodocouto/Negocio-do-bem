// Embute as fontes das imagens de compartilhamento (assets/fontes) num módulo,
// porque o Worker do Cloudflare não lê arquivos do projeto em tempo de execução.
// Rode de novo sempre que uma fonte mudar e faça commit do arquivo gerado:
//
//   npm run marca:fontes
//
// Arquivo gerado: src/lib/fontes-compartilhamento.ts

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const RAIZ = process.cwd();
const FONTES = { NEWSREADER: "Newsreader-SemiBold.ttf", INTER: "Inter-Medium.ttf" };

async function main() {
  const linhas = [
    "// Gerado por scripts/gerar-fontes.ts (npm run marca:fontes) a partir de assets/fontes. Não edite.",
    "",
  ];
  for (const [nome, arquivo] of Object.entries(FONTES)) {
    const base64 = (await readFile(path.join(RAIZ, "assets/fontes", arquivo))).toString("base64");
    linhas.push(`export const ${nome} = "${base64}";`);
  }
  await writeFile(path.join(RAIZ, "src/lib/fontes-compartilhamento.ts"), `${linhas.join("\n")}\n`);
}

main();
