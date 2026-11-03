// Baixa do Wikimedia Commons as fotos das páginas de cidade listadas em
// src/lib/fotos-das-cidades.json e grava em public/fotos/cidades, em dois tamanhos
// (1280 e 800 px de largura). Também preenche no JSON o autor, a licença e o
// tamanho de cada foto, lidos do Commons, que vão no crédito embaixo da foto.
//
// De cada foto sai também a prévia do link (a imagem que aparece no WhatsApp),
// pronta de antemão em JPEG: o PNG que o Next gera na hora passa de 1 MB com a
// foto, e o WhatsApp não mostra prévia acima de 600 KB. A prévia é refeita a cada
// execução, porque leva milissegundos, e o nome dela muda junto com a imagem.
//
// Para pôr ou trocar a foto de uma cidade, escreva no JSON só "cidade", "uf",
// "arquivo" (o nome no Commons, "File:...") e "descricao" (o texto alternativo),
// rode o script e faça commit do JSON e das fotos. O nome dos arquivos muda junto
// com o arquivo do Commons, então o navegador nunca mostra a foto antiga.
//
// Uso: npm run cidades:fotos              (baixa só as que faltam)
//      npm run cidades:fotos -- --todas   (baixa todas de novo)

import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { createElement } from "react";
import sharp from "sharp";
import { FONTES, TAMANHO } from "../src/lib/compartilhamento";
import { slugCidade } from "../src/lib/diretorio";
import {
  LARGURA_DA_FOTO,
  LARGURA_DA_FOTO_PEQUENA,
  licencaAceita,
  PASTA_DAS_FOTOS,
  type FotoGravada,
} from "../src/lib/fotos-das-cidades";
import { nomeOficial } from "../src/lib/municipios";
import { PreviaDaCidade } from "../src/lib/previa-da-cidade";

const RAIZ = process.cwd();
const LISTA = path.join(RAIZ, "src/lib/fotos-das-cidades.json");
const PASTA = path.join(RAIZ, "public", PASTA_DAS_FOTOS);
const API = "https://commons.wikimedia.org/w/api.php";
// A Wikimedia pede um User-Agent que diga quem faz os pedidos.
const CABECALHOS = { "User-Agent": "NegocioDoBem/1.0 (https://www.negociodobem.com; ola@negociodobem.com)" };

type Escolha = Pick<FotoGravada, "cidade" | "uf" | "arquivo" | "descricao"> & Partial<FotoGravada>;

type InfoDoCommons = {
  title: string;
  missing?: boolean;
  imageinfo?: {
    url: string;
    thumburl?: string;
    width: number;
    height: number;
    extmetadata?: Record<string, { value: string } | undefined>;
  }[];
};

async function pedir(url: string): Promise<Response> {
  for (let tentativa = 1; ; tentativa++) {
    const resposta = await fetch(url, { headers: CABECALHOS });
    if (resposta.status !== 429 || tentativa === 5) return resposta;
    await new Promise((pronto) => setTimeout(pronto, 2000 * tentativa));
  }
}

/** Metadados dos arquivos no Commons, 50 por pedido, pelo nome que o Commons usa. */
async function buscarNoCommons(arquivos: string[]): Promise<Map<string, InfoDoCommons>> {
  const infos = new Map<string, InfoDoCommons>();
  for (let i = 0; i < arquivos.length; i += 50) {
    const lote = arquivos.slice(i, i + 50);
    const parametros = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiurlwidth: "1920",
      iiextmetadatafilter: "Artist|Attribution|LicenseShortName|LicenseUrl",
      titles: lote.join("|"),
    });
    const resposta = await pedir(`${API}?${parametros}`);
    if (!resposta.ok) throw new Error(`o Commons respondeu ${resposta.status}`);
    const { query } = (await resposta.json()) as {
      query: { normalized?: { from: string; to: string }[]; pages: InfoDoCommons[] };
    };
    const normalizado = new Map(query.normalized?.map((n) => [n.from, n.to]));
    const porTitulo = new Map(query.pages.map((p) => [p.title, p]));
    for (const arquivo of lote) {
      const pagina = porTitulo.get(normalizado.get(arquivo) ?? arquivo);
      if (pagina) infos.set(arquivo, pagina);
    }
  }
  return infos;
}

/** Texto do autor sem o HTML que o Commons manda (links para o perfil, por exemplo). */
function textoSimples(html: string): string {
  const texto = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return texto.length > 100 ? `${texto.slice(0, 98).trimEnd()}…` : texto;
}

/**
 * A prévia do link: o desenho de previa-da-cidade.tsx por cima da foto cortada em
 * 1200×630. Na qualidade 65, fica entre 30 e 120 KB.
 */
async function fazerPrevia(foto: string, nome: string): Promise<Buffer> {
  const desenho = new ImageResponse(createElement(PreviaDaCidade, { nome, sobreFoto: true }), { ...TAMANHO, fonts: FONTES });
  return sharp(foto)
    .resize(TAMANHO.width, TAMANHO.height, { fit: "cover" })
    .composite([{ input: Buffer.from(await desenho.arrayBuffer()) }])
    .jpeg({ quality: 65, mozjpeg: true, progressive: true })
    .toBuffer();
}

const existe = (arquivo: string) =>
  access(arquivo).then(
    () => true,
    () => false,
  );

