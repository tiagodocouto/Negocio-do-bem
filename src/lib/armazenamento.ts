import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ehFotoDoSite, TAMANHO_MAXIMO_FOTO, type TipoDeFoto } from "@/lib/fotos";

// Em produção, UPLOADS é um binding R2 e NEXT_PUBLIC_R2_PUBLIC_URL é o domínio
// público conectado ao bucket. Em desenvolvimento, as fotos ficam no disco.
const PASTA_LOCAL = path.join(process.cwd(), "public", "enviados");

export const usaArmazenamentoCloudflare = () => Boolean(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);

type BucketDeUploads = {
  put(chave: string, conteudo: Blob, opcoes: { httpMetadata: { contentType: string } }): Promise<unknown>;
  delete(chave: string): Promise<void>;
};

function bucketDeUploads(): BucketDeUploads | undefined {
  return (getCloudflareContext().env as unknown as { UPLOADS?: BucketDeUploads }).UPLOADS;
}

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
  if (usaArmazenamentoCloudflare()) {
    const bucket = bucketDeUploads();
    if (!bucket) throw new Error("O bucket R2 UPLOADS não está conectado a este Worker.");
    // O File vai inteiro: o R2 só aceita stream de tamanho conhecido.
    await bucket.put(nome, foto.arquivo, { httpMetadata: { contentType: foto.tipo } });
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, "")}/${nome}`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Configure NEXT_PUBLIC_R2_PUBLIC_URL e o binding R2 UPLOADS para guardar fotos em produção.");
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
    else if (usaArmazenamentoCloudflare() && url.startsWith(`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, "")}/`)) {
      const bucket = bucketDeUploads();
      if (bucket) await bucket.delete(new URL(url).pathname.slice(1));
    }
  } catch (erro) {
    console.error("Não foi possível apagar a foto", url, erro);
  }
}
