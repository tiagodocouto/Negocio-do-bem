import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enviarEmail, envioLigado } from "@/lib/email";

const email = { para: "dona@exemplo.com", assunto: "Assunto", texto: "Texto do aviso" };

function configurar(variaveis: Record<string, string>) {
  for (const [nome, valor] of Object.entries(variaveis)) vi.stubEnv(nome, valor);
}

let fetchFalso: ReturnType<typeof vi.fn>;

beforeEach(() => {
  configurar({ RESEND_API_KEY: "", EMAIL_REMETENTE: "", EMAIL_RESPOSTA: "", VERCEL_ENV: "" });
  fetchFalso = vi.fn(async () => new Response(JSON.stringify({ id: "abc" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchFalso);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("envioLigado", () => {
  it("fica desligado sem a chave ou sem o remetente", () => {
    expect(envioLigado()).toBe(false);
    configurar({ RESEND_API_KEY: "re_teste" });
    expect(envioLigado()).toBe(false);
    configurar({ RESEND_API_KEY: "", EMAIL_REMETENTE: "Negócio do Bem <avisos@exemplo.com>" });
    expect(envioLigado()).toBe(false);
  });

  it("liga com a chave e o remetente, no computador e na produção", () => {
    configurar({ RESEND_API_KEY: "re_teste", EMAIL_REMETENTE: "Negócio do Bem <avisos@exemplo.com>" });
    expect(envioLigado()).toBe(true);
    configurar({ VERCEL_ENV: "production" });
    expect(envioLigado()).toBe(true);
  });

  it("fica desligado nos previews do Vercel, mesmo configurado", () => {
    configurar({ RESEND_API_KEY: "re_teste", EMAIL_REMETENTE: "Negócio do Bem <avisos@exemplo.com>", VERCEL_ENV: "preview" });
    expect(envioLigado()).toBe(false);
  });
});

describe("enviarEmail", () => {
  it("não chama o Resend quando o envio está desligado", async () => {
    expect(await enviarEmail(email)).toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("manda o e-mail para uma pessoa só, com remetente e resposta", async () => {
    configurar({
      RESEND_API_KEY: "re_teste",
      EMAIL_REMETENTE: "Negócio do Bem <avisos@exemplo.com>",
      EMAIL_RESPOSTA: "ola@exemplo.com",
    });
    expect(await enviarEmail(email)).toBe(true);

    expect(fetchFalso).toHaveBeenCalledOnce();
    const [url, opcoes] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(opcoes.headers).get("Authorization")).toBe("Bearer re_teste");
    expect(JSON.parse(opcoes.body as string)).toEqual({
      from: "Negócio do Bem <avisos@exemplo.com>",
      to: ["dona@exemplo.com"],
      reply_to: "ola@exemplo.com",
      subject: "Assunto",
      text: "Texto do aviso",
    });
  });

  it("sem EMAIL_RESPOSTA, não manda o reply_to", async () => {
    configurar({ RESEND_API_KEY: "re_teste", EMAIL_REMETENTE: "avisos@exemplo.com" });
    await enviarEmail(email);
    const [, opcoes] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(opcoes.body as string)).not.toHaveProperty("reply_to");
  });

  it("não lança erro quando o Resend recusa ou a rede falha", async () => {
    configurar({ RESEND_API_KEY: "re_teste", EMAIL_REMETENTE: "avisos@exemplo.com" });

    fetchFalso.mockResolvedValueOnce(new Response("domínio não verificado", { status: 403 }));
    expect(await enviarEmail(email)).toBe(false);

    fetchFalso.mockRejectedValueOnce(new Error("sem rede"));
    expect(await enviarEmail(email)).toBe(false);
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
