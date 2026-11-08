// Copia as fotos antigas do Vercel Blob para o bucket R2 de produção e troca os
// endereços no banco (#177). Elas aparecem no Empresa.fotoUrl e no Markdown da
// Empresa.historia. Sem --aplicar, só mostra o que faria.
//
// Rode só depois que o www estiver no Cloudflare: o deploy antigo do Vercel não
// aceita fotos de fotos.negociodobem.com, e os perfis ficariam sem foto lá.
// Precisa do wrangler com login na conta do Cloudflare (npx wrangler login).
//
// Uso (no banco do DATABASE_URL do .env):
//   npm run fotos:para-r2
//   npm run fotos:para-r2 -- --aplicar
//
// No banco de produção, passe a conexão na frente:
//   DATABASE_URL="postgresql://..." npm run fotos:para-r2 -- --aplicar
//
// O bucket e o domínio são os de produção; para outros, use FOTOS_R2_BUCKET e
// FOTOS_R2_URL. Pode rodar de novo: o que já foi trocado não aparece mais. Os
// arquivos do Blob não são apagados.

import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const BUCKET = process.env.FOTOS_R2_BUCKET || "negocio-do-bem-fotos";
const URL_PUBLICA = (process.env.FOTOS_R2_URL || "https://fotos.negociodobem.com").replace(/\/$/, "");
const DOMINIO_BLOB = ".public.blob.vercel-storage.com/";
const URL_DO_BLOB = /https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[^\s)"'<>\]]+/gi;
// Os nomes que o site gerou no Blob (perfis/… e historias/…) só têm estes caracteres.
const CHAVE_SEGURA = /^[A-Za-z0-9][A-Za-z0-9/._-]*$/;
const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const DOWNLOADS_SIMULTANEOS = 8;

