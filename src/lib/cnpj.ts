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

export type SocioCnpj = { nome: string; qualificacao: string | null; cpfMascarado: string | null };

export type DadosCnpj = {
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string | null;
  municipio: string | null;
  uf: string | null;
  /** O quadro de sócios e administradores. Vem vazio no MEI: o nome da pessoa fica na razão social. */
  socios: SocioCnpj[];
  /** O telefone e o e-mail que a Receita tem, quando tem. Servem para a moderação falar com o negócio. */
  telefone: string | null;
  email: string | null;
};

/**
 * Consulta pública na BrasilAPI, para a moderação conferir o nome registrado e os sócios.
 * Retorna null se a consulta falhar. Na reivindicação é só um apoio e nunca bloqueia a
 * análise; na liberação para o Clube do Bem, sem a consulta não há liberação.
 */
export async function consultarCnpj(valor: string): Promise<DadosCnpj | null> {
  const resultado = await buscarNaReceita(valor);
  return resultado === "nao_encontrado" ? null : resultado;
}

/**
 * Como `consultarCnpj`, mas separa o CNPJ que a Receita não tem ("nao_encontrado", o 404 da
 * BrasilAPI) da consulta que falhou (null). Serve para recusar na hora o pedido do Clube do
 * Bem com um CNPJ que não existe, sem barrar quem pediu enquanto a BrasilAPI estava fora.
 */
export async function buscarNaReceita(valor: string): Promise<DadosCnpj | "nao_encontrado" | null> {
  const cnpj = limparCnpj(valor);
  if (!cnpjValido(cnpj)) return null;
  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      // Sem um User-Agent próprio, a BrasilAPI recusa o pedido (403).
      headers: { "User-Agent": "NegocioDoBem/1.0 (+https://github.com/fabs-reis/Negocio-do-bem)" },
      signal: AbortSignal.timeout(5000),
    });
    if (resposta.status === 404) return "nao_encontrado";
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
      razaoSocial: texto(dados.razao_social) ?? "(sem razão social)",
      nomeFantasia: texto(dados.nome_fantasia),
      situacao: texto(dados.descricao_situacao_cadastral),
      municipio: texto(dados.municipio),
      uf: texto(dados.uf),
      socios: (Array.isArray(dados.qsa) ? (dados.qsa as Record<string, unknown>[]) : [])
        .map((socio) => ({
          nome: texto(socio.nome_socio),
          qualificacao: texto(socio.qualificacao_socio),
          // A Receita mostra do sócio pessoa física só os 6 dígitos do meio ("***325350**").
          cpfMascarado: texto(socio.cnpj_cpf_do_socio),
        }))
        .filter((socio): socio is SocioCnpj => socio.nome !== null),
      telefone: texto(dados.ddd_telefone_1),
      email: texto(dados.email)?.toLowerCase() ?? null,
    };
  } catch {
    return null;
  }
}
