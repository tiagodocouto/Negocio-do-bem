import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configGoogle, lerIdToken, urlAutorizacao } from "@/lib/auth/google";

const CLIENTE = "cliente.apps.googleusercontent.com";
const AGORA = Date.parse("2026-10-31T12:00:00Z");

/** id_token como o Google manda: cabeçalho, dados e assinatura em base64url. A assinatura não é lida. */
function idToken(campos: Record<string, unknown> = {}) {
  const parte = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString("base64url");
  const dados = {
    iss: "https://accounts.google.com",
    aud: CLIENTE,
    exp: AGORA / 1000 + 3600,
    sub: "1098765",
    email: "Ana.Lucia@Gmail.com",
    email_verified: true,
    name: "Ana Lúcia Santos",
    ...campos,
  };
  return [parte({ alg: "RS256", typ: "JWT" }), parte(dados), "assinatura"].join(".");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("lerIdToken", () => {
  it("lê a conta, o e-mail em minúsculas e o nome", () => {
    expect(lerIdToken(idToken(), CLIENTE, AGORA)).toEqual({
      sub: "1098765",
      email: "ana.lucia@gmail.com",
      emailVerificado: true,
      nome: "Ana Lúcia Santos",
    });
  });

  it("aceita o emissor sem https e o email_verified como texto", () => {
    const perfil = lerIdToken(idToken({ iss: "accounts.google.com", email_verified: "true" }), CLIENTE, AGORA);
    expect(perfil.emailVerificado).toBe(true);
  });

  it("e-mail não verificado vem marcado", () => {
    expect(lerIdToken(idToken({ email_verified: false }), CLIENTE, AGORA).emailVerificado).toBe(false);
    expect(lerIdToken(idToken({ email_verified: undefined }), CLIENTE, AGORA).emailVerificado).toBe(false);
  });

  it("sem nome, usa o primeiro nome; sem os dois, o começo do e-mail", () => {
    expect(lerIdToken(idToken({ name: undefined, given_name: "Ana" }), CLIENTE, AGORA).nome).toBe("Ana");
    expect(lerIdToken(idToken({ name: " ", given_name: undefined }), CLIENTE, AGORA).nome).toBe("ana.lucia");
  });

  it("corta o nome em 80 caracteres", () => {
    expect(lerIdToken(idToken({ name: "A".repeat(120) }), CLIENTE, AGORA).nome).toHaveLength(80);
  });

  it.each([
    ["de outro emissor", { iss: "https://outro.exemplo.com" }],
    ["emitido para outro app", { aud: "outro.apps.googleusercontent.com" }],
    ["vencido", { exp: AGORA / 1000 - 1 }],
    ["sem validade", { exp: undefined }],
    ["sem a conta", { sub: undefined }],
    ["sem o e-mail", { email: undefined }],
    ["com e-mail inválido", { email: "sem-arroba" }],
  ])("recusa o id_token %s", (_caso, campos) => {
    expect(() => lerIdToken(idToken(campos), CLIENTE, AGORA)).toThrow();
  });

  it.each(["", "a.b", "a.%%%.c", `a.${Buffer.from("[1,2]").toString("base64url")}.c`])("recusa o formato %j", (token) => {
    expect(() => lerIdToken(token, CLIENTE, AGORA)).toThrow();
  });
});

describe("configGoogle", () => {
  it("sem o cliente, o segredo ou o APP_URL, fica desligado", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", CLIENTE);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "segredo");
    vi.stubEnv("APP_URL", "");
    expect(configGoogle()).toBeNull();
  });

  it("monta a URI de retorno a partir do APP_URL, sem barra repetida", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", CLIENTE);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "segredo");
    vi.stubEnv("APP_URL", "https://www.negociodobem.com/");
    expect(configGoogle()?.redirectUri).toBe("https://www.negociodobem.com/api/google/retorno");
  });
});

describe("urlAutorizacao", () => {
  it("pede só openid, e-mail e perfil, com state e o desafio do PKCE", () => {
    const config = { clientId: CLIENTE, clientSecret: "segredo", redirectUri: "https://site.exemplo/api/google/retorno" };
    const url = new URL(urlAutorizacao(config, "estado-123", "verificador-456"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENTE,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: "estado-123",
      code_challenge: createHash("sha256").update("verificador-456").digest("base64url"),
      code_challenge_method: "S256",
    });
    expect(url.searchParams.has("client_secret")).toBe(false);
  });
});
