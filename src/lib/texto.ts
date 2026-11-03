/** Minúsculo e sem acentos, para comparar e buscar ("São Paulo" → "sao paulo"). */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function textoDeBusca(empresa: {
  nome: string;
  resumo: string;
  categoria: string;
  cidade: string;
  uf: string;
  instagramUsername: string;
}): string {
  return normalizarTexto(
    [
      empresa.nome,
      empresa.resumo,
      empresa.categoria,
      empresa.cidade,
      empresa.uf,
      empresa.instagramUsername,
    ].join(" "),
  );
}

export function iniciais(nome: string): string {
  const palavras = nome
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const letras = palavras.length > 1 ? [palavras[0], palavras[palavras.length - 1]] : palavras;
  return letras.map((p) => p[0]!.toUpperCase()).join("").slice(0, 2) || "?";
}

/** Minutos de leitura de um texto em Markdown, a 200 palavras por minuto (no mínimo 1). */
export function tempoDeLeitura(markdown: string): number {
  const palavras = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\]\([^)]*\)/g, " ")
    .replace(/[#>*_~`[\]-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}

/** "Recife, PE": como o campo de cidade mostra a cidade escolhida. */
export function formatarMunicipio(cidade: string, uf: string): string {
  return `${cidade}, ${uf}`;
}

/** "5511991488052" → "(11) 99148-8052". Serve para o WhatsApp e o telefone comercial. */
export function formatarTelefone(digitos: string): string {
  const local = digitos.replace(/^55/, "");
  const ddd = local.slice(0, 2);
  const numero = local.slice(2);
  const corte = numero.length - 4;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

export function formatarData(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(data);
}

/** "29/10/2026", no horário de Brasília. */
export function formatarDataCurta(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(data);
}

/** "29/10": dia e mês, no horário de Brasília. */
export function formatarDiaMes(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(data);
}

export function formatarDataHora(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}
