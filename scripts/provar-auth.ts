import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { conferirDestino, limparSaida } from "../tests/prova/isolamento";

async function main() {
const raiz = resolve(__dirname, "..");
const modo = process.argv[2] ?? "esquema";
const modos = ["preparar", "esquema", "compatibilidade", "regressao", "identidade", "caminhos-http", "ip", "sessao", "google", "cookie", "navegador", "worker", "inventario"];
assert(modos.includes(modo), "Unknown local proof mode.");
for (const nome of [".env", ".env.local", ".env.test", ".env.test.local", ".env.production", ".env.production.local", ".env.development", ".env.development.local", ".dev.vars", ".dev.vars.local"]) {
  const existe = await lstat(resolve(raiz, nome)).then(() => true, (erro: NodeJS.ErrnoException) => { if (erro.code === "ENOENT") return false; throw erro; });
  assert(!existe, "Local proof refuses existing environment files.");
}
const id = randomBytes(6).toString("hex");
const projeto = `ndb-auth-${id}`;
const senha = randomBytes(32).toString("hex");
const segredo = randomBytes(48).toString("base64url");
const temporario = await mkdtemp("/var/tmp/ndb-issue209-");
const banco = `ndb_auth_test_${id}`;
const seguro: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
  HOME: temporario,
  TMPDIR: temporario,
  DOTENV_CONFIG_PATH: "/dev/null",
  NEXT_TELEMETRY_DISABLED: "1",
  WRANGLER_SEND_METRICS: "false",
  CI: "1",
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_userconfig: resolve(temporario, "npm-user.npmrc"),
  npm_config_globalconfig: resolve(temporario, "npm-global.npmrc"),
  CLOUDFLARE_DEPLOY: "1",
  DEPLOY_ENV: "preview",
  APP_URL: "http://127.0.0.1:8787",
  PLAYWRIGHT_BROWSERS_PATH: resolve(raiz, "node_modules/.cache/prova-auth"),
  BETTER_AUTH_SECRETS: `1:${segredo}`,
};
await writeFile(seguro.npm_config_userconfig!, "", { flag: "wx" });
await writeFile(seguro.npm_config_globalconfig!, "", { flag: "wx" });
const compose = JSON.stringify({
  services: {
    db: {
      image: "postgres:17-alpine",
      environment: { POSTGRES_USER: "proof", POSTGRES_PASSWORD: senha, POSTGRES_DB: banco },
      ports: ["127.0.0.1::5432"],
      volumes: ["dados:/var/lib/postgresql/data"],
    },
  },
  volumes: { dados: {} },
});
const segredos = [senha, segredo];
const processos = new Set<number>();
const gruposIniciados: number[] = [];
let processoNaoParou = false;
let interrompido = false;
let limpando = false;
const interromper = () => {
  interrompido = true;
  if (limpando) return;
  for (const pid of processos) {
    try { process.kill(-pid, "SIGTERM"); }
    catch (erro) { if ((erro as NodeJS.ErrnoException).code !== "ESRCH") { processoNaoParou = true; console.error(`Cannot stop owned proof process group ${pid}.`); } }
  }
};
process.once("SIGINT", interromper);
process.once("SIGTERM", interromper);

async function executar(comando: string, args: string[], env = seguro, entrada?: string, mostrar = true): Promise<string> {
  if (interrompido && !limpando) throw new Error("Local proof was interrupted.");
  return new Promise((ok, falha) => {
    const filho = spawn(comando, args, { cwd: raiz, env, detached: true, stdio: ["pipe", "pipe", "pipe"] });
    if (filho.pid) { processos.add(filho.pid); gruposIniciados.push(filho.pid); }
    let saida = "";
    filho.stdout.on("data", (parte: Buffer) => coletar(parte));
    filho.stderr.on("data", (parte: Buffer) => coletar(parte));
    function coletar(parte: Buffer) {
      saida += parte.toString();
      if (saida.length > 8 * 1024 * 1024) {
        if (filho.pid) process.kill(-filho.pid, "SIGTERM");
        falha(new Error("Child output exceeds the local proof limit."));
      }
    }
    filho.once("error", falha);
    filho.once("close", (codigo) => {
      if (filho.pid) processos.delete(filho.pid);
      const limpo = limparSaida(saida, segredos);
      if (mostrar && limpo.trim()) console.log(limpo.trim());
      if (codigo !== 0) falha(new Error(`Local proof command failed: ${comando} (exit ${codigo}).`));
      else ok(saida.trim());
    });
    filho.stdin.end(entrada);
  });
}

