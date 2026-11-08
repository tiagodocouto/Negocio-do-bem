import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { Client } from "pg";

export function validarBanco(valor: string): string {
  const erro = "Use TEST_DATABASE_URL with a disposable local PostgreSQL database";
  let url: URL;
  try { url = new URL(valor); } catch { throw new Error(erro); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
      !url.port || !url.username || !url.password || !/^\/[a-z0-9_]*test[a-z0-9_]*$/.test(url.pathname) || url.search || url.hash) {
    throw new Error(erro);
  }
  return valor;
}

export function configuracaoLocal(url: string, raiz: string) {
  validarBanco(url);
  return {
    name: "negocio-do-bem-integration",
    main: join(raiz, ".open-next/worker.js"),
    compatibility_date: "2026-10-30",
    compatibility_flags: ["nodejs_compat"],
    assets: { directory: join(raiz, ".open-next/assets"), binding: "ASSETS" },
    vars: { DEPLOY_ENV: "preview", CLOUDFLARE_DEPLOY: "1", DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
    hyperdrive: [{ binding: "HYPERDRIVE", id: "00000000000000000000000000000000", localConnectionString: url }],
    r2_buckets: [{ binding: "NEXT_INC_CACHE_R2_BUCKET", bucket_name: "integration-cache", remote: false }],
  };
}

export function erroServidor(texto: string): boolean {
  return /(?:\[ERROR\]|\b\w*Error:|⨯)/.test(texto);
}

export function ocultarConexao(texto: string): string {
  return texto.replace(/(postgres(?:ql)?:\/\/[^:\s"]+:)[^@\s"]+/g, "$1[redacted]");
}

async function executar() {
  const base = new URL(validarBanco(process.env.TEST_DATABASE_URL ?? ""));
  const raiz = resolve(import.meta.dirname, "..");
  // Next and Wrangler load these files without an explicit request.
  assert(!readdirSync(raiz).some((nome) => /^(\.env(?:\.|$)|\.dev\.vars(?:\.|$))/.test(nome) && !nome.endsWith(".example")),
    "Remove local environment files before this test. The test does not read them.");
  const pasta = mkdtempSync(join(tmpdir(), "negocio-do-bem-cloudflare-"));
  const nomeBanco = `ndb_cloudflare_test_${randomBytes(8).toString("hex")}`;
  const urlAdmin = new URL(base);
  urlAdmin.pathname = "/postgres";
  base.pathname = `/${nomeBanco}`;
  const banco = base.toString();
  const admin = new Client({ connectionString: urlAdmin.toString() });
  let bancoCriado = false;
  let processo: ChildProcess | undefined;
  let saidaWorker = "";
  let falhaWorker = false;
  const cancelamento = new AbortController();
  const cancelar = () => cancelamento.abort();
  process.once("SIGINT", cancelar);
  process.once("SIGTERM", cancelar);
  const ambiente = {
    PATH: [join(raiz, "node_modules/.bin"), dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter),
    HOME: pasta,
    DATABASE_URL: banco,
    DATABASE_URL_UNPOOLED: banco,
    TEST_DATABASE_URL: banco,
    DEPLOY_ENV: "preview",
    CLOUDFLARE_DEPLOY: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    WRANGLER_SEND_METRICS: "false",
    CLOUDFLARE_CF_FETCH_ENABLED: "false",
    WRANGLER_LOG_PATH: join(pasta, "wrangler.log"),
    DOTENV_CONFIG_PATH: join(pasta, "empty.env"),
    CI: "1",
    NODE_ENV: "production" as const,
  };
  writeFileSync(ambiente.DOTENV_CONFIG_PATH, "");
  const configuracao = join(pasta, "wrangler.json");
  writeFileSync(configuracao, JSON.stringify(configuracaoLocal(banco, raiz), null, 2));

  function iniciar(comando: string, argumentos: string[], worker = false, cwd = raiz) {
    const filho = spawn(comando, argumentos, { cwd, env: ambiente, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    processo = filho;
    for (const [canal, destino] of [[filho.stdout!, process.stdout], [filho.stderr!, process.stderr]] as const) {
      createInterface({ input: canal }).on("line", (linha: string) => {
        const texto = ocultarConexao(linha);
        destino.write(`${texto}\n`);
        if (worker) {
          falhaWorker ||= erroServidor(texto);
          saidaWorker = `${saidaWorker}${texto}\n`.slice(-1024 * 1024);
        }
      });
    }
    return filho;
  }

  async function encerrar() {
    if (!processo?.pid || processo.exitCode !== null || processo.signalCode !== null) return;
    const fechado = once(processo, "close");
    const pid = processo.pid;
    const limite = setTimeout(() => { try { process.kill(-pid, "SIGKILL"); } catch {} }, 5_000);
    process.kill(-pid, "SIGTERM");
    await fechado;
    clearTimeout(limite);
  }

  async function comando(executavel: string, argumentos: string[], cwd = raiz) {
    cancelamento.signal.throwIfAborted();
    const filho = iniciar(executavel, argumentos, false, cwd);
    const abortar = () => { void encerrar(); };
    cancelamento.signal.addEventListener("abort", abortar, { once: true });
    try {
      const [codigo] = await once(filho, "close");
      assert.equal(codigo, 0, `${executavel} failed. Check the command output.`);
      cancelamento.signal.throwIfAborted();
    } finally {
      cancelamento.signal.removeEventListener("abort", abortar);
    }
  }

  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${nomeBanco}"`);
    bancoCriado = true;
    console.log(`Created disposable database ${nomeBanco}.`);
    await comando("sh", ["scripts/cloudflare-build.sh", "--config", configuracao]);
    // OpenNext stores its local cache relative to the current directory.
    for (const nome of [".open-next", "node_modules", "package.json"]) {
      symlinkSync(join(raiz, nome), join(pasta, nome));
    }
    await comando("opennextjs-cloudflare", ["populateCache", "local", "--config", configuracao], pasta);
    const reserva = createServer();
    reserva.listen(0, "127.0.0.1");
    await once(reserva, "listening");
    const endereco = reserva.address();
    assert(endereco && typeof endereco !== "string");
    const porta = endereco.port;
    await new Promise<void>((concluir, falhar) => reserva.close((erro) => erro ? falhar(erro) : concluir()));
    const origem = `http://127.0.0.1:${porta}`;
    const worker = iniciar(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "dev", "--local", "--config", configuracao,
      "--ip", "127.0.0.1", "--port", String(porta), "--persist-to", join(pasta, ".wrangler/state")], true);
    await new Promise<void>((concluir, falhar) => {
      const limite = setTimeout(() => falhar(new Error("The local Worker did not start.")), 60_000);
      const abortar = () => falhar(new Error("The test was cancelled."));
      cancelamento.signal.addEventListener("abort", abortar, { once: true });
      worker.stdout!.on("data", () => {
        if (saidaWorker.includes("Ready on")) { clearTimeout(limite); concluir(); }
      });
      worker.once("error", (erro) => { clearTimeout(limite); falhar(erro); });
      worker.once("exit", () => { clearTimeout(limite); falhar(new Error("The local Worker stopped before the test.")); });
    });
    const protegida = await fetch(`${origem}/moderacao`, { signal: cancelamento.signal });
    const negada = await protegida.text();
    assert([200, 404].includes(protegida.status), "The protected route returned an unexpected status.");
    assert(negada.includes("NEXT_HTTP_ERROR_FALLBACK;404"), "The protected route did not deny anonymous access.");
    assert(!negada.includes("$ACTION_ID_"), "The protected route exposed a moderation action.");
    console.log("PASS: anonymous access to the protected route was denied.");
    const publica = await fetch(`${origem}/empresas/padaria.florescer.exemplo`, { signal: cancelamento.signal });
    assert.equal(publica.status, 200);
    const html = await publica.text();
    assert(html.includes('"@type":"LocalBusiness"'), "The public route did not render the database record.");
    assert(html.includes("Padaria Florescer"), "The public route did not render the seeded business.");
    console.log("PASS: public database route and protected route in the local Worker.");
  } finally {
    process.removeListener("SIGINT", cancelar);
    process.removeListener("SIGTERM", cancelar);
    try {
      await encerrar();
      assert(!falhaWorker, "The local Worker reported a server error.");
    } finally {
      try {
        if (bancoCriado) {
          await admin.query(`DROP DATABASE "${nomeBanco}" WITH (FORCE)`);
          console.log(`Removed disposable database ${nomeBanco}.`);
        }
      } finally {
        await admin.end();
        rmSync(pasta, { recursive: true, force: true });
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  executar().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : "The Cloudflare test failed.");
    process.exitCode = 1;
  });
}
