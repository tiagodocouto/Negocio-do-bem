import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cadastrar, concluirCadastroGoogle, entrar } from "@/acoes/conta";
import { contaDoGoogle, guardarCadastroGoogle, COOKIE_CADASTRO_GOOGLE } from "@/lib/auth/google";
import { criarLink, redefinirSenhaComLink } from "@/lib/auth/links";
import { gerarHashSenha } from "@/lib/auth/senha";
import { criarSessao, usuarioAtual } from "@/lib/auth/sessao";
import { authParaContaValidada } from "@/lib/auth/ponte-sessao";
import { criarAuth } from "@/lib/auth/better-auth";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { LIMITE_POR_IP, LIMITE_POR_EMAIL } from "@/lib/auth/tentativas";
import { db } from "@/lib/db";

const contexto = vi.hoisted(() => ({ cookies: new Map<string, string>(), headers: { "cf-connecting-ip": "203.0.113.7", "user-agent": "proof-browser" } as Record<string, string> }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(contexto.headers),
  cookies: async () => ({
    get: (nome: string) => contexto.cookies.has(nome) ? { value: contexto.cookies.get(nome)! } : undefined,
    getAll: () => [...contexto.cookies].map(([name, value]) => ({ name, value })),
    set: (nome: string, valor: string) => contexto.cookies.set(nome, valor),
    delete: (valor: string | { name: string }) => contexto.cookies.delete(typeof valor === "string" ? valor : valor.name),
    toString: () => [...contexto.cookies].map(([n, v]) => `${n}=${v}`).join("; "),
  }),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error("not-found"); } }));
vi.mock("next/server", () => ({ after: () => undefined }));

const antiga = "senha-antiga-123";
const nova = "senha-nova-456";
function formulario(email: string, senha = antiga) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries({ email, senha, nome: "Pessoa da prova", telefone: "11991488052", voltar: "/painel" })) dados.set(nome, valor);
  return dados;
}
async function conta(email = "pessoa@example.test") {
  return db.usuario.create({ data: { email, nome: "Pessoa da prova", senhaHash: await gerarHashSenha(antiga) } });
}

beforeEach(async () => {
  contexto.cookies.clear();
  contexto.headers = { "cf-connecting-ip": "203.0.113.7", "user-agent": "proof-browser" };
  vi.stubEnv("CLOUDFLARE_DEPLOY", "1");
  await db.$executeRawUnsafe('TRUNCATE "Usuario", "TentativaAcesso" CASCADE');
});
afterEach(() => vi.unstubAllEnvs());
afterAll(() => db.$disconnect());

