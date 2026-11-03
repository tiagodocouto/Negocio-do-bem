// Validação de CNPJ, incluindo o formato alfanumérico que a Receita Federal
// passou a emitir em julho de 2026 (12 caracteres de A-Z/0-9 + 2 dígitos).

export function limparCnpj(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function digitoVerificador(base: string): number {
  const pesos =
    base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  // No CNPJ alfanumérico cada caractere vale seu código ASCII menos 48 (0-9 → 0-9, A → 17...).
  const soma = [...base].reduce((total, c, i) => total + (c.charCodeAt(0) - 48) * pesos[i]!, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(valor: string): boolean {
  const cnpj = limparCnpj(valor);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  const primeiro = digitoVerificador(cnpj.slice(0, 12));
  const segundo = digitoVerificador(cnpj.slice(0, 12) + primeiro);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

export function formatarCnpj(valor: string): string {
  const c = limparCnpj(valor);
  if (c.length !== 14) return valor;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export type DadosCnpj = {
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string | null;
  municipio: string | null;
  uf: string | null;
};

/**
 * Consulta pública na BrasilAPI, para a moderação conferir o nome registrado.
 * Retorna null se a consulta falhar: é só um apoio, nunca bloqueia a análise.
 */
export async function consultarCnpj(valor: string): Promise<DadosCnpj | null> {
  const cnpj = limparCnpj(valor);
  if (!cnpjValido(cnpj)) return null;
  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      // Sem um User-Agent próprio, a BrasilAPI recusa o pedido (403).
      headers: { "User-Agent": "NegocioDoBem/1.0 (+https://github.com/fabs-reis/Negocio-do-bem)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
      razaoSocial: texto(dados.razao_social) ?? "(sem razão social)",
      nomeFantasia: texto(dados.nome_fantasia),
      situacao: texto(dados.descricao_situacao_cadastral),
      municipio: texto(dados.municipio),
      uf: texto(dados.uf),
    };
  } catch {
    return null;
  }
}
