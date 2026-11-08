// Fotos de cartão-postal das páginas de cidade, do Wikimedia Commons. A lista fica
// em fotos-das-cidades.json, por endereço da cidade ("salvador-ba"), e os arquivos
// em public/fotos/cidades, junto com a prévia do link de cada cidade. Quem escolhe
// a foto preenche "arquivo" e "descricao"; o npm run cidades:fotos baixa a foto,
// faz a prévia e preenche o resto (ver o script).

import dados from "@/lib/fotos-das-cidades.json";
import { slugCidade } from "@/lib/diretorio";

/** Uma cidade em fotos-das-cidades.json. */
export type FotoGravada = {
  cidade: string;
  uf: string;
  /** O arquivo no Commons, como "File:Farol da Barra.jpg". */
  arquivo: string;
  /** O que a foto mostra. Vira o texto alternativo. */
  descricao: string;
  /** O nome dos arquivos em public/fotos/cidades, sem o ".jpg". Muda junto com o arquivo do Commons. */
  foto: string;
  /** O nome da prévia do link, sem o ".jpg". Muda junto com a imagem. */
  previa: string;
  autor: string;
  licenca: string;
  licencaUrl: string | null;
  /** Tamanho da foto grande. A pequena tem metade da largura. */
  largura: number;
  altura: number;
};

export type FotoDaCidade = {
  src: string;
  /** A versão para telas pequenas, com metade da largura. */
  srcPequena: string;
  /** A prévia do link: a foto com o logo e o nome da cidade, em 1200×630. */
  previa: string;
  largura: number;
  altura: number;
  alt: string;
  autor: string;
  licenca: string;
  licencaUrl: string | null;
  /** A página da foto no Commons, com o autor e a licença completos. */
  pagina: string;
};

export const PASTA_DAS_FOTOS = "/fotos/cidades";
export const LARGURA_DA_FOTO = 1280;
export const LARGURA_DA_FOTO_PEQUENA = 800;

const FOTOS = dados as Record<string, FotoGravada>;

/** Só fotos que podemos mostrar dando o crédito: domínio público, CC0, CC BY e CC BY-SA. */
export function licencaAceita(licenca: string): boolean {
  return /^(public domain|domínio público|pd\b|cc0|cc by(-sa)? \d)/i.test(licenca.trim());
}

export function paginaNoCommons(arquivo: string): string {
  const nome = arquivo.replace(/^File:/, "").replaceAll(" ", "_");
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(nome)}`;
}

/** A foto de uma cidade, pelo nome oficial e pela UF, ou null quando ela ainda não tem. */
export function fotoDaCidade(cidade: string, uf: string): FotoDaCidade | null {
  const gravada = FOTOS[slugCidade(cidade, uf)];
  if (!gravada) return null;
  return {
    src: `${PASTA_DAS_FOTOS}/${gravada.foto}.jpg`,
    srcPequena: `${PASTA_DAS_FOTOS}/${gravada.foto}-${LARGURA_DA_FOTO_PEQUENA}.jpg`,
    previa: `${PASTA_DAS_FOTOS}/${gravada.previa}.jpg`,
    largura: gravada.largura,
    altura: gravada.altura,
    alt: gravada.descricao,
    autor: gravada.autor,
    licenca: gravada.licenca,
    licencaUrl: gravada.licencaUrl,
    pagina: paginaNoCommons(gravada.arquivo),
  };
}