describe("real Better Auth path", () => {
  it("creates signed sessions with fixed expiry and no client metadata", async () => {
    const usuario = await conta();
    await criarSessao(usuario.id);
    const sessao = await db.sessao.findFirstOrThrow({ where: { usuarioId: usuario.id } });
    expect(sessao.token).toBeTypeOf("string");
    expect(sessao.ip).toBeNull();
    expect(sessao.userAgent).toBeNull();
    expect(sessao.expiraEm.getTime() - sessao.criadoEm.getTime()).toBeCloseTo(2592000000, -3);
    const cookie = contexto.cookies.get("ndb_sessao");
    expect(typeof cookie === "string" && decodeURIComponent(cookie).includes(".")).toBe(true);
    expect((await usuarioAtual())?.id).toBe(usuario.id);
    contexto.cookies.set("ndb_sessao", sessao.token!);
    expect(await usuarioAtual()).toBeNull();
  });
  it("does not refresh sessions after updateAge and reads role changes immediately", async () => {
    const usuario = await conta();
    await criarSessao(usuario.id);
    const antes = await db.sessao.findFirstOrThrow();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 3 * 24 * 60 * 60 * 1000);
      expect((await usuarioAtual())?.id).toBe(usuario.id);
      await db.usuario.update({ where: { id: usuario.id }, data: { papel: "moderador" } });
      expect((await usuarioAtual())?.moderador).toBe(true);
      const depois = await db.sessao.findUniqueOrThrow({ where: { id: antes.id } });
      expect(depois.expiraEm).toEqual(antes.expiraEm);
      expect(depois.atualizadoEm).toEqual(antes.atualizadoEm);
    } finally { vi.useRealTimers(); }
  });
  it("blocks all password HTTP paths in the real router and mounted route", async () => {
    const auth = criarAuth();
    const caminhos = ["sign-in/email", "sign-up/email", "change-password", "reset-password", "request-password-reset", "sessao-validada", "sessaoValidada", "bridge"];
    for (const caminho of caminhos) {
      for (const sufixo of ["", "/", "?probe=1"]) {
        const url = `http://127.0.0.1:8799/api/auth/${caminho}${sufixo}`;
        const request = () => new Request(url, { method: "POST", headers: { "content-type": "application/json", origin: "http://127.0.0.1:8799" }, body: JSON.stringify({ email: "forged@example.test", password: antiga, userId: "other-account" }) });
        expect((await auth.handler(request())).status).toBe(404);
        expect((await POST(request())).status).toBe(404);
      }
    }
    expect(await db.sessao.count()).toBe(0);
    expect(await db.usuario.count()).toBe(0);
    expect("sessaoValidada" in auth.api).toBe(false);
    expect((await GET(new Request("http://127.0.0.1:8799/api/auth/sign-in/social"))).status).toBe(404);
  });
  it("has no bridge HTTP path and rejects direct client-selected identity", async () => {
    const a = await conta("a@example.test");
    const b = await conta("b@example.test");
    const auth = authParaContaValidada(a.id);
    await expect(auth.api.sessaoValidada({ body: { userId: b.id } as never })).rejects.toThrow();
    expect(await db.sessao.count()).toBe(0);
    const resposta = await auth.api.sessaoValidada({ body: {}, returnHeaders: true });
    expect(Boolean(resposta.headers.get("set-cookie")?.includes("Max-Age=2592000"))).toBe(true);
    expect(await db.sessao.count({ where: { usuarioId: a.id } })).toBe(1);
    expect(await db.sessao.count({ where: { usuarioId: b.id } })).toBe(0);
    for (const caminho of ["sessaoValidada", "sessao-validada"]) {
      const resposta = await auth.handler(new Request(`http://127.0.0.1:8799/api/auth/${caminho}`, { method: "POST", body: "{}", headers: { "content-type": "application/json" } }));
      expect(resposta.status).toBe(404);
    }
  });
  it("refuses raw database tokens and changed signatures in the mounted handler", async () => {
    const usuario = await conta();
    await criarSessao(usuario.id);
    const sessao = await db.sessao.findFirstOrThrow();
    const assinado = contexto.cookies.get("ndb_sessao")!;
    async function ler(valor: string) {
      const resposta = await GET(new Request("http://127.0.0.1:8799/api/auth/get-session", { headers: { cookie: `ndb_sessao=${valor}` } }));
      return resposta.json();
    }
    expect(Boolean((await ler(assinado))?.user?.id === usuario.id)).toBe(true);
    expect(await ler(sessao.token!) === null).toBe(true);
    expect(await ler(assinado.slice(0, -3) + "abc") === null).toBe(true);
  });
  it("uses only the Cloudflare IP while hostile forwarded headers change", async () => {
    contexto.headers = { "cf-connecting-ip": "203.0.113.7" };
    const respostas = [];
    for (let i = 0; i < LIMITE_POR_IP + 2; i++) {
      contexto.headers["x-forwarded-for"] = `198.51.100.${i + 1}`;
      respostas.push(await entrar({}, formulario(`pessoa${i}@example.test`)));
    }
    expect(respostas.every((r) => r?.erro === "E-mail ou senha incorretos.")).toBe(true);
    expect((await db.tentativaAcesso.findMany()).filter((t) => t.email === null).map((t) => t.contagem)).toEqual([LIMITE_POR_IP + 2]);
    expect((await db.tentativaAcesso.findMany()).filter((t) => t.email !== null)).toHaveLength(LIMITE_POR_IP);
    expect(criarAuth().options.advanced?.ipAddress).toEqual({ ipAddressHeaders: ["cf-connecting-ip"] });
    expect(LIMITE_POR_EMAIL).toBe(5);
  });
  it("signup writes one credential and the unchanged legacy hash", async () => {
    await expect(cadastrar({}, formulario("nova@example.test"))).rejects.toThrow("redirect:/painel");
    const usuario = await db.usuario.findUniqueOrThrow({ where: { email: "nova@example.test" } });
    const credencial = await db.vinculoAuth.findFirst({ where: { usuarioId: usuario.id, provedorId: "credential" } });
    expect(Boolean(credencial?.senha && credencial.senha === usuario.senhaHash)).toBe(true);
    expect(usuario.telefone).toBe("5511991488052");
    expect(usuario.emailVerificado).toBe(false);
  });
  it("ignores a forged account ID in the public password action", async () => {
    for (const email of ["a@example.test", "b@example.test"]) {
      await cadastrar({}, formulario(email)).catch((erro: Error) => { if (erro.message !== "redirect:/painel") throw erro; });
    }
    const a = await db.usuario.findUniqueOrThrow({ where: { email: "a@example.test" } });
    const b = await db.usuario.findUniqueOrThrow({ where: { email: "b@example.test" } });
    await db.sessao.deleteMany();
    contexto.cookies.clear();
    const dados = formulario(a.email);
    dados.set("userId", b.id);
    dados.set("usuarioId", b.id);
    await expect(entrar({}, dados)).rejects.toThrow("redirect:/painel");
    expect((await usuarioAtual())?.id).toBe(a.id);
    expect(await db.sessao.count({ where: { usuarioId: b.id } })).toBe(0);
  });
  it("reset changes both password representations and real login rejects the old password", async () => {
    await cadastrar({}, formulario("reset@example.test")).catch((erro: Error) => { if (erro.message !== "redirect:/painel") throw erro; });
    const usuario = await db.usuario.findUniqueOrThrow({ where: { email: "reset@example.test" } });
    await expect(entrar({}, formulario(usuario.email))).rejects.toThrow("redirect:/painel");
    const token = await criarLink(usuario, "redefinir");
    expect(await redefinirSenhaComLink(token!, nova)).not.toBeNull();
    const depois = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    const credencial = await db.vinculoAuth.findFirst({ where: { usuarioId: usuario.id, provedorId: "credential" } });
    expect(Boolean(credencial?.senha && credencial.senha === depois.senhaHash)).toBe(true);
    expect((await entrar({}, formulario(usuario.email, antiga)))?.erro).toBe("E-mail ou senha incorretos.");
    await expect(entrar({}, formulario(usuario.email, nova))).rejects.toThrow("redirect:/painel");
  });
  it.each([
    ["absent", [undefined, undefined]],
    ["invalid", ["not-an-ip", ""]],
    ["mapped IPv4", ["::ffff:203.0.113.5", "203.0.113.5"]],
    ["IPv6 prefix", ["2001:db8:1234:1::1", "2001:0DB8:1234:0001:ffff::2"]],
  ])("keeps one action quota for %s Cloudflare headers", async (_nome, ips) => {
    for (let i = 0; i < LIMITE_POR_IP + 2; i++) {
      contexto.headers = { "x-forwarded-for": `198.51.100.${i + 1}` };
      if (ips[i % 2] !== undefined) contexto.headers["cf-connecting-ip"] = ips[i % 2]!;
      await entrar({}, formulario(`limite${i}@example.test`));
    }
    const linhas = await db.tentativaAcesso.findMany();
    expect(linhas.filter((t) => t.email === null)).toHaveLength(1);
    expect(linhas.filter((t) => t.email !== null)).toHaveLength(LIMITE_POR_IP);
  });
  it("requires phone before creating a Google account and creates a real signed session", async () => {
    const perfil = { sub: "google-phone-proof", email: "phone@example.test", nome: "Pessoa do Google", emailVerificado: true };
    expect(await contaDoGoogle({ ...perfil, emailVerificado: false }, "5511991488052")).toEqual({ tipo: "email_nao_verificado" });
    expect(await contaDoGoogle(perfil)).toEqual({ tipo: "precisa_telefone" });
    expect(await db.usuario.count()).toBe(0);
    const token = await guardarCadastroGoogle(perfil, "/painel");
    contexto.cookies.set(COOKIE_CADASTRO_GOOGLE, token);
    const form = new FormData();
    form.set("telefone", "11991488052");
    form.set("usuarioId", "forged-other-account");
    await expect(concluirCadastroGoogle({}, form)).rejects.toThrow("redirect:/painel");
    const usuario = await db.usuario.findUniqueOrThrow({ where: { email: perfil.email } });
    expect(usuario.telefone).toBe("5511991488052");
    expect((await usuarioAtual())?.id).toBe(usuario.id);
    expect(await db.cadastroGoogle.count()).toBe(0);
    expect(await db.vinculoAuth.count({ where: { usuarioId: usuario.id, provedorId: "google" } })).toBe(1);
  });
  it("concurrent confirmed Google links preserve passwords and existing sessions", async () => {
    await cadastrar({}, formulario("confirmed@example.test")).catch((erro: Error) => { if (erro.message !== "redirect:/painel") throw erro; });
    const usuario = await db.usuario.update({ where: { email: "confirmed@example.test" }, data: { emailConfirmadoEm: new Date(), emailVerificado: true } });
    const credencial = await db.vinculoAuth.findFirstOrThrow({ where: { usuarioId: usuario.id, provedorId: "credential" } });
    const sessoes = await db.sessao.findMany({ select: { id: true, expiraEm: true } });
    const perfil = { sub: "google-confirmed-proof", email: usuario.email, nome: usuario.nome, emailVerificado: true };
    const resultados = await Promise.all([contaDoGoogle(perfil), contaDoGoogle(perfil)]);
    expect(resultados.every((r) => r.tipo === "entrou" && r.usuarioId === usuario.id)).toBe(true);
    expect(await db.vinculoAuth.count({ where: { usuarioId: usuario.id, provedorId: "google" } })).toBe(1);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).senhaHash === usuario.senhaHash).toBe(true);
    expect((await db.vinculoAuth.findUniqueOrThrow({ where: { id: credencial.id } })).senha === credencial.senha).toBe(true);
    expect(await db.sessao.findMany({ select: { id: true, expiraEm: true } })).toEqual(sessoes);
  });
  it("Google removes both password representations from an unconfirmed account", async () => {
    await cadastrar({}, formulario("google@example.test")).catch((erro: Error) => { if (erro.message !== "redirect:/painel") throw erro; });
    const usuario = await db.usuario.findUniqueOrThrow({ where: { email: "google@example.test" } });
    expect(await db.vinculoAuth.count({ where: { usuarioId: usuario.id, provedorId: "credential" } })).toBe(1);
    const resultado = await contaDoGoogle({ sub: "public-fixture-google", email: usuario.email, nome: usuario.nome, emailVerificado: true });
    expect(resultado.tipo).toBe("entrou");
    expect(await db.vinculoAuth.count({ where: { usuarioId: usuario.id, provedorId: "credential" } })).toBe(0);
    expect(await db.sessao.count({ where: { usuarioId: usuario.id } })).toBe(0);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).senhaHash).toBeNull();
  });
});
