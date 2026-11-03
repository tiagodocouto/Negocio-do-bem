import { ImageResponse } from "next/og";
import { FONTES, ImagemDoSite, TAMANHO } from "@/lib/compartilhamento";
import { cidadeDoSlug } from "@/lib/consultas";
import { PreviaDaCidade } from "@/lib/previa-da-cidade";

// Prévia do link de uma cidade sem foto: "Negócios do bem em Araraquara, SP" e
// quantos negócios há, no creme da marca. A cidade com foto não usa esta imagem:
// a página aponta para a prévia em JPEG feita pelo npm run cidades:fotos, porque
// a foto num PNG passa de 1 MB, e o WhatsApp não mostra prévia acima de 600 KB.
// Endereço sem cidade no diretório leva a imagem geral do site.
export const alt = "Negócios do bem de uma cidade, no Negócio do Bem";
export const size = TAMANHO;
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ cidade: string }> }) {
  const cidade = await cidadeDoSlug((await params).cidade);
  if (!cidade) return new ImageResponse(<ImagemDoSite />, { ...TAMANHO, fonts: FONTES });

  const quantos = `${cidade.total.toLocaleString("pt-BR")} ${cidade.total === 1 ? "negócio" : "negócios"} no diretório`;
  return new ImageResponse(<PreviaDaCidade nome={`${cidade.cidade}, ${cidade.uf}`} quantos={quantos} />, { ...TAMANHO, fonts: FONTES });
}
