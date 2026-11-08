import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, type WriteStream } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { URL_BANCO_TESTE } from "../banco-de-teste";

const raiz = resolve(import.meta.dirname, "../..");
const arquivoDasAcoes = resolve(raiz, "src/acoes/moderacao.ts");

/** Toda Server Action de `src/acoes/moderacao.ts`. A prova falha se o arquivo ganhar uma ação que não está nesta lista. */
const ACOES = [
  "aprovarReivindicacoesSemDono",
  "publicarIndicacoesPendentes",
  "aprovarReivindicacao",
  "recusarReivindicacao",
  "moderarEmpresa",
  "decidirDenuncia",
  "removerDono",
] as const;
type Acao = (typeof ACOES)[number];
type Alvos = { empresaId: string; reivindicacaoId: string; depoimentoId: string; donoId: string };

/** Os campos que o formulário real da fila envia para cada ação. */
const CAMPOS: Record<Acao, (alvos: Alvos) => Record<string, string>> = {
  aprovarReivindicacoesSemDono: () => ({}),
  publicarIndicacoesPendentes: () => ({}),
  aprovarReivindicacao: ({ reivindicacaoId }) => ({ reivindicacaoId, modo: "adicionar" }),
  recusarReivindicacao: ({ reivindicacaoId }) => ({ reivindicacaoId, motivo: "Prova de runtime" }),
  moderarEmpresa: ({ empresaId }) => ({ empresaId, de: "aprovada", decisao: "rejeitar", aba: "negocios" }),
  decidirDenuncia: ({ depoimentoId }) => ({ depoimentoId, decisao: "remover" }),
  removerDono: ({ empresaId, donoId }) => ({ empresaId, usuarioId: donoId, motivo: "Prova de runtime", confirmo: "sim" }),
};

