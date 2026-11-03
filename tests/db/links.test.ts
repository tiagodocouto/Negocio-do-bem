import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarLink, enviarLink, LIMITE_LINKS_POR_HORA, lerLink, urlDoLink, usarLink } from "@/lib/auth/links";
import { db } from "@/lib/db";
import { enviarEmail, envioLigado, type Email } from "@/lib/email";
import { ENDERECO_DO_SITE } from "@/lib/seo";

// O envio de verdade é testado em tests/unit/email.test.ts.
vi.mock("@/lib/email", () => ({ envioLigado: vi.fn(() => true), enviarEmail: vi.fn(async () => true) }));

const enviados = () => vi.mocked(enviarEmail).mock.calls.map(([email]) => email as Email);

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "LinkEmail", "Sessao", "Usuario" CASCADE`);
}

async function criarConta(email = "ana@exemplo.com") {
  return db.usuario.create({ data: { nome: "Ana Lúcia Santos", email, senhaHash: "x" }, select: { id: true, nome: true, email: true } });
}

const confirmadoEm = async (id: string) => (await db.usuario.findUniqueOrThrow({ where: { id } })).emailConfirmadoEm;

beforeEach(async () => {
  await limparBanco();
  vi.mocked(enviarEmail).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("criar e usar um link", () => {
  it("guarda só o sha256 do token", async () => {
    const conta = await criarConta();
    const token = await criarLink(conta, "entrar");
    const [link] = await db.linkEmail.findMany();
    expect(token).toBeTruthy();
    expect(link!.id).not.toBe(token);
    expect(link!.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("o link de entrar vale uma vez só e confirma o e-mail", async () => {
    const conta = await criarConta();
    const token = (await criarLink(conta, "entrar", "/indicar"))!;

    expect(await usarLink(token)).toEqual({ finalidade: "entrar", destino: "/indicar", usuario: conta });
    expect(await confirmadoEm(conta.id)).not.toBeNull();
    expect(await usarLink(token)).toBeNull();
  });

  it("o link de confirmar não muda a data de quem já tinha confirmado", async () => {
    const conta = await criarConta();
    const antes = new Date("2026-01-01T12:00:00Z");
    await db.usuario.update({ where: { id: conta.id }, data: { emailConfirmadoEm: antes } });

    expect((await usarLink((await criarLink(conta, "confirmar"))!))?.finalidade).toBe("confirmar");
    expect(await confirmadoEm(conta.id)).toEqual(antes);
  });

  it("olhar o link não usa o link", async () => {
    const conta = await criarConta();
    const token = (await criarLink(conta, "confirmar"))!;

    expect((await lerLink(token))?.usuario.email).toBe("ana@exemplo.com");
    expect(await lerLink(token)).not.toBeNull();
    expect(await confirmadoEm(conta.id)).toBeNull();
  });

  it("link vencido não vale", async () => {
    const conta = await criarConta();
    const token = (await criarLink(conta, "entrar"))!;
    await db.linkEmail.updateMany({ data: { expiraEm: new Date(Date.now() - 1000) } });

    expect(await lerLink(token)).toBeNull();
    expect(await usarLink(token)).toBeNull();
    expect(await confirmadoEm(conta.id)).toBeNull();
  });

  it("o link de entrar vence em 15 minutos e o de confirmar em 24 horas", async () => {
    const conta = await criarConta();
    await criarLink(conta, "entrar");
    await criarLink(conta, "confirmar");
    const links = await db.linkEmail.findMany();
    const duracao = (finalidade: string) => {
      const link = links.find((l) => l.finalidade === finalidade)!;
      return Math.round((link.expiraEm.getTime() - link.criadoEm.getTime()) / 60_000);
    };
    expect(duracao("entrar")).toBe(15);
    expect(duracao("confirmar")).toBe(24 * 60);
  });

  it("não vale depois que a conta troca de e-mail", async () => {
    const conta = await criarConta();
    const token = (await criarLink(conta, "confirmar"))!;
    await db.usuario.update({ where: { id: conta.id }, data: { email: "outro@exemplo.com" } });

    expect(await usarLink(token)).toBeNull();
    expect(await confirmadoEm(conta.id)).toBeNull();
  });

  it("dois cliques ao mesmo tempo usam o link uma vez só", async () => {
    const conta = await criarConta();
    const token = (await criarLink(conta, "entrar"))!;

    const resultados = await Promise.all([usarLink(token), usarLink(token), usarLink(token)]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
  });

  it("token vazio ou desconhecido não vale", async () => {
    await criarConta();
    expect(await lerLink("")).toBeNull();
    expect(await usarLink("token-que-nao-existe")).toBeNull();
  });
});

describe("limite de links por conta", () => {
  it(`manda no máximo ${LIMITE_LINKS_POR_HORA} links por hora`, async () => {
    const conta = await criarConta();
    for (let i = 0; i < LIMITE_LINKS_POR_HORA; i++) expect(await criarLink(conta, i % 2 ? "entrar" : "confirmar")).toBeTruthy();

    expect(await criarLink(conta, "entrar")).toBeNull();
    // O limite é de cada conta: outra pessoa continua recebendo.
    expect(await criarLink(await criarConta("bia@exemplo.com"), "entrar")).toBeTruthy();
  });

  it("os links de mais de uma hora atrás não contam", async () => {
    const conta = await criarConta();
    for (let i = 0; i < LIMITE_LINKS_POR_HORA; i++) await criarLink(conta, "entrar");
    await db.linkEmail.updateMany({ data: { criadoEm: new Date(Date.now() - 61 * 60_000) } });

    expect(await criarLink(conta, "entrar")).toBeTruthy();
  });

  it("apaga os links vencidos há mais de uma hora", async () => {
    const conta = await criarConta();
    await criarLink(conta, "entrar");
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60_000);
    await db.linkEmail.updateMany({ data: { criadoEm: duasHorasAtras, expiraEm: duasHorasAtras } });

    await criarLink(conta, "confirmar");
    expect((await db.linkEmail.findMany()).map((l) => l.finalidade)).toEqual(["confirmar"]);
  });
});

describe("envio do link", () => {
  it("manda para o e-mail da conta o endereço do site com o token", async () => {
    const conta = await criarConta();
    await enviarLink(conta, "confirmar", "abc");

    expect(enviados()).toHaveLength(1);
    expect(enviados()[0]).toMatchObject({ para: "ana@exemplo.com", assunto: "Confirme seu e-mail no Negócio do Bem" });
    expect(enviados()[0]!.texto).toContain(`${ENDERECO_DO_SITE}/api/link?t=abc`);
    expect(enviados()[0]!.texto).toContain("Olá, Ana!");
  });

  it("o e-mail de entrar diz quanto tempo o link vale", async () => {
    await enviarLink(await criarConta(), "entrar", "abc");
    expect(enviados()[0]!.assunto).toBe("Seu link para entrar no Negócio do Bem");
    expect(enviados()[0]!.texto).toContain("15 minutos");
  });

  it("sem envio configurado, fora da produção o link vai para o log", async () => {
    vi.mocked(envioLigado).mockReturnValueOnce(false);
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await enviarLink(await criarConta(), "entrar", "abc");

    expect(enviados()).toHaveLength(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("/api/link?t=abc"));
  });

  it("na produção sem envio configurado, o link não vai para o log", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.mocked(envioLigado).mockReturnValueOnce(false);
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await enviarLink(await criarConta(), "entrar", "abc");

    expect(log).not.toHaveBeenCalled();
  });

  it("nos previews, o link aponta para o próprio preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "negocio-do-bem-git-teste.vercel.app");
    expect(urlDoLink("abc")).toBe("https://negocio-do-bem-git-teste.vercel.app/api/link?t=abc");
  });
});
