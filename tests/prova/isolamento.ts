export function conferirDestino(valor: string | undefined, esperado: string): void {
  if (!valor || valor !== esperado) throw new Error("Local proof database target does not match.");
  const url = new URL(valor);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || !url.port || url.port === "5433") {
    throw new Error("Local proof database target is not isolated.");
  }
  if (!/^\/ndb_auth_test_[a-f0-9]+$/.test(url.pathname) || !url.password || url.search || url.hash) {
    throw new Error("Local proof database configuration is not valid.");
  }
}

export function limparSaida(texto: string, segredos: string[]): string {
  let limpo = texto.replace(/postgres(?:ql)?:\/\/[^\s"'<>]*/gi, "[database URL removed]");
  limpo = limpo.replace(/^.*(?:set-cookie|cookie:|session_token|ndb_sessao|BETTER_AUTH_SECRET|DATABASE_URL|\[e-mail desligado\].*Link para|Todas as contas usam a senha).*$/gim, "[authentication value removed]");
  for (const segredo of segredos) limpo = limpo.replaceAll(segredo, "[secret removed]");
  return limpo;
}
