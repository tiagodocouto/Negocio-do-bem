// O endereço da página de um negócio (/empresas/<endereço>, coluna instagramUsername)
// é o @ do Instagram. Quem não tem Instagram ganha um endereço feito do nome e da
// cidade, com hífens: o Instagram não aceita hífen no @, então os dois tipos nunca
// se confundem. Só depende de src/lib/texto.ts, para os componentes também usarem.

import { normalizarTexto } from "@/lib/texto";

const ENDERECO_SEM_INSTAGRAM = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

/** Se o texto é o endereço de um negócio sem Instagram, como "padaria-do-bairro-recife". */
export function ehEnderecoSemInstagram(texto: unknown): texto is string {
  return typeof texto === "string" && texto.length <= 80 && ENDERECO_SEM_INSTAGRAM.test(texto);
}

/** Se o endereço do negócio é o @ dele no Instagram. */
export function temInstagram(endereco: string): boolean {
  return !endereco.includes("-");
}

/** "@padariadobairro", ou "sem Instagram" para o negócio que não tem. */
export function rotuloDoInstagram(endereco: string): string {
  return temInstagram(endereco) ? `@${endereco}` : "sem Instagram";
}

function palavras(texto: string): string[] {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * O endereço de um negócio sem Instagram: "Padaria do Bairro", em Recife, vira
 * "padaria-do-bairro-recife". A cidade no fim garante o hífen.
 */
export function enderecoSemInstagram(nome: string, cidade: string): string {
  const doNome = palavras(nome).join("-").slice(0, 50).replace(/-+$/, "") || "negocio";
  const daCidade = palavras(cidade).join("-") || "brasil";
  return `${doNome}-${daCidade}`;
}

/** O primeiro endereço livre: o próprio, ou com -2, -3… no fim quando outro negócio já usa. */
export function enderecoLivre(base: string, usados: Iterable<string>): string {
  const ocupados = new Set(usados);
  if (!ocupados.has(base)) return base;
  let numero = 2;
  while (ocupados.has(`${base}-${numero}`)) numero++;
  return `${base}-${numero}`;
}
