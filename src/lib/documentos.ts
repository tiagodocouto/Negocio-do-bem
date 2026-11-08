import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Documentos de identidade (RG ou CNH) da verificação do negócio (#293). Ficam num bucket R2
// PRIVADO (binding DOCUMENTOS), sem domínio público: só a rota da moderação os lê. Nunca no
// bucket das fotos. Em desenvolvimento, ficam numa pasta fora de `public/`.

export const TAMANHO_MAXIMO_DOCUMENTO = 5 * 1024 * 1024;
export const MAXIMO_DE_ARQUIVOS = 2;

export type TipoDeDocumento = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
const EXTENSOES: Record<TipoDeDocumento, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const TIPOS = Object.fromEntries(Object.entries(EXTENSOES).map(([tipo, extensao]) => [extensao, tipo])) as Record<string, TipoDeDocumento>;

type BucketDeDocumentos = {
  put(chave: string, conteudo: Blob, opcoes: { httpMetadata: { contentType: string } }): Promise<unknown>;
  get(chave: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(chaves: string | string[]): Promise<void>;
};

// DOCUMENTOS_PASTA (lida em tempo de execução, nunca definida no Worker) tem precedência: os testes e o
// desenvolvimento guardam numa pasta, mesmo com NEXT_PUBLIC_R2_PUBLIC_URL embutida pelo build.
const usaBucket = () => !process.env.DOCUMENTOS_PASTA && Boolean(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
const pastaLocal = () => process.env.DOCUMENTOS_PASTA ?? path.join(process.cwd(), ".documentos-privados");

function bucket(): BucketDeDocumentos {
  const conectado = (getCloudflareContext().env as unknown as { DOCUMENTOS?: BucketDeDocumentos }).DOCUMENTOS;
  if (!conectado) throw new Error("O bucket R2 DOCUMENTOS não está conectado a este Worker.");
  return conectado;
}

/** Primeiros bytes de cada formato: o tipo informado pelo navegador não basta. */
function tipoPelosBytes(inicio: Uint8Array): TipoDeDocumento | null {
  const texto = (de: number, ate: number) => String.fromCharCode(...inicio.subarray(de, ate));
  if (inicio[0] === 0xff && inicio[1] === 0xd8 && inicio[2] === 0xff) return "image/jpeg";
  if (inicio[0] === 0x89 && texto(1, 4) === "PNG") return "image/png";
  if (texto(0, 4) === "RIFF" && texto(8, 12) === "WEBP") return "image/webp";
  if (texto(0, 5) === "%PDF-") return "application/pdf";
  return null;
}

export type DocumentoConferido = { arquivo: File; tipo: TipoDeDocumento };

/** Confere os arquivos do formulário: de 1 a 2, até 5 MB cada, JPG, PNG, WebP ou PDF. */
export async function conferirDocumentos(valores: FormDataEntryValue[]): Promise<{ documentos: DocumentoConferido[] } | { erro: string }> {
  const arquivos = valores.filter((valor): valor is File => valor instanceof File && valor.size > 0);
  if (arquivos.length === 0) return { erro: "Envie a foto do seu RG ou da sua CNH." };
  if (arquivos.length > MAXIMO_DE_ARQUIVOS) return { erro: "Envie no máximo 2 arquivos: a frente e o verso." };
  const documentos: DocumentoConferido[] = [];
  for (const arquivo of arquivos) {
    if (arquivo.size > TAMANHO_MAXIMO_DOCUMENTO) return { erro: "Cada arquivo pode ter até 5 MB." };
    const tipo = tipoPelosBytes(new Uint8Array(await arquivo.slice(0, 12).arrayBuffer()));
    if (!tipo) return { erro: "Use uma foto JPG, PNG ou WebP, ou um PDF." };
    documentos.push({ arquivo, tipo });
  }
  return { documentos };
}

/** Guarda o documento com um nome aleatório e devolve a chave dele. A chave não leva a nenhum endereço público. */
export async function guardarDocumento(documento: DocumentoConferido): Promise<string> {
  const chave = `${randomBytes(16).toString("hex")}.${EXTENSOES[documento.tipo]}`;
  if (usaBucket()) {
    await bucket().put(chave, documento.arquivo, { httpMetadata: { contentType: documento.tipo } });
    return chave;
  }
  if (process.env.NODE_ENV === "production" && !process.env.DOCUMENTOS_PASTA) {
    throw new Error("Configure NEXT_PUBLIC_R2_PUBLIC_URL e o binding R2 DOCUMENTOS para guardar documentos em produção.");
  }
  await mkdir(pastaLocal(), { recursive: true });
  await writeFile(path.join(pastaLocal(), chave), Buffer.from(await documento.arquivo.arrayBuffer()));
  return chave;
}

/** Lê um documento. Só a rota da moderação chama isto. */
export async function lerDocumento(chave: string): Promise<{ conteudo: ArrayBuffer | Uint8Array; tipo: TipoDeDocumento } | null> {
  const tipo = TIPOS[chave.split(".").pop() ?? ""];
  if (!tipo || !/^[0-9a-f]{32}\.[a-z]{3,4}$/.test(chave)) return null;
  try {
    if (usaBucket()) {
      const objeto = await bucket().get(chave);
      return objeto ? { conteudo: await objeto.arrayBuffer(), tipo } : null;
    }
    return { conteudo: await readFile(path.join(pastaLocal(), chave)), tipo };
  } catch {
    return null;
  }
}

/** Apaga documentos. Se falhar, no pior caso sobra um arquivo sem nenhuma linha no banco apontando para ele. */
export async function apagarDocumentosGuardados(chaves: string[]): Promise<void> {
  const validas = chaves.filter((chave) => /^[0-9a-f]{32}\.[a-z]{3,4}$/.test(chave));
  if (validas.length === 0) return;
  try {
    if (usaBucket()) await bucket().delete(validas);
    else await Promise.all(validas.map((chave) => unlink(path.join(pastaLocal(), chave)).catch(() => undefined)));
  } catch (erro) {
    console.error("Não foi possível apagar documentos", validas.length, erro);
  }
}
