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

/** Fecha a frase com ponto, sem dobrar: "O contato mudou" e "O contato mudou." viram "O contato mudou.". */
export function comPontoFinal(texto: string): string {
  const limpo = texto.trim();
  return !limpo || /[.!?…]$/.test(limpo) ? limpo : `${limpo}.`;
}

/** "Ninguém favoritou ainda", "1 pessoa favoritou", "1.234 pessoas favoritaram". */
export function formatarFavoritos(total: number): string {
  if (total === 0) return "Ninguém favoritou ainda";
  return total === 1 ? "1 pessoa favoritou" : `${total.toLocaleString("pt-BR")} pessoas favoritaram`;
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

/** "Termina em 3 dias e 4 h"; nas últimas 24 horas, "Termina em 3 h 12 min"; depois, "Terminou". */
export function textoDoPrazo(fim: Date, agora: Date): string {
  const minutos = Math.floor((fim.getTime() - agora.getTime()) / 60_000);
  if (minutos <= 0) return "Terminou";
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  if (dias > 0) return `Termina em ${dias} ${dias === 1 ? "dia" : "dias"}${horas ? ` e ${horas} h` : ""}`;
  if (horas > 0) return `Termina em ${horas} h${minutos % 60 ? ` ${minutos % 60} min` : ""}`;
  return `Termina em ${minutos} min`;
}
