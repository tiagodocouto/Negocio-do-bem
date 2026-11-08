// Gera os ícones do site a partir do desenho da marca (src/lib/marca.ts).
// Rode de novo sempre que o ícone mudar e faça commit dos arquivos gerados:
//
//   npm run marca:icones
//
// Arquivos gerados:
//   src/app/icon.svg              favicon dos navegadores atuais
//   src/app/favicon.ico           favicon de 16, 32 e 48 px, para quem não lê SVG
//   src/app/apple-icon.png        ícone da tela de início do iPhone (o iOS arredonda os cantos)
//   public/icones/icone-192.png   ícones do manifest (Android e "instalar app")
//   public/icones/icone-512.png
//   public/icones/icone-maskable-512.png  com margem, porque o Android recorta em círculo ou gota

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { svgDoFavicon } from "../src/lib/marca";

const RAIZ = process.cwd();

async function png(svg: string, lado: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 600 }).resize(lado, lado).png().toBuffer();
}

/** Arquivo .ico com uma imagem PNG por tamanho (formato aceito desde o Windows Vista). */
function ico(imagens: { lado: number; dados: Buffer }[]): Buffer {
  const cabecalho = Buffer.alloc(6 + 16 * imagens.length);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(imagens.length, 4);
  let posicao = cabecalho.length;
  imagens.forEach(({ lado, dados }, i) => {
    const entrada = 6 + 16 * i;
    cabecalho.writeUInt8(lado >= 256 ? 0 : lado, entrada);
    cabecalho.writeUInt8(lado >= 256 ? 0 : lado, entrada + 1);
    cabecalho.writeUInt16LE(1, entrada + 4);
    cabecalho.writeUInt16LE(32, entrada + 6);
    cabecalho.writeUInt32LE(dados.length, entrada + 8);
    cabecalho.writeUInt32LE(posicao, entrada + 12);
    posicao += dados.length;
  });
  return Buffer.concat([cabecalho, ...imagens.map((i) => i.dados)]);
}

async function salvar(relativo: string, dados: Buffer | string) {
  const destino = path.join(RAIZ, relativo);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, dados);
  console.log(`✓ ${relativo}`);
}

async function principal() {
  const favicon = svgDoFavicon();
  const semCantos = svgDoFavicon({ arredondado: false, ocupacao: 0.7 });
  const comMargem = svgDoFavicon({ arredondado: false, ocupacao: 0.56 });

  await salvar("src/app/icon.svg", favicon);
  const tamanhos = await Promise.all([16, 32, 48].map(async (lado) => ({ lado, dados: await png(favicon, lado) })));
  await salvar("src/app/favicon.ico", ico(tamanhos));
  await salvar("src/app/apple-icon.png", await png(semCantos, 180));
  await salvar("public/icones/icone-192.png", await png(favicon, 192));
  await salvar("public/icones/icone-512.png", await png(favicon, 512));
  await salvar("public/icones/icone-maskable-512.png", await png(comMargem, 512));
}

principal().catch((erro) => {
  console.error(`Não deu para gerar os ícones: ${erro instanceof Error ? erro.message : erro}`);
  process.exit(1);
});