const docker = (...args: string[]) => executar("docker", ["compose", "--env-file", "/dev/null", "--project-name", projeto, "-f", "-", ...args], seguro, compose);
let criou = false;
let estadoCriado = false;
let configCriada = false;
const estadoWorker = resolve(raiz, ".wrangler");
const configWorker = resolve(raiz, `wrangler.prova-auth-${id}.json`);
try {
  criou = true;
  await docker("up", "-d", "--pull", "never");
  await docker("ps", "--quiet", "db");
  const porta = await executar("docker", ["compose", "--env-file", "/dev/null", "--project-name", projeto, "-f", "-", "port", "db", "5432"], seguro, compose, false);
  assert(/^127\.0\.0\.1:\d+$/.test(porta), "Local proof port is not loopback.");
  const url = `postgresql://proof:${senha}@${porta}/${banco}`;
  conferirDestino(url, url);
  const env: NodeJS.ProcessEnv = { ...seguro, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, TEST_DATABASE_URL: url };
  for (const nome of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "TEST_DATABASE_URL"] as const) conferirDestino(env[nome], url);
  for (;;) {
    const cliente = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
    try {
      await cliente.connect();
      await cliente.end();
      break;
    } catch {
      await cliente.end().catch(() => undefined);
      const estado = await executar("docker", ["compose", "--env-file", "/dev/null", "--project-name", projeto, "-f", "-", "ps", "--status", "running", "--services"], seguro, compose, false);
      assert(estado.split("\n").includes("db"), "Local proof database stopped before readiness.");
      await setTimeout(100);
    }
  }
  console.log(`Local resource ready: ${projeto}. Node ${process.version}.`);
  if (modo === "preparar") {
    console.log("Database target checks passed before mutation.");
  } else if (modo === "inventario") {
    await executar("git", ["diff", "--numstat", "d2919848bf7c6ce8594f7ecebaa9e39bd3bea029"]);
    await executar("git", ["status", "--short"]);
  } else {
    await executar("npm", ["exec", "--", "prisma", "generate"], env);
    if (modo === "navegador" || modo === "worker") {
      assert(!(await lstat(estadoWorker).then(() => true, (erro: NodeJS.ErrnoException) => { if (erro.code === "ENOENT") return false; throw erro; })), "Browser proof refuses existing local Worker state.");
      await mkdir(estadoWorker);
      estadoCriado = true;
      const config = {
        name: projeto,
        main: resolve(raiz, ".open-next/worker.js"),
        compatibility_date: "2026-10-30",
        compatibility_flags: ["nodejs_compat"],
        assets: { directory: resolve(raiz, ".open-next/assets"), binding: "ASSETS" },
        routes: [],
        workers_dev: false,
        vars: { DEPLOY_ENV: "preview", CLOUDFLARE_DEPLOY: "1", APP_URL: env.APP_URL, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, BETTER_AUTH_SECRETS: env.BETTER_AUTH_SECRETS },
        r2_buckets: [{ binding: "NEXT_INC_CACHE_R2_BUCKET", bucket_name: `${projeto}-cache`, remote: false }, { binding: "UPLOADS", bucket_name: `${projeto}-uploads`, remote: false }],
        hyperdrive: [],
        dev: { ip: "127.0.0.1", port: 8787 },
        observability: { enabled: false },
      };
      conferirDestino(config.vars.DATABASE_URL, url);
      conferirDestino(config.vars.DATABASE_URL_UNPOOLED, url);
      assert(config.hyperdrive.length === 0 && config.routes.length === 0, "Worker proof must not retain shared bindings or routes.");
      await writeFile(configWorker, JSON.stringify(config), { mode: 0o600, flag: "wx" });
      configCriada = true;
      await executar("npm", ["exec", "--", "prisma", "migrate", "deploy"], env);
      await executar("npm", ["exec", "--", "prisma", "db", "seed"], env);
      await executar("npm", ["exec", "--", "playwright", "install", "chromium"], env);
      await executar(process.execPath, ["--conditions=react-server", "--import", "tsx", "tests/prova/navegador.ts"], { ...env, PROVA_WORKER_CONFIG: configWorker, PROVA_DATABASE_URL: url });
    } else if (modo === "regressao") {
      await executar("npm", ["run", "lint"], env);
      await executar("npm", ["run", "typecheck"], env);
      await executar("npm", ["test"], { ...env, CLOUDFLARE_DEPLOY: "", DEPLOY_ENV: "" });
    } else {
      const arquivos = modo === "compatibilidade"
        ? ["tests/db/acoes-conta.test.ts", "tests/db/google.test.ts", "tests/db/links.test.ts", "tests/db/redefinicao-de-senha.test.ts", "tests/db/tentativas.test.ts", "tests/unit/utilitarios.test.ts"]
        : [modo === "esquema" ? "tests/prova/esquema.test.ts" : "tests/prova/auth.test.ts"];
      await executar("npm", ["test", "--", ...arquivos], { ...env, CLOUDFLARE_DEPLOY: "", DEPLOY_ENV: "" });
    }
  }
} catch (erro) {
  console.error(limparSaida(erro instanceof Error ? erro.message : "Local proof failed.", segredos));
  process.exitCode = 1;
} finally {
  interromper();
  limpando = true;
  let limpezaFalhou = processoNaoParou;
  if (processoNaoParou) process.exitCode = 1;
  const limpezas = [
    async () => { if (configCriada) await rm(configWorker); },
    async () => { if (estadoCriado) await rm(estadoWorker, { recursive: true }); },
    async () => { if (criou) await docker("down", "--volumes", "--remove-orphans"); },
    async () => { await rm(temporario, { recursive: true, force: true }); },
  ];
  for (const limpar of limpezas) {
    try { await limpar(); }
    catch { limpezaFalhou = true; process.exitCode = 1; console.error("An owned proof resource was not removed."); }
  }
  process.removeListener("SIGINT", interromper);
  process.removeListener("SIGTERM", interromper);
  console.log(`Owned process groups: ${gruposIniciados.join(", ")}.`);
  if (!limpezaFalhou) console.log(`Local resources removed: ${projeto}.`);
}
}

void main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Local proof setup failed before resource creation.");
  process.exitCode = 1;
});