function formularios(html: string) {
  return [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)]
    .map((trecho) => ({ corpo: trecho[1], id: trecho[1].match(/name="(\$ACTION_ID_[^"]+)"/)?.[1] }))
    .filter((formulario): formulario is { corpo: string; id: string } => Boolean(formulario.id));
}

describe("Next em produção", () => {
  let servidor: ChildProcess | undefined;
  let log: WriteStream | undefined;
  let errosServidor = "";
  let saidaServidor = "";
  let pastaDoLog = "";
  let caminhoLog = "";
  let origem: string;
  let empresaId: string;
  let empresaPendenteId: string;
  let reivindicacaoId: string;
  let depoimentoId: string;
  let moderadorId: string;
  let donoId: string;
  let liberacaoId: string;
  let pastaDosDocumentos = "";
  let chaveDoDocumento = "";
  const BYTES_DO_DOCUMENTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
  let emailDoModerador: string;
  let usernameDoNegocio: string;
  let cookieModerador: string;
  let cookieMembro: string;
  const acoes = {} as Record<Acao, string>;
  const usuarios: string[] = [];

  const alvos = (): Alvos => ({ empresaId, reivindicacaoId, depoimentoId, donoId });
  const idsAuditados = () => [empresaId, empresaPendenteId, reivindicacaoId, depoimentoId];

  async function criarPessoa(papel: string) {
    const email = `${randomBytes(8).toString("hex")}@exemplo.test`;
    const pessoa = await db.usuario.create({ data: { nome: `Pessoa ${papel}`, email, senhaHash: "nao-usada", papel } });
    usuarios.push(pessoa.id);
    const sessao = randomBytes(32).toString("base64url");
    await db.sessao.create({
      data: {
        id: createHash("sha256").update(sessao).digest("hex"),
        usuarioId: pessoa.id,
        expiraEm: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return { id: pessoa.id, email, cookie: `ndb_sessao=${sessao}` };
  }

  async function enviar(acao: Acao, cookie: string, campos: Record<string, string> = CAMPOS[acao](alvos())) {
    const dados = new FormData();
    dados.set(acoes[acao], "");
    for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
    return fetch(`${origem}/moderacao?aba=negocios`, {
      method: "POST", body: dados, headers: { cookie, origin: origem }, redirect: "manual",
    });
  }

  async function ler(caminho: string, cookie: string) {
    const resposta = await fetch(`${origem}${caminho}`, { headers: { cookie } });
    return { status: resposta.status, html: await resposta.text() };
  }

  /** Tudo o que uma ação de moderação poderia mudar nas linhas da prova, mais o total de linhas da auditoria. */
  async function estado() {
    const ids = [empresaId, empresaPendenteId];
    const [empresas, reivindicacoes, depoimentos, donos, auditoria] = await Promise.all([
      db.empresa.findMany({ where: { id: { in: ids } }, select: { id: true, moderacao: true }, orderBy: { id: "asc" } }),
      db.reivindicacao.findMany({ where: { id: reivindicacaoId }, select: { id: true, status: true, motivoRecusa: true, revisadoPorId: true } }),
      db.depoimento.findMany({ where: { id: depoimentoId }, select: { id: true, status: true, denunciado: true } }),
      db.empresaMembro.count({ where: { empresaId: { in: ids } } }),
      db.registroAuditoria.count(),
    ]);
    return { empresas, reivindicacoes, depoimentos, donos, auditoria };
  }

  async function restaurar() {
    await db.registroAuditoria.deleteMany({ where: { OR: [{ usuarioId: { in: usuarios } }, { alvoId: { in: idsAuditados() } }] } });
    await db.empresaMembro.deleteMany({ where: { empresaId: { in: [empresaId, empresaPendenteId] } } });
    // O negócio da prova tem um dono, para que remover dono tenha o que mudar.
    await db.empresaMembro.create({ data: { empresaId, usuarioId: donoId } });
    // E um pedido do clube em análise, com o documento: remover o dono o recusa e apaga o arquivo.
    if (liberacaoId) {
      await db.liberacaoClube.update({ where: { id: liberacaoId }, data: { status: "pendente", motivo: null, documentoChaves: [chaveDoDocumento] } });
      writeFileSync(join(pastaDosDocumentos, chaveDoDocumento), BYTES_DO_DOCUMENTO);
    }
    await db.empresa.update({ where: { id: empresaId }, data: { moderacao: "aprovada" } });
    await db.empresa.update({ where: { id: empresaPendenteId }, data: { moderacao: "pendente" } });
    await db.reivindicacao.update({
      where: { id: reivindicacaoId },
      data: { status: "pendente", motivoRecusa: null, revisadoPorId: null, revisadoEm: null },
    });
    await db.depoimento.update({ where: { id: depoimentoId }, data: { status: "publicado", denunciado: true } });
  }

  beforeAll(async () => {
    const moderador = await criarPessoa("moderador");
    const membro = await criarPessoa("membro");
    cookieModerador = moderador.cookie;
    cookieMembro = membro.cookie;
    moderadorId = moderador.id;
    emailDoModerador = moderador.email;

    usernameDoNegocio = `runtime.${randomBytes(6).toString("hex")}`;
    const empresa = await db.empresa.create({
      data: {
        instagramUsername: usernameDoNegocio,
        nome: "Negócio da prova de runtime",
        resumo: "Negócio fictício para o teste local",
        categoria: "Serviços", cidade: "Recife", uf: "PE", moderacao: "aprovada",
      },
    });
    empresaId = empresa.id;
    donoId = (await criarPessoa("membro")).id;
    await db.empresaMembro.create({ data: { empresaId, usuarioId: donoId } });
    // Os dados abaixo fazem a fila mostrar todos os formulários de moderação.
    const pendente = await db.empresa.create({
      data: {
        instagramUsername: `runtime.${randomBytes(6).toString("hex")}`,
        nome: "Indicação da prova de runtime",
        resumo: "Indicação fictícia para o teste local",
        categoria: "Serviços", cidade: "Recife", uf: "PE", moderacao: "pendente",
      },
    });
    empresaPendenteId = pendente.id;
    reivindicacaoId = (await db.reivindicacao.create({
      data: {
        empresaId: pendente.id, usuarioId: membro.id, metodo: "documento", status: "pendente",
        expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })).id;
    depoimentoId = (await db.depoimento.create({
      data: {
        empresaId: empresa.id, autorId: membro.id, texto: "Depoimento fictício da prova de runtime",
        denunciado: true, motivoDenuncia: "Motivo fictício", denunciadoPorId: moderador.id,
      },
    })).id;

    const reserva = createServer();
    reserva.listen(0, "127.0.0.1");
    await once(reserva, "listening");
    const endereco = reserva.address();
    if (!endereco || typeof endereco === "string") throw new Error("Não foi possível reservar a porta local.");
    const porta = endereco.port;
    await new Promise<void>((concluir, falhar) => reserva.close((erro) => erro ? falhar(erro) : concluir()));
    origem = `http://127.0.0.1:${porta}`;

    pastaDoLog = mkdtempSync(join(tmpdir(), "negocio-do-bem-integracao-"));
    // Um documento de verdade (os primeiros bytes de um JPEG) na pasta que o servidor usa como bucket.
    pastaDosDocumentos = join(pastaDoLog, "documentos");
    mkdirSync(pastaDosDocumentos);
    chaveDoDocumento = `${randomBytes(16).toString("hex")}.jpg`;
    writeFileSync(join(pastaDosDocumentos, chaveDoDocumento), BYTES_DO_DOCUMENTO);
    liberacaoId = (await db.liberacaoClube.create({
      data: { empresaId, usuarioId: donoId, cnpj: "11222333000181", status: "pendente", documentoChaves: [chaveDoDocumento] },
    })).id;
    caminhoLog = join(pastaDoLog, "next.log");
    log = createWriteStream(caminhoLog);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(porta)], {
      cwd: raiz,
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: URL_BANCO_TESTE,
        APP_URL: origem,
        NEXT_TELEMETRY_DISABLED: "1",
        DOCUMENTOS_PASTA: pastaDosDocumentos,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout!.pipe(log, { end: false });
    servidor.stderr!.pipe(log, { end: false });
    servidor.stdout!.on("data", (dados: Buffer) => { saidaServidor += dados.toString(); });
    servidor.stderr!.on("data", (dados: Buffer) => { errosServidor += dados.toString(); });
    servidor.once("close", () => log!.end());
    await new Promise<void>((concluir, falhar) => {
      const espera = setTimeout(() => falhar(new Error(`O Next não iniciou. Consulte ${caminhoLog}.`)), 30_000);
      servidor!.stdout!.on("data", (dados: Buffer) => {
        if (dados.toString().includes("Ready")) { clearTimeout(espera); concluir(); }
      });
      servidor!.once("error", (erro) => { clearTimeout(espera); falhar(erro); });
      servidor!.once("exit", () => {
        clearTimeout(espera);
        falhar(new Error(`O Next encerrou antes de iniciar. Consulte ${caminhoLog}.`));
      });
    });

    // Os identificadores vêm dos formulários reais que a moderação recebe na fila compilada.
    async function formulariosDaAba(aba: string) {
      log!.write(`\nPROVA: GET ${aba} como moderador\n`);
      const { status, html } = await ler(`/moderacao?aba=${aba}`, cookieModerador);
      expect(status).toBe(200);
      return formularios(html);
    }
    const reivindicacoes = await formulariosDaAba("reivindicacoes");
    acoes.aprovarReivindicacoesSemDono = reivindicacoes.find((f) => f.corpo.includes("Estes chegaram antes dessa regra"))?.id ?? "";
    acoes.aprovarReivindicacao = reivindicacoes.find((f) => f.corpo.includes('name="modo"'))?.id ?? "";
    acoes.recusarReivindicacao = reivindicacoes.find((f) => f.corpo.includes('name="motivo"'))?.id ?? "";
    const indicacoes = await formulariosDaAba("indicacoes");
    acoes.publicarIndicacoesPendentes = indicacoes.find((f) => f.corpo.includes("Publicar todas"))?.id ?? "";
    acoes.moderarEmpresa = indicacoes.find((f) => f.corpo.includes(`value="${empresaPendenteId}"`))?.id ?? "";
    const denuncias = await formulariosDaAba("denuncias");
    acoes.decidirDenuncia = denuncias.find((f) => f.corpo.includes(`value="${depoimentoId}"`))?.id ?? "";
    log!.write("\nPROVA: GET edição do negócio como moderador\n");
    const edicao = await ler(`/moderacao/negocios/${usernameDoNegocio}`, cookieModerador);
    expect(edicao.status).toBe(200);
    acoes.removerDono = formularios(edicao.html).find((f) => f.corpo.includes('name="confirmo"'))?.id ?? "";
  }, 60_000);

  beforeEach(async () => {
    await restaurar();
  });

  afterAll(async () => {
    if (servidor?.pid && servidor.exitCode === null && servidor.signalCode === null) {
      const encerrado = once(servidor, "close");
      const espera = setTimeout(() => servidor!.kill("SIGKILL"), 5_000);
      servidor.kill("SIGTERM");
      await encerrado;
      clearTimeout(espera);
    }
    if (log && !log.writableFinished) await once(log, "finish");
    try {
      if (empresaId) {
        await db.registroAuditoria.deleteMany({ where: { OR: [{ usuarioId: { in: usuarios } }, { alvoId: { in: idsAuditados() } }] } });
        await db.empresa.deleteMany({ where: { id: { in: [empresaId, empresaPendenteId].filter(Boolean) } } });
      }
      await db.usuario.deleteMany({ where: { id: { in: usuarios } } });
    } finally {
      await db.$disconnect();
    }
    expect(errosServidor, `O Next escreveu erros. Log completo: ${caminhoLog}`).toBe("");
    expect(saidaServidor, `O Next registrou falha. Log completo: ${caminhoLog}`).not.toMatch(/⨯|(?:Error|TypeError|ReferenceError):/);
    if (pastaDoLog) rmSync(pastaDoLog, { recursive: true, force: true });
  });

  it("cobre toda Server Action de src/acoes/moderacao.ts", () => {
    const fonte = readFileSync(arquivoDasAcoes, "utf8");
    const exportadas = [...fonte.matchAll(/^export\s+(?:async\s+function|function|const|let|var)\s+(\w+)/gm)].map((trecho) => trecho[1]);
    expect(exportadas.sort()).toEqual([...ACOES].sort());
  });

  it("recebe da fila um identificador de ação diferente para cada Server Action", () => {
    for (const acao of ACOES) expect(acoes[acao], `A fila compilada deve expor o formulário de ${acao}.`).toMatch(/^\$ACTION_ID_/);
    expect(new Set(Object.values(acoes)).size).toBe(ACOES.length);
  });

  it("libera na CSP o Google Analytics e o Cloudflare Web Analytics", async () => {
    const resposta = await fetch(`${origem}/sobre`);
    await resposta.text();
    const diretivas = new Map(
      (resposta.headers.get("content-security-policy") ?? "")
        .split(";")
        .map((trecho) => trecho.trim().split(/\s+/))
        .map(([nome, ...fontes]) => [nome, fontes] as const),
    );
    // O Cloudflare injeta o script do Web Analytics, e o GA4 também envia para www.google.com/g/collect.
    expect(diretivas.get("script-src")).toEqual(expect.arrayContaining(["https://*.googletagmanager.com", "https://static.cloudflareinsights.com"]));
    expect(diretivas.get("connect-src")).toEqual(
      expect.arrayContaining(["https://*.google-analytics.com", "https://*.google.com", "https://cloudflareinsights.com"]),
    );
    expect(diretivas.get("frame-ancestors")).toEqual(["'none'"]);
  });

  describe.each(["visitante", "membro"])("%s", (papel) => {
    const cookie = () => (papel === "membro" ? cookieMembro : "");

    it.each(ACOES)("recusa %s sem gravar nada", async (acao) => {
      const antes = await estado();
      log!.write(`\nPROVA: POST ${acao} como ${papel}\n`);
      const resposta = await enviar(acao, cookie());
      await resposta.text();
      expect(await estado()).toEqual(antes);
      expect(resposta.status).toBe(303);
      expect(resposta.headers.get("location")).toBe("/404");
    });

    it("segue a recusa até a página 404, sem dados do negócio", async () => {
      const { status, html } = await ler("/404", cookie());
      expect(status).toBe(404);
      expect(html).toContain("Não encontramos esta página");
      expect(html).not.toContain("Negócio da prova de runtime");
    });

    it("não revela a fila", async () => {
      log!.write(`\nPROVA: GET fila como ${papel}\n`);
      const { status, html } = await ler("/moderacao?aba=negocios", cookie());
      expect([200, 404]).toContain(status);
      expect(html).toContain("Não encontramos esta página");
      expect(html).not.toContain("Negócio da prova de runtime");
      expect(html).not.toContain('name="empresaId"');
    });

    it("não revela a ficha da conta", async () => {
      log!.write(`\nPROVA: GET ficha da conta como ${papel}\n`);
      const { status, html } = await ler(`/moderacao/contas/${moderadorId}`, cookie());
      expect([200, 404]).toContain(status);
      expect(html).toContain("Não encontramos esta página");
      expect(html).not.toContain(emailDoModerador);
      expect(html).not.toContain("Conta criada em");
    });

    it("não revela a edição do negócio pela moderação", async () => {
      log!.write(`\nPROVA: GET edição do negócio como ${papel}\n`);
      const { status, html } = await ler(`/moderacao/negocios/${usernameDoNegocio}`, cookie());
      expect([200, 404]).toContain(status);
      expect(html).toContain("Não encontramos esta página");
      expect(html).not.toContain("Negócio da prova de runtime");
      expect(html).not.toContain("Você está editando como moderação");
    });
  });

  describe.each(["visitante", "membro"])("documento da verificação: %s", (papel) => {
    it("recebe 404, sem o arquivo", async () => {
      const resposta = await fetch(`${origem}/moderacao/documentos/${liberacaoId}/0`, { headers: { cookie: papel === "membro" ? cookieMembro : "" } });
      expect(resposta.status).toBe(404);
      expect(resposta.headers.get("content-type")).not.toContain("image/jpeg");
      expect(await db.registroAuditoria.count({ where: { acao: "clube.documento_visto" } })).toBe(0);
    });
  });

  describe("moderador (controle positivo)", () => {
    it("abre o documento da verificação, sem cache, e a abertura fica na auditoria", async () => {
      const resposta = await fetch(`${origem}/moderacao/documentos/${liberacaoId}/0`, { headers: { cookie: cookieModerador } });
      expect(resposta.status).toBe(200);
      expect(resposta.headers.get("content-type")).toBe("image/jpeg");
      expect(resposta.headers.get("cache-control")).toContain("no-store");
      expect(resposta.headers.get("x-content-type-options")).toBe("nosniff");
      expect((await resposta.arrayBuffer()).byteLength).toBe(12);
      expect(await db.registroAuditoria.count({ where: { acao: "clube.documento_visto", usuarioId: moderadorId } })).toBe(1);
      expect((await fetch(`${origem}/moderacao/documentos/${liberacaoId}/1`, { headers: { cookie: cookieModerador } })).status).toBe(404);
      expect((await fetch(`${origem}/moderacao/documentos/inexistente/0`, { headers: { cookie: cookieModerador } })).status).toBe(404);
    });

    it("vê a ficha da conta e a edição do negócio", async () => {
      const ficha = await ler(`/moderacao/contas/${moderadorId}`, cookieModerador);
      expect(ficha.status).toBe(200);
      expect(ficha.html).toContain("Conta criada em");
      expect(ficha.html).toContain(emailDoModerador);
      const edicao = await ler(`/moderacao/negocios/${usernameDoNegocio}`, cookieModerador);
      expect(edicao.status).toBe(200);
      expect(edicao.html).toContain("Você está editando como moderação");
      expect(edicao.html).toContain("Negócio da prova de runtime");
    });

    it("executa moderarEmpresa e grava a decisão e a auditoria", async () => {
      log!.write("\nPROVA: POST moderarEmpresa como moderador\n");
      const resposta = await enviar("moderarEmpresa", cookieModerador, { empresaId, de: "aprovada", decisao: "rejeitar", aba: "negocios" });
      await resposta.text();
      expect(resposta.status).toBe(303);
      expect(resposta.headers.get("location")).toContain("aviso=feito");
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).moderacao).toBe("rejeitada");
      expect(await db.registroAuditoria.count({ where: { alvoId: empresaId, acao: "empresa.rejeitada" } })).toBe(1);
    });

    it("executa recusarReivindicacao e grava a decisão e a auditoria", async () => {
      log!.write("\nPROVA: POST recusarReivindicacao como moderador\n");
      const resposta = await enviar("recusarReivindicacao", cookieModerador);
      await resposta.text();
      expect(resposta.status).toBe(303);
      expect(resposta.headers.get("location")).toContain("aviso=feito");
      expect(await db.reivindicacao.findUniqueOrThrow({ where: { id: reivindicacaoId } })).toMatchObject({
        status: "recusada", motivoRecusa: "Prova de runtime", revisadoPorId: moderadorId,
      });
      expect(await db.registroAuditoria.count({ where: { alvoId: empresaPendenteId, acao: "reivindicacao.recusada" } })).toBe(1);
    });

    it("executa removerDono e grava a remoção e a auditoria", async () => {
      log!.write("\nPROVA: POST removerDono como moderador\n");
      const resposta = await enviar("removerDono", cookieModerador);
      await resposta.text();
      expect(resposta.status).toBe(303);
      expect(resposta.headers.get("location")).toBe(`/moderacao/negocios/${usernameDoNegocio}?aviso=dono_removido#donos`);
      expect(await db.empresaMembro.count({ where: { empresaId } })).toBe(0);
      expect(await db.registroAuditoria.count({ where: { alvoId: empresaId, acao: "empresa.dono_removido" } })).toBe(1);
      // O pedido do clube em análise foi recusado, e o documento dele saiu do bucket.
      expect(await db.liberacaoClube.findUniqueOrThrow({ where: { id: liberacaoId } })).toMatchObject({ status: "recusada", documentoChaves: [] });
      expect(existsSync(join(pastaDosDocumentos, chaveDoDocumento))).toBe(false);
    });

    it("não remove o dono sem a confirmação marcada", async () => {
      const resposta = await enviar("removerDono", cookieModerador, { empresaId, usuarioId: donoId, motivo: "Prova de runtime" });
      await resposta.text();
      expect(resposta.status).toBe(303);
      expect(resposta.headers.get("location")).toContain("aviso=dono_sem_confirmacao");
      expect(await db.empresaMembro.count({ where: { empresaId } })).toBe(1);
    });

    it("executa decidirDenuncia e grava a decisão e a auditoria", async () => {
      log!.write("\nPROVA: POST decidirDenuncia como moderador\n");
      const resposta = await enviar("decidirDenuncia", cookieModerador, { depoimentoId, decisao: "manter" });
      await resposta.text();
      expect(resposta.status).toBe(303);
      expect(resposta.headers.get("location")).toContain("aviso=feito");
      expect(await db.depoimento.findUniqueOrThrow({ where: { id: depoimentoId } })).toMatchObject({ status: "publicado", denunciado: false });
      expect(await db.registroAuditoria.count({ where: { alvoId: depoimentoId, acao: "depoimento.mantido" } })).toBe(1);
    });
  });
});
