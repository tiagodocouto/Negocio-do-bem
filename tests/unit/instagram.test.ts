import { describe, expect, it } from "vitest";
import { normalizarUsername, urlAutorizacao } from "@/lib/instagram";

describe("normalizarUsername", () => {
  it.each([
    ["padariaflor", "padariaflor"],
    ["@PadariaFlor", "padariaflor"],
    ["  @@casa.do_bem ", "casa.do_bem"],
    ["https://www.instagram.com/casa.do_bem/", "casa.do_bem"],
    ["instagram.com/casadobem?igsh=abc123", "casadobem"],
  ])("aceita %j", (entrada, esperado) => {
    expect(normalizarUsername(entrada)).toBe(esperado);
  });

  it.each(["", "@", "com espaço", "acentuação", ".comeca", "termina.", "dois..pontos", "a".repeat(31), "https://instagram.com/p/abc"])(
    "rejeita %j",
    (entrada) => {
      expect(normalizarUsername(entrada)).toBeNull();
    },
  );

  it("rejeita o que não é texto", () => {
    expect(normalizarUsername(undefined)).toBeNull();
    expect(normalizarUsername(123)).toBeNull();
  });
});

describe("urlAutorizacao", () => {
  it("pede só a permissão básica e repassa o estado", () => {
    const url = new URL(
      urlAutorizacao({ appId: "123", appSecret: "s", redirectUri: "https://site.org/api/instagram/retorno" }, "estado-1"),
    );
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://site.org/api/instagram/retorno");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("estado-1");
  });
});
