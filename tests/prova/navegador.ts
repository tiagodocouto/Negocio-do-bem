import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium, type BrowserContext, type Page } from "playwright";
import { parseSetCookieHeader } from "better-auth/cookies";
import { authParaContaValidada } from "@/lib/auth/ponte-sessao";
import { db } from "@/lib/db";
import { conferirDestino, limparSaida } from "./isolamento";

async function main() {
  const config = process.env.PROVA_WORKER_CONFIG;
  const origem = process.env.APP_URL;
  assert(config && origem, "Local browser proof configuration is missing.");
  const esperado = process.env.PROVA_DATABASE_URL;
  assert(esperado, "Browser proof database reference is missing.");
  for (const nome of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "TEST_DATABASE_URL"]) conferirDestino(process.env[nome], esperado);
  const base = new URL(origem);
  assert(base.hostname === "127.0.0.1" && base.port === "8787", "Browser proof origin is not local.");
  const fixtureEnv = { ...process.env };
  const segredos = [fixtureEnv.DATABASE_URL!, fixtureEnv.BETTER_AUTH_SECRETS!.slice(2)];
  const browser = await chromium.launch({ headless: true, env: fixtureEnv });
  const errosBrowser: string[] = [];
  const contextos: BrowserContext[] = [];
  let saida = "";
  let pronto = false;
  let preview: ReturnType<typeof spawn> | undefined;
  const interromper = () => {
    if (preview?.pid && preview.exitCode === null && preview.signalCode === null) process.kill(-preview.pid, "SIGTERM");
    void browser.close();
  };
  process.once("SIGINT", interromper);
  process.once("SIGTERM", interromper);

  async function contexto(email?: string) {
    const ctx = await browser.newContext();
    contextos.push(ctx);
    if (email) {
      const usuario = await db.usuario.findUniqueOrThrow({ where: { email } });
      const resposta = await authParaContaValidada(usuario.id).api.sessaoValidada({ body: {}, returnHeaders: true });
      const cookie = parseSetCookieHeader(resposta.headers.get("set-cookie")!).get("ndb_sessao");
      assert(cookie, "Fixture session cookie is missing.");
      await ctx.addCookies([{ name: "ndb_sessao", value: cookie.value, url: origem!, httpOnly: true, sameSite: "Lax" }]);
    }
    const page = await ctx.newPage();
    page.on("pageerror", () => errosBrowser.push("Browser page script failed."));
    return { ctx, page };
  }
  async function pagina(page: Page, caminho: string, trecho: string) {
    const resposta = await page.goto(origem! + caminho);
    assert(resposta && resposta.status() < 500, "Worker page returned a server error.");
    await page.getByText(trecho, { exact: false }).first().waitFor({ state: "visible" });
    const texto = await page.locator("body").innerText();
    assert(!/application error|server-side exception|internal server error|NEXT_HTTP_ERROR|digest:|Esta página não abriu agora|O site não abriu agora|Código do erro:/i.test(texto), "Worker streamed an error page.");
    return resposta;
  }
  async function login(page: Page, email: string) {
    await pagina(page, "/entrar?voltar=/painel", "Entrar");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill("senha-demo-123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/painel");
    await page.getByText(/Olá, (Ana|Equipe)!/).waitFor();
  }

  try {
    const ana = await contexto("ana@exemplo.com");
    const mod = await contexto("moderacao@exemplo.com");
    const fotoAntes = await db.usuario.findUniqueOrThrow({ where: { email: "ana@exemplo.com" }, include: { empresas: true, depoimentos: true } });
    await db.$disconnect();
    preview = spawn("npm", ["run", "preview:cloudflare", "--", "--config", config], { cwd: process.cwd(), env: { ...fixtureEnv, NODE_ENV: "production" }, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    const iniciado = preview;
    console.log(`Worker proof process group: ${iniciado.pid}.`);
    await new Promise<void>((ok, falha) => {
      function coletar(parte: Buffer) {
        const texto = parte.toString();
        saida += texto;
        if (saida.length > 8 * 1024 * 1024) {
          if (iniciado.pid) process.kill(-iniciado.pid, "SIGTERM");
          falha(new Error("Worker proof output exceeds its size limit."));
        }
        if (!pronto && /Ready on http:\/\/(?:localhost|127\.0\.0\.1):8787/.test(saida)) { pronto = true; ok(); }
      }
      iniciado.stdout!.on("data", coletar);
      iniciado.stderr!.on("data", coletar);
      iniciado.once("error", falha);
      iniciado.once("exit", (codigo) => { if (!pronto) falha(new Error(`Local preview exited before readiness (${codigo}).`)); });
    });
    console.log("Official local preview started. Local cache prepared before the first application request.");

    // No HTTP readiness request precedes this authenticated page request.
    await pagina(ana.page, "/painel", "Olá, Ana!");
    console.log("Acceptance 8: cold authenticated Worker page rendered the seed account.");
    await pagina(ana.page, "/painel", "Olá, Ana!");
    await Promise.all([pagina(ana.page, "/painel", "Olá, Ana!"), pagina(mod.page, "/painel", "Olá, Equipe!")]);
    console.log("Acceptance 8: separate and concurrent authenticated requests rendered different accounts.");

    const fotoDepois = await db.usuario.findUniqueOrThrow({ where: { email: "ana@exemplo.com" }, include: { empresas: true, depoimentos: true } });
    assert(fotoAntes.id === fotoDepois.id && fotoAntes.papel === fotoDepois.papel && fotoAntes.senhaHash === fotoDepois.senhaHash, "Seed identity or password changed.");
    assert(JSON.stringify(fotoAntes.empresas) === JSON.stringify(fotoDepois.empresas), "Seed memberships changed.");
    assert(JSON.stringify(fotoAntes.depoimentos) === JSON.stringify(fotoDepois.depoimentos), "Seed testimonials changed.");

    const visitante = await contexto();
    await pagina(visitante.page, "/painel", "Que bom te ver");
    await visitante.page.waitForURL((url) => url.pathname === "/entrar");
    assert(visitante.page.url().includes("/entrar"), "Visitor was not redirected.");
    const sessoesAntesDoEstado = await db.sessao.count();
    await pagina(visitante.page, "/api/google/retorno?state=forged&code=public-fixture", "Que bom te ver");
    assert(visitante.page.url().includes("google_erro"), "Google callback accepted an invalid state.");
    assert(await db.sessao.count() === sessoesAntesDoEstado, "Invalid Google state created a session.");
    const respostaMembro = await ana.page.goto(origem + "/moderacao");
    await ana.page.getByRole("heading", { name: "Não encontramos esta página", exact: true }).waitFor();
    assert(respostaMembro?.status() === 404 || /não encontrad|404/i.test(await ana.page.locator("body").innerText()), "Member reached moderation.");
    await pagina(mod.page, "/moderacao", "Visão geral");
    await mod.page.getByRole("heading", { level: 2, name: "Visão geral", exact: true }).waitFor();
    const negocio = await db.empresa.findUniqueOrThrow({ where: { instagramUsername: "padaria.florescer.exemplo" } });
    await pagina(visitante.page, `/empresas/${negocio.instagramUsername}`, negocio.nome);
    await visitante.page.getByRole("heading", { level: 1, name: negocio.nome, exact: true }).waitFor();
    console.log("Public Worker profile rendered its business heading without a server error.");

    await pagina(visitante.page, "/cadastrar?voltar=/painel", "Criar conta");
    await visitante.page.getByLabel("Seu nome", { exact: true }).fill("Pessoa do navegador");
    await visitante.page.getByLabel("E-mail", { exact: true }).fill("browser-proof@example.test");
    await visitante.page.getByLabel(/Telefone/).fill("11991488052");
    await visitante.page.getByLabel("Senha", { exact: true }).fill("senha-browser-proof-123");
    await visitante.page.getByRole("button", { name: /Criar conta/ }).click();
    await visitante.page.waitForURL((url) => url.pathname === "/painel");
    await visitante.page.getByText("Olá, Pessoa!", { exact: false }).waitFor();
    assert((await db.usuario.findUniqueOrThrow({ where: { email: "browser-proof@example.test" } })).telefone === "5511991488052", "Browser signup did not save the phone.");
    await visitante.page.locator("details").filter({ hasText: "Meu painel" }).locator("summary").click();
    await visitante.page.getByRole("button", { name: "Sair", exact: true }).first().click();
    await visitante.page.waitForURL(origem + "/");
    await pagina(visitante.page, "/painel", "Que bom te ver");
    await visitante.page.waitForURL((url) => url.pathname === "/entrar");
    await visitante.page.getByLabel("E-mail", { exact: true }).fill("browser-proof@example.test");
    await visitante.page.getByLabel("Senha", { exact: true }).fill("wrong-password");
    await visitante.page.getByRole("button", { name: "Entrar", exact: true }).click();
    await visitante.page.getByText("E-mail ou senha incorretos.", { exact: true }).waitFor();
    assert(await visitante.page.getByLabel("E-mail", { exact: true }).inputValue() === "browser-proof@example.test", "Validation cleared the email field.");
    await visitante.page.getByLabel("Senha", { exact: true }).fill("senha-browser-proof-123");
    await visitante.page.getByRole("button", { name: "Entrar", exact: true }).click();
    await visitante.page.waitForURL((url) => url.pathname === "/painel");
    await visitante.page.getByText("Olá, Pessoa!", { exact: false }).waitFor();
    console.log("Acceptance 3: browser signup, phone, logout, login, field retention, member guard, and moderator guard passed.");

    const paraleloA = await contexto();
    const paraleloB = await contexto();
    await Promise.all([login(paraleloA.page, "ana@exemplo.com"), login(paraleloB.page, "moderacao@exemplo.com")]);
    assert((await paraleloA.page.locator("body").innerText()).includes("Ana"), "Concurrent login A returned another identity.");
    assert((await paraleloB.page.locator("body").innerText()).includes("Equipe"), "Concurrent login B returned another identity.");
    console.log("Acceptance 2 and 8: seed password login and concurrent real Server Actions passed.");

    const unsigned = await contexto();
    const sessao = await db.sessao.findFirstOrThrow({ where: { usuario: { email: "ana@exemplo.com" }, token: { not: null } } });
    await unsigned.ctx.addCookies([{ name: "ndb_sessao", value: sessao.token!, url: origem, httpOnly: true }]);
    await pagina(unsigned.page, "/painel", "Que bom te ver");
    await unsigned.page.waitForURL((url) => url.pathname === "/entrar");
    assert(unsigned.page.url().includes("/entrar"), "Protected page accepted an unsigned database token.");
    await unsigned.ctx.addCookies([{ name: "ndb_sessao", value: sessao.token! + ".invalid-signature", url: origem, httpOnly: true }]);
    await pagina(unsigned.page, "/painel", "Que bom te ver");
    await unsigned.page.waitForURL((url) => url.pathname === "/entrar");
    assert(unsigned.page.url().includes("/entrar"), "Protected page accepted a changed cookie signature.");
    console.log("Acceptance 9: protected Worker page refused unsigned and invalid-signature tokens. Signed control passed.");
    assert(errosBrowser.length === 0, "Browser reported a page script error.");
    assert(!/Cannot perform I\/O|different request|cross-request|unhandled|\[ERROR\]|Error:|server-side exception/i.test(saida), "Local Worker logs contain a server or request-ownership error.");
    console.log("Worker logs contain no server or cross-request I/O errors. Browser page scripts passed.");
  } catch (erro) {
    console.error(limparSaida(saida, segredos));
    throw erro;
  } finally {
    if (preview?.pid && preview.exitCode === null && preview.signalCode === null) {
      const saiu = new Promise<void>((ok) => preview!.once("close", () => ok()));
      process.kill(-preview.pid, "SIGTERM");
      await saiu;
    }
    try {
      if (browser.isConnected()) for (const contexto of contextos) await contexto.close();
    } finally {
      await browser.close();
      await db.$disconnect();
      process.removeListener("SIGINT", interromper);
      process.removeListener("SIGTERM", interromper);
    }
  }
}

void main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Local browser proof failed.");
  process.exitCode = 1;
});
