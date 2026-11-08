// CPF: validação, máscara e a comparação com o CPF mascarado que a Receita mostra dos sócios.
// O site nunca guarda o CPF inteiro: só a versão mascarada, como a Receita a publica.

export function limparCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

function digito(base: string): number {
  const soma = [...base].reduce((total, c, i) => total + Number(c) * (base.length + 1 - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function cpfValido(valor: string): boolean {
  const cpf = limparCpf(valor);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const primeiro = digito(cpf.slice(0, 9));
  const segundo = digito(cpf.slice(0, 9) + primeiro);
  return cpf.endsWith(`${primeiro}${segundo}`);
}

/** "123.456.789-09" vira "***.456.789-**": só os 6 dígitos do meio, como a Receita mostra dos sócios. */
export function mascararCpf(valor: string): string {
  const cpf = limparCpf(valor);
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

/** Os 6 dígitos do meio de um CPF mascarado ("***.456.789-**" ou "***456789**"), ou null. */
export function miolo(mascarado: string | null | undefined): string | null {
  const digitos = (mascarado ?? "").replace(/\D/g, "");
  return digitos.length === 6 ? digitos : null;
}