const urlDoBanco = process.env.DATABASE_URL;
if (!urlDoBanco) {
  console.error("Falta DATABASE_URL. Configure no .env ou passe na frente do comando.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlDoBanco }) });

type Foto = { antiga: string; chave: string; nova: string; arquivo?: string; tipo?: string; erro?: string };

const chaveDe = (url: string) => new URL(url).pathname.slice(1);
const fotosDe = (texto: string | null) => (texto ? (texto.match(URL_DO_BLOB) ?? []) : []);

async function emLotes<T>(itens: T[], tamanho: number, tarefa: (item: T) => Promise<void>) {
  for (let i = 0; i < itens.length; i += tamanho) await Promise.all(itens.slice(i, i + tamanho).map(tarefa));
}

/** Baixa a foto para a pasta. Se falhar, anota o erro, e a foto fica no Blob. */
async function baixar(foto: Foto, pasta: string) {
  try {
    const resposta = await fetch(foto.antiga);
    if (!resposta.ok) throw new Error(`respondeu ${resposta.status}`);
    const tipo = resposta.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!TIPOS[tipo]) throw new Error(`não é JPG, PNG nem WebP (${tipo || "sem tipo"})`);
    const arquivo = path.join(pasta, foto.chave.replaceAll("/", "__"));
    await writeFile(arquivo, Buffer.from(await resposta.arrayBuffer()));
    Object.assign(foto, { tipo, arquivo });
  } catch (erro) {
    foto.erro = erro instanceof Error ? erro.message : String(erro);
  }
}

/** Envia ao R2 um lote por tipo: o wrangler grava o mesmo content-type em todo o lote. */
async function enviar(fotos: Foto[], pasta: string) {
  for (const [tipo, extensao] of Object.entries(TIPOS)) {
    const doTipo = fotos.filter((f) => f.tipo === tipo);
    if (!doTipo.length) continue;
    const lista = path.join(pasta, `lista-${extensao}.json`);
    await writeFile(lista, JSON.stringify(doTipo.map((f) => ({ key: f.chave, file: f.arquivo }))));
    execFileSync("npx", ["wrangler", "r2", "bulk", "put", BUCKET, "--filename", lista, "--ct", tipo, "--remote"], {
      stdio: "inherit",
    });
  }
}

async function main() {
  const { host, pathname } = new URL(urlDoBanco!);
  console.log(`Banco: ${host}${pathname}`);
  console.log(`Destino: bucket ${BUCKET}, servido em ${URL_PUBLICA}\n`);
  const aplicar = process.argv.includes("--aplicar");

  const empresas = await db.empresa.findMany({
    where: { OR: [{ fotoUrl: { contains: DOMINIO_BLOB } }, { historia: { contains: DOMINIO_BLOB } }] },
    select: { id: true, instagramUsername: true, fotoUrl: true, historia: true },
    orderBy: { instagramUsername: "asc" },
  });

  const fotos = new Map<string, Foto>();
  const recusadas: string[] = [];
  for (const empresa of empresas) {
    for (const antiga of [...fotosDe(empresa.fotoUrl), ...fotosDe(empresa.historia)]) {
      if (fotos.has(antiga)) continue;
      const chave = chaveDe(antiga);
      if (!CHAVE_SEGURA.test(chave) || chave.includes("..")) recusadas.push(antiga);
      else fotos.set(antiga, { antiga, chave, nova: `${URL_PUBLICA}/${chave}` });
    }
  }

  const dePerfil = empresas.filter((e) => e.fotoUrl?.includes(DOMINIO_BLOB)).length;
  const comHistoria = empresas.filter((e) => e.historia.includes(DOMINIO_BLOB)).length;
  console.log(`Negócios com foto no Blob: ${empresas.length} (${dePerfil} na foto do perfil, ${comHistoria} na história)`);
  console.log(`Fotos para copiar: ${fotos.size}`);
  for (const foto of [...fotos.values()].slice(0, 3)) console.log(`  ${foto.antiga}\n  → ${foto.nova}`);
  if (fotos.size > 3) console.log(`  … e mais ${fotos.size - 3}`);
  if (recusadas.length) {
    console.log(`\nCom nome fora do padrão, ficam no Blob (${recusadas.length}):`);
    for (const url of recusadas) console.log(`  ${url}`);
  }

  if (!fotos.size) return;
  if (!aplicar) {
    console.log("\nNada foi copiado nem gravado. Para fazer, rode de novo com --aplicar.");
    return;
  }

  const pasta = await mkdtemp(path.join(tmpdir(), "fotos-para-r2-"));
  try {
    console.log("\nBaixando do Blob…");
    await emLotes([...fotos.values()], DOWNLOADS_SIMULTANEOS, (foto) => baixar(foto, pasta));
    const falharam = [...fotos.values()].filter((f) => f.erro);
    if (falharam.length) {
      console.log(`Não baixaram e ficam no Blob (${falharam.length}):`);
      for (const foto of falharam) console.log(`  ${foto.antiga}: ${foto.erro}`);
      for (const foto of falharam) fotos.delete(foto.antiga);
    }
    const lista = [...fotos.values()];
    if (!lista.length) return;

    console.log("Enviando ao R2…");
    await enviar(lista, pasta);

    // Só troca o endereço no banco depois de ver cada foto no domínio público.
    console.log("Conferindo no domínio público…");
    const faltando: string[] = [];
    await emLotes(lista, DOWNLOADS_SIMULTANEOS, async (foto) => {
      const resposta = await fetch(foto.nova, { method: "HEAD" });
      if (!resposta.ok) faltando.push(`${foto.nova} (${resposta.status})`);
    });
    if (faltando.length) {
      console.error(`\nFotos que não abriram no R2 (${faltando.length}). Nada foi gravado no banco:`);
      for (const url of faltando) console.error(`  ${url}`);
      process.exitCode = 1;
      return;
    }

    let trocados = 0;
    const mudaram: string[] = [];
    for (const empresa of empresas) {
      const trocar = (texto: string) => texto.replace(URL_DO_BLOB, (url) => fotos.get(url)?.nova ?? url);
      const fotoUrl = empresa.fotoUrl && trocar(empresa.fotoUrl);
      const historia = trocar(empresa.historia);
      if (fotoUrl === empresa.fotoUrl && historia === empresa.historia) continue;
      // Grava só se ninguém mexeu no negócio desde a leitura; senão, a próxima rodada pega.
      const { count } = await db.empresa.updateMany({
        where: { id: empresa.id, fotoUrl: empresa.fotoUrl, historia: empresa.historia },
        data: { fotoUrl, historia },
      });
      if (count) trocados++;
      else mudaram.push(empresa.instagramUsername);
    }
    console.log(`\nEndereços trocados em ${trocados} negócios.`);
    if (mudaram.length) console.log(`Mudaram enquanto o script rodava; rode de novo para eles: ${mudaram.join(", ")}`);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
