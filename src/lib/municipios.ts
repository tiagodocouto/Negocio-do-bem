// Municípios do Brasil, da lista do IBGE em municipios.json (npm run municipios:atualizar).
// O servidor usa este módulo para validar a cidade; o campo de cidade o carrega só
// quando a pessoa começa a digitar, para a lista não pesar nas outras páginas.

import dados from "@/lib/municipios.json";
import { normalizarTexto } from "@/lib/texto";

export type Municipio = { nome: string; uf: string };

/** Uma sugestão do campo de cidade; `inicio` e `fim` marcam o trecho que bateu com o que foi digitado. */
export type SugestaoMunicipio = Municipio & { inicio: number; fim: number };

const MUNICIPIOS = Object.entries(dados as Record<string, string[]>).flatMap(([uf, nomes]) =>
  nomes.map((nome) => ({ nome, uf, busca: normalizarTexto(nome) })),
);

/** Hífen e apóstrofo (de qualquer tipo) valem espaço: "São João del-Rei" bate com "São João del Rei". */
const chaveDeCidade = (nome: string) => normalizarTexto(nome.replace(/[-'’‘`´]/g, " "));

const NOME_OFICIAL = new Map(MUNICIPIOS.map((m) => [`${chaveDeCidade(m.nome)}|${m.uf}`, m.nome]));

/**
 * O nome oficial de uma cidade gravada com outra grafia ("Florianopolis", "SC" → "Florianópolis"),
 * sem diferenciar acentos, maiúsculas, espaços, hífen e apóstrofo. Aceita a UF da própria
 * cidade grudada no fim ("Tubarão-SC"). Null quando ela não está na lista.
 */
export function nomeOficial(cidade: string, uf: string): string | null {
  const chave = chaveDeCidade(cidade);
  const comUf = /^(.+?)[\s,/]+([a-z]{2})$/.exec(chave);
  const semUf = comUf && comUf[2] === uf.toLowerCase() ? comUf[1] : null;
  return NOME_OFICIAL.get(`${chave}|${uf}`) ?? (semUf ? NOME_OFICIAL.get(`${semUf}|${uf}`) : undefined) ?? null;
}

/**
 * Separa nome e UF de "Recife, PE", "Recife/PE", "Recife - PE" ou "Recife PE".
 * Só aceita a UF quando existe uma cidade com aquele nome nela: assim "Sento Sé"
 * continua sendo a cidade da Bahia, e não "Sento" em Sergipe.
 */
function separarUf(texto: string): { busca: string; uf?: string } {
  const partes = /^(.+?)\s*(?:,|\/|\s-|\s)\s*([a-z]{2})$/.exec(texto);
  if (partes) {
    const uf = partes[2]!.toUpperCase();
    if (MUNICIPIOS.some((m) => m.uf === uf && m.busca === partes[1])) return { busca: partes[1]!, uf };
  }
  return { busca: texto };
}

/**
 * Os municípios que correspondem ao texto do campo de cidade, sem diferenciar
 * acentos e maiúsculas. Uma resposta só quando o texto traz a UF ou quando o nome
 * não se repete em outro estado; mais de uma quando o nome existe em vários estados.
 */
export function interpretarMunicipio(texto: string): Municipio[] {
  const { busca, uf } = separarUf(normalizarTexto(texto));
  return MUNICIPIOS.filter((m) => m.busca === busca && (!uf || m.uf === uf)).map((m) => ({ nome: m.nome, uf: m.uf }));
}

/** O município do campo de cidade, ou o erro que o formulário mostra. Vale no navegador e no servidor. */
export function conferirMunicipio(texto: string): { municipio: Municipio } | { erro: string } {
  if (!texto.trim()) return { erro: "Em que cidade fica? Digite e escolha na lista." };
  const achados = interpretarMunicipio(texto);
  if (achados.length === 1) return { municipio: achados[0]! };
  if (achados.length > 1) {
    return { erro: `Existe mais de uma cidade chamada ${achados[0]!.nome}. Escolha na lista a do estado certo.` };
  }
  return { erro: "Escolha a cidade na lista. Se ela não aparecer, confira a grafia." };
}

/**
 * Sugestões enquanto a pessoa digita: primeiro os nomes que começam com o texto,
 * depois os que têm uma palavra começando com ele, depois o resto, em ordem alfabética.
 */
export function sugerirMunicipios(texto: string, limite = 8): SugestaoMunicipio[] {
  const { busca, uf } = separarUf(normalizarTexto(texto));
  if (busca.length < 2) return [];
  const achados: (SugestaoMunicipio & { nivel: number })[] = [];
  for (const m of MUNICIPIOS) {
    if (uf && m.uf !== uf) continue;
    const inicio = m.busca.indexOf(busca);
    if (inicio < 0) continue;
    const antes = m.busca[inicio - 1];
    const nivel = inicio === 0 ? 0 : antes === " " || antes === "-" || antes === "'" ? 1 : 2;
    // Tirar os acentos não muda o tamanho do nome, então o trecho vale para o nome original.
    achados.push({ nome: m.nome, uf: m.uf, inicio, fim: inicio + busca.length, nivel });
  }
  return achados
    .sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, "pt-BR") || a.uf.localeCompare(b.uf))
    .slice(0, limite)
    .map(({ nome, uf, inicio, fim }) => ({ nome, uf, inicio, fim }));
}
