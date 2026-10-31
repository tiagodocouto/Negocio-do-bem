import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { ehFotoDoSite, TAMANHO_MAXIMO_FOTO, type TipoDeFoto } from "@/lib/fotos";

// Com BLOB_STORE_ID ou BLOB_READ_WRITE_TOKEN, as fotos vão para o Vercel Blob.
// No Vercel, o @vercel/blob se autentica pelo OIDC do deploy com o BLOB_STORE_ID
// e só usa o token se não houver OIDC. Sem nenhum dos dois, em desenvolvimento,
// as fotos ficam em public/enviados, que o Next serve direto.
const PASTA_LOCAL = path.join(process.cwd(), "public", "enviados");

export const usaBlob = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

const EXTENSOES: Record<TipoDeFoto, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Primeiros bytes de cada formato: o tipo informado pelo navegador não basta.
function tipoPelosBytes(inicio: Uint8Array): TipoDeFoto | null {
  const texto = (de: number, ate: number) => String.fromCharCode(...inicio.subarray(de, ate));
  if (inicio[0] === 0xff && inicio[1] === 0xd8 && inicio[2] === 0xff) return "image/jpeg";
  if (inicio[0] === 0x89 && texto(1, 4) === "PNG") return "image/png";
  if (texto(0, 4) === "RIFF" && texto(8, 12) === "WEBP") return "image/webp";
  return null;
}

export type FotoConferida = { arquivo: File; tipo: TipoDeFoto } | { erro: string };

/** Confere a foto que veio do formulário antes de guardar. */
export async function conferirFoto(valor: FormDataEntryValue | null): Promise<FotoConferida> {
  if (!(valor instanceof File) || valor.size === 0) return { erro: "Escolha uma foto." };
  if (valor.size > TAMANHO_MAXIMO_FOTO) return { erro: "A foto pode ter até 3 MB." };
  const tipo = tipoPelosBytes(new Uint8Array(await valor.slice(0, 12).arrayBuffer()));
  if (!tipo) return { erro: "Use uma foto JPG, PNG ou WebP." };
  return { arquivo: valor, tipo };
}

/** Guarda a foto com um nome aleatório e devolve o endereço público dela. */
export async function guardarFoto(foto: { arquivo: File; tipo: TipoDeFoto }, pasta: "perfis" | "historias"): Promise<string> {
  const nome = `${pasta}/${randomBytes(12).toString("hex")}.${EXTENSOES[foto.tipo]}`;
  if (usaBlob()) {
    const { url } = await put(nome, foto.arquivo, { access: "public", contentType: foto.tipo });
    return url;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Conecte um Vercel Blob (BLOB_STORE_ID ou BLOB_READ_WRITE_TOKEN) para guardar fotos em produção.");
  }
  const destino = path.join(PASTA_LOCAL, nome);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, Buffer.from(await foto.arquivo.arrayBuffer()));
  return `/enviados/${nome}`;
}

/** Apaga uma foto que deixou de ser usada. Se falhar, no pior caso sobra um arquivo. */
export async function apagarFoto(url: string | null): Promise<void> {
  if (!ehFotoDoSite(url)) return;
  try {
    if (url.startsWith("/enviados/")) await unlink(path.join(PASTA_LOCAL, url.slice("/enviados/".length)));
    else if (usaBlob()) await del(url);
  } catch (erro) {
    console.error("Não foi possível apagar a foto", url, erro);
  }
}