async function principal() {
  const todas = process.argv.includes("--todas");
  const lista = JSON.parse(await readFile(LISTA, "utf8")) as Record<string, Escolha>;
  const problemas: string[] = [];

  for (const [slug, escolha] of Object.entries(lista)) {
    if (nomeOficial(escolha.cidade, escolha.uf) !== escolha.cidade) problemas.push(`${slug}: "${escolha.cidade}" não é o nome oficial do IBGE`);
    if (slugCidade(escolha.cidade, escolha.uf) !== slug) problemas.push(`${slug}: o endereço deveria ser ${slugCidade(escolha.cidade, escolha.uf)}`);
    if (!escolha.arquivo?.startsWith("File:")) problemas.push(`${slug}: o arquivo precisa começar com "File:"`);
    if (!escolha.descricao?.trim()) problemas.push(`${slug}: falta a descrição da foto`);
  }

  const infos = await buscarNoCommons(Object.values(lista).map((e) => e.arquivo));
  await mkdir(PASTA, { recursive: true });
  const gravadas: Record<string, FotoGravada> = {};
  let baixadas = 0;

  for (const [slug, escolha] of Object.entries(lista).sort(([a], [b]) => a.localeCompare(b))) {
    const info = infos.get(escolha.arquivo);
    const imagem = info?.imageinfo?.[0];
    if (!info || info.missing || !imagem) {
      problemas.push(`${slug}: ${escolha.arquivo} não existe no Commons`);
      continue;
    }
    const metadados = (campo: string) => imagem.extmetadata?.[campo]?.value ?? "";
    const licenca = textoSimples(metadados("LicenseShortName"));
    if (!licencaAceita(licenca)) {
      problemas.push(`${slug}: a licença "${licenca}" não serve (só domínio público, CC0, CC BY e CC BY-SA)`);
      continue;
    }
    if (imagem.width / imagem.height < 1.3) problemas.push(`${slug}: a foto não é horizontal (${imagem.width}×${imagem.height})`);

    const foto = `${slug}-${createHash("sha1").update(info.title).digest("hex").slice(0, 8)}`;
    const grande = path.join(PASTA, `${foto}.jpg`);
    const pequena = path.join(PASTA, `${foto}-${LARGURA_DA_FOTO_PEQUENA}.jpg`);
    if (todas || !(await existe(grande)) || !(await existe(pequena))) {
      const resposta = await pedir(imagem.thumburl ?? imagem.url);
      if (!resposta.ok) {
        problemas.push(`${slug}: não deu para baixar a foto (${resposta.status})`);
        continue;
      }
      const original = sharp(Buffer.from(await resposta.arrayBuffer())).rotate();
      const jpeg = { quality: 72, mozjpeg: true, progressive: true };
      await original.clone().resize({ width: LARGURA_DA_FOTO, withoutEnlargement: true }).jpeg(jpeg).toFile(grande);
      await original.clone().resize({ width: LARGURA_DA_FOTO_PEQUENA, withoutEnlargement: true }).jpeg(jpeg).toFile(pequena);
      baixadas++;
      console.log(`✓ ${slug}`);
    }
    const { width, height } = await sharp(grande).metadata();

    const imagemDaPrevia = await fazerPrevia(grande, `${escolha.cidade}, ${escolha.uf}`);
    const previa = `${slug}-previa-${createHash("sha1").update(imagemDaPrevia).digest("hex").slice(0, 8)}`;
    await writeFile(path.join(PASTA, `${previa}.jpg`), imagemDaPrevia);

    gravadas[slug] = {
      cidade: escolha.cidade,
      uf: escolha.uf,
      arquivo: info.title,
      descricao: escolha.descricao.trim(),
      foto,
      previa,
      autor: textoSimples(metadados("Attribution") || metadados("Artist")) || "Autor desconhecido",
      licenca,
      licencaUrl: metadados("LicenseUrl") || null,
      largura: width,
      altura: height,
    };
  }

  // Cidades com problema ficam na lista como estavam, com a foto de antes, para serem corrigidas.
  for (const [slug, escolha] of Object.entries(lista)) if (!gravadas[slug]) gravadas[slug] = escolha as FotoGravada;

  // Fotos e prévias que nenhuma cidade usa mais, como a antiga de uma cidade que trocou de foto.
  const usadas = new Set(
    Object.values(gravadas).flatMap((g) => [
      ...(g.foto ? [`${g.foto}.jpg`, `${g.foto}-${LARGURA_DA_FOTO_PEQUENA}.jpg`] : []),
      ...(g.previa ? [`${g.previa}.jpg`] : []),
    ]),
  );
  for (const arquivo of await readdir(PASTA)) {
    if (arquivo.endsWith(".jpg") && !usadas.has(arquivo)) {
      await unlink(path.join(PASTA, arquivo));
      console.log(`✗ ${arquivo} (sem uso)`);
    }
  }

  const ordenadas = Object.fromEntries(Object.entries(gravadas).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(LISTA, `${JSON.stringify(ordenadas, null, 2)}\n`);

  console.log(`${Object.keys(lista).length} cidades na lista, ${baixadas} fotos baixadas.`);
  if (problemas.length > 0) {
    console.error(`\nCorrija e rode de novo:\n${problemas.map((p) => `- ${p}`).join("\n")}`);
    process.exit(1);
  }
}

principal().catch((erro) => {
  console.error(`Não deu para baixar as fotos: ${erro instanceof Error ? erro.message : erro}`);
  process.exit(1);
});
