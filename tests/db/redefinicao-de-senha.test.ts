import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { criarSenhaComLink, entrar, mandarLinkDeSenhaNova, pedirRedefinicaoDeSenha, usarLinkDoEmail } from "@/acoes/conta";
import { COOKIE_LINK, criarLink, enviarLink, LIMITE_LINKS_POR_HORA, lerLink, redefinirSenhaComLink } from "@/lib/auth/links";
import { gerarHashSenha, verificarSenha } from "@/lib/auth/senha";
import { LIMITE_POR_EMAIL, LIMITE_POR_IP, reservarTentativaDoEmail } from "@/lib/auth/tentativas";
import { db } from "@/lib/db";
import { enviarEmail, type Email } from "@/lib/email";

// "Esqueci minha senha" e o link de senha nova do painel. Passa pelas ações de verdade:
// só o que precisa de uma requisição do Next fica de mentira (cabeçalhos, cookies,
// redirect, after, a sessão e quem está logado), e o envio do e-mail.
const contexto = vi.hoisted(() => ({
  cabecalhos: {} as Record<string, string>,
  cookies: new Map<string, string>(),
  depois: [] as (() => unknown)[],
  usuario: null as { id: string; nome: string; email: string } | null,
}));
const criarSessao = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: async () => new Headers(contexto.cabecalhos),
  cookies: async () => ({
    get: (nome: string) => (contexto.cookies.has(nome) ? { value: contexto.cookies.get(nome) } : undefined),
    delete: (valor: string | { name: string }) => contexto.cookies.delete(typeof valor === "string" ? valor : valor.name),
    set: (nome: string, valor: string) => contexto.cookies.set(nome, valor),
    toString: () => [...contexto.cookies].map(([nome, valor]) => `${nome}=${valor}`).join("; "),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirecionado:${destino}`);
  },
}));
vi.mock("next/server", () => ({ after: (tarefa: () => unknown) => contexto.depois.push(tarefa) }));
vi.mock("@/lib/auth/sessao", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/auth/sessao")>();
  criarSessao.mockImplementation(original.criarSessao);
  return {
    ...original,
    caminhoSeguro: () => "/",
    criarSessao,
    exigirUsuario: async () => {
      if (!contexto.usuario) throw new Error("sem login");
      return { ...contexto.usuario, moderador: false, emailConfirmado: true };
    },
  };
});
vi.mock("@/lib/email", () => ({ envioLigado: vi.fn(() => true), enviarEmail: vi.fn(async () => true) }));

const enviados = () => vi.mocked(enviarEmail).mock.calls.map(([email]) => email as Email);

/** Roda o que a ação deixou para depois da resposta, como o `after` faz. */
async function rodarDepois() {
  for (const tarefa of contexto.depois.splice(0)) await tarefa();
}

/** A mensagem do redirect, ou null se a ação voltou sem redirecionar. */
async function redirecionou(promessa: Promise<unknown>) {
  try {
    await promessa;
  } catch (erro) {
    return (erro as Error).message;
  }
  return null;
}

function dadosEmail(email: string) {
  const dados = new FormData();
  dados.set("email", email);
  return dados;
}

function dadosSenha(novaSenha: string, confirmarSenha = novaSenha) {
  const dados = new FormData();
  dados.set("novaSenha", novaSenha);
  dados.set("confirmarSenha", confirmarSenha);
  return dados;
}

async function criarConta(email = "ana@exemplo.com", senha: string | null = "senha-antiga-123") {
  const senhaHash = senha ? await gerarHashSenha(senha) : null;
  const usuario = await db.usuario.create({
    data: { nome: "Ana Souza", email, senhaHash },
    select: { id: true, nome: true, email: true },
  });
  if (senhaHash) await db.vinculoAuth.create({ data: { usuarioId: usuario.id, contaId: usuario.id, provedorId: "credential", senha: senhaHash } });
  return usuario;
}

async function senhaConfere(id: string, senha: string) {
  const { senhaHash } = await db.usuario.findUniqueOrThrow({ where: { id } });
  return senhaHash !== null && (await verificarSenha(senha, senhaHash));
}

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "LinkEmail", "TentativaAcesso", "RegistroAuditoria", "Sessao", "Usuario" CASCADE`);
}

beforeEach(async () => {
  await limparBanco();
  contexto.cookies.clear();
  contexto.depois.length = 0;
  contexto.cabecalhos = { "x-vercel-forwarded-for": "203.0.113.7" };
  contexto.usuario = null;
  vi.stubEnv("VERCEL", "1");
  vi.mocked(enviarEmail).mockClear();
  criarSessao.mockClear();
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("redefinirSenhaComLink", () => {
  it("troca a senha, encerra todas as sessões, confirma o e-mail e grava a auditoria", async () => {
    const ana = await criarConta();
    await db.sessao.create({ data: { id: "s1", usuarioId: ana.id, expiraEm: new Date(Date.now() + 60_000) } });
    const token = (await criarLink(ana, "redefinir"))!;

    expect(await redefinirSenhaComLink(token, "senha-nova-456")).toEqual(ana);

    expect(await senhaConfere(ana.id, "senha-nova-456")).toBe(true);
    expect(await senhaConfere(ana.id, "senha-antiga-123")).toBe(false);
    expect((await db.usuario.findUniqueOrThrow({ where: { id: ana.id } })).emailConfirmadoEm).not.toBeNull();
    expect(await db.sessao.count()).toBe(0);
    expect(await db.registroAuditoria.findFirstOrThrow()).toMatchObject({
      usuarioId: ana.id,
      acao: "usuario.senha_redefinida",
      alvoTipo: "usuario",
      alvoId: ana.id,
    });
  });

  it("atualiza as duas senhas e aceita somente a nova pelo login real", async () => {
    const ana = await criarConta();
    const login = (senha: string) => { const dados = dadosEmail(ana.email); dados.set("senha", senha); return entrar({}, dados); };
    expect(await redirecionou(login("senha-antiga-123"))).toBe("redirecionado:/");
    expect(await redefinirSenhaComLink((await criarLink(ana, "redefinir"))!, "senha-nova-456")).toEqual(ana);
    const usuario = await db.usuario.findUniqueOrThrow({ where: { id: ana.id } });
    const credencial = await db.vinculoAuth.findFirstOrThrow({ where: { usuarioId: ana.id, provedorId: "credential" } });
    expect(credencial.senha === usuario.senhaHash).toBe(true);
    expect((await login("senha-antiga-123"))?.erro).toBe("E-mail ou senha incorretos.");
    expect(await redirecionou(login("senha-nova-456"))).toBe("redirecionado:/");
  });

  it("falha na auditoria preserva ambas as senhas, links e sessões", async () => {
    const ana = await criarConta();
    const login = (senha: string) => { const dados = dadosEmail(ana.email); dados.set("senha", senha); return entrar({}, dados); };
    expect(await redirecionou(login("senha-antiga-123"))).toBe("redirecionado:/");
    const token = (await criarLink(ana, "redefinir"))!;
    await criarLink(ana, "entrar");
    const antes = {
      usuario: await db.usuario.findUniqueOrThrow({ where: { id: ana.id } }),
      credenciais: await db.vinculoAuth.findMany({ orderBy: { id: "asc" } }),
      links: await db.linkEmail.findMany({ orderBy: { id: "asc" } }),
      sessoes: await db.sessao.findMany({ orderBy: { id: "asc" } }),
    };
    await db.$executeRawUnsafe(`CREATE FUNCTION prova_auth_falha_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Local proof audit failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER prova_auth_falha BEFORE INSERT ON "RegistroAuditoria" FOR EACH ROW EXECUTE FUNCTION prova_auth_falha_auditoria()`);
    try {
      await expect(redefinirSenhaComLink(token, "senha-nova-456")).rejects.toThrow();
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER prova_auth_falha ON "RegistroAuditoria"`);
      await db.$executeRawUnsafe(`DROP FUNCTION prova_auth_falha_auditoria()`);
    }
    const depois = {
      usuario: await db.usuario.findUniqueOrThrow({ where: { id: ana.id } }),
      credenciais: await db.vinculoAuth.findMany({ orderBy: { id: "asc" } }),
      links: await db.linkEmail.findMany({ orderBy: { id: "asc" } }),
      sessoes: await db.sessao.findMany({ orderBy: { id: "asc" } }),
    };
    // Compare internally. A failed assertion must not print tokens or password hashes.
    expect(JSON.stringify(depois) === JSON.stringify(antes)).toBe(true);
    expect(await db.registroAuditoria.count()).toBe(0);
    expect((await login("senha-nova-456"))?.erro).toBe("E-mail ou senha incorretos.");
    expect(await redirecionou(login("senha-antiga-123"))).toBe("redirecionado:/");
  });

  it("o link vale uma vez só, mesmo com três envios ao mesmo tempo", async () => {
    const ana = await criarConta();
    const token = (await criarLink(ana, "redefinir"))!;

    const resultados = await Promise.all([
      redefinirSenhaComLink(token, "senha-nova-111"),
      redefinirSenhaComLink(token, "senha-nova-222"),
      redefinirSenhaComLink(token, "senha-nova-333"),
    ]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(await db.registroAuditoria.count()).toBe(1);
  });

  it("gasta os outros links abertos da conta, inclusive o de entrar, e não mexe nos de outra conta", async () => {
    const ana = await criarConta();
    const bia = await criarConta("bia@exemplo.com");
    const token = (await criarLink(ana, "redefinir"))!;
    const deEntrar = (await criarLink(ana, "entrar"))!;
    const outroRedefinir = (await criarLink(ana, "redefinir"))!;
    const deBia = (await criarLink(bia, "entrar"))!;

    await redefinirSenhaComLink(token, "senha-nova-456");

    expect(await lerLink(deEntrar)).toBeNull();
    expect(await lerLink(outroRedefinir)).toBeNull();
    expect(await lerLink(deBia)).not.toBeNull();
  });

  it("não aceita link vencido, de outra finalidade nem token inventado", async () => {
    const ana = await criarConta();
    const vencido = (await criarLink(ana, "redefinir"))!;
    await db.linkEmail.updateMany({ data: { expiraEm: new Date(Date.now() - 1000) } });
    const deEntrar = (await criarLink(ana, "entrar"))!;
    const deConfirmar = (await criarLink(ana, "confirmar"))!;

    for (const token of [vencido, deEntrar, deConfirmar, "inventado", ""]) {
      expect(await redefinirSenhaComLink(token, "senha-nova-456")).toBeNull();
    }
    expect(await senhaConfere(ana.id, "senha-antiga-123")).toBe(true);
    expect(await db.registroAuditoria.count()).toBe(0);
  });

  it("o link de senha nova vale por 1 hora, e dois pedidos em seguida valem os dois até um ser usado", async () => {
    const ana = await criarConta();
    const primeiro = (await criarLink(ana, "redefinir"))!;
    const segundo = (await criarLink(ana, "redefinir"))!;
    const link = await db.linkEmail.findFirstOrThrow();

    expect(Math.round((link.expiraEm.getTime() - link.criadoEm.getTime()) / 60_000)).toBe(60);
    expect(await lerLink(primeiro)).not.toBeNull();
    expect(await lerLink(segundo)).not.toBeNull();
  });

  it("a conta criada pelo Google, sem senha, passa a ter uma", async () => {
    const ana = await criarConta("ana@exemplo.com", null);
    expect(await redefinirSenhaComLink((await criarLink(ana, "redefinir"))!, "senha-nova-456")).toEqual(ana);
    expect(await senhaConfere(ana.id, "senha-nova-456")).toBe(true);
    expect(await db.vinculoAuth.count({ where: { usuarioId: ana.id, provedorId: "credential" } })).toBe(1);
  });
});

describe("o e-mail do link", () => {
  it("manda o link de senha nova, com a validade", async () => {
    const ana = await criarConta();
    await enviarLink(ana, "redefinir", "tok123");
    expect(enviados()).toHaveLength(1);
    expect(enviados()[0]).toMatchObject({ para: "ana@exemplo.com", assunto: expect.stringContaining("senha nova") });
    expect(enviados()[0]!.texto).toContain("/api/link?t=tok123");
    expect(enviados()[0]!.texto).toContain("1 hora");
  });
});

describe("pedirRedefinicaoDeSenha", () => {
  it("responde igual com ou sem conta, e só cria o link e manda o e-mail depois da resposta", async () => {
    await criarConta();
    const comConta = await redirecionou(pedirRedefinicaoDeSenha({}, dadosEmail("ana@exemplo.com")));
    const semConta = await redirecionou(pedirRedefinicaoDeSenha({}, dadosEmail("ninguem@exemplo.com")));
    expect(comConta).toBe("redirecionado:/entrar?aviso=redefinicao_pedida");
    expect(semConta).toBe(comConta);
    expect(enviados()).toHaveLength(0);
    expect(await db.linkEmail.count()).toBe(0);

    await rodarDepois();
    expect(enviados().map((e) => e.para)).toEqual(["ana@exemplo.com"]);
    expect((await db.linkEmail.findFirstOrThrow()).finalidade).toBe("redefinir");
  });

  it("recusa e-mail inválido e mantém o que foi digitado", async () => {
    const resposta = await pedirRedefinicaoDeSenha({}, dadosEmail("isso-nao-e-email"));
    expect(resposta?.erros?.email).toBeTruthy();
    expect(resposta?.valores?.email).toBe("isso-nao-e-email");
  });

  it("para no limite por IP, sem criar link nem mandar e-mail", async () => {
    await criarConta();
    for (let i = 0; i < LIMITE_POR_IP; i++) await redirecionou(pedirRedefinicaoDeSenha({}, dadosEmail(`x${i}@exemplo.com`)));
    const resposta = await pedirRedefinicaoDeSenha({}, dadosEmail("ana@exemplo.com"));
    expect(resposta?.erro).toMatch(/Muitas tentativas/);
    await rodarDepois();
    expect(enviados()).toHaveLength(0);
    expect(await db.linkEmail.count()).toBe(0);
  });

  it(`cada conta recebe no máximo ${LIMITE_LINKS_POR_HORA} links por hora, mesmo de IPs diferentes`, async () => {
    await criarConta();
    for (let i = 0; i < LIMITE_LINKS_POR_HORA + 3; i++) {
      contexto.cabecalhos = { "x-vercel-forwarded-for": `203.0.113.${10 + i}` };
      await redirecionou(pedirRedefinicaoDeSenha({}, dadosEmail("ana@exemplo.com")));
      await rodarDepois();
    }
    expect(enviados()).toHaveLength(LIMITE_LINKS_POR_HORA);
  });
});

describe("criarSenhaComLink", () => {
  it("troca a senha, apaga o cookie, entra neste aparelho, zera as tentativas de todas as origens e avisa a dona", async () => {
    const ana = await criarConta();
    contexto.cookies.set(COOKIE_LINK, (await criarLink(ana, "redefinir"))!);
    for (const ip of ["198.51.100.1", "198.51.100.2"]) {
      for (let i = 0; i < LIMITE_POR_EMAIL; i++) await reservarTentativaDoEmail("ana@exemplo.com", ip);
      expect(await reservarTentativaDoEmail("ana@exemplo.com", ip)).toBe(false);
    }

    expect(await redirecionou(criarSenhaComLink({}, dadosSenha("senha-nova-456")))).toBe("redirecionado:/painel?aviso=senha_trocada");

    expect(await senhaConfere(ana.id, "senha-nova-456")).toBe(true);
    expect(contexto.cookies.has(COOKIE_LINK)).toBe(false);
    expect(criarSessao).toHaveBeenCalledExactlyOnceWith(ana.id);
    for (const ip of ["198.51.100.1", "198.51.100.2"]) expect(await reservarTentativaDoEmail("ana@exemplo.com", ip)).toBe(true);
    expect(enviados()).toHaveLength(0);
    await rodarDepois();
    expect(enviados()).toHaveLength(1);
    expect(enviados()[0]).toMatchObject({ para: "ana@exemplo.com", assunto: expect.stringContaining("foi trocada") });
    expect(enviados()[0]!.texto).toContain("Esqueci minha senha");
  });

  it("depois da troca, a senha nova entra pelo login, mesmo de onde a pessoa tinha errado", async () => {
    const ana = await criarConta();
    const dadosEntrar = (senha: string) => {
      const dados = dadosEmail("ana@exemplo.com");
      dados.set("senha", senha);
      return dados;
    };
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await entrar({}, dadosEntrar("chute-errado-1"));
    contexto.cookies.set(COOKIE_LINK, (await criarLink(ana, "redefinir"))!);
    await redirecionou(criarSenhaComLink({}, dadosSenha("senha-nova-456")));
    criarSessao.mockClear();

    expect(await redirecionou(entrar({}, dadosEntrar("senha-nova-456")))).toBe("redirecionado:/");
    expect(await db.sessao.count({ where: { usuarioId: ana.id } })).toBeGreaterThan(0);
    expect(contexto.cookies.has("ndb_sessao")).toBe(true);
  });

  it("não zera as tentativas de outro e-mail", async () => {
    const ana = await criarConta();
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await reservarTentativaDoEmail("bia@exemplo.com", "198.51.100.1");
    contexto.cookies.set(COOKIE_LINK, (await criarLink(ana, "redefinir"))!);
    await redirecionou(criarSenhaComLink({}, dadosSenha("senha-nova-456")));
    expect(await reservarTentativaDoEmail("bia@exemplo.com", "198.51.100.1")).toBe(false);
  });

  it.each([
    ["senha curta", dadosSenha("curta"), "novaSenha"],
    ["confirmação diferente", dadosSenha("senha-nova-456", "senha-nova-457"), "confirmarSenha"],
  ])("%s mostra o erro no campo, sem gastar o link", async (_caso, dados, campo) => {
    const ana = await criarConta();
    const token = (await criarLink(ana, "redefinir"))!;
    contexto.cookies.set(COOKIE_LINK, token);

    const resposta = await criarSenhaComLink({}, dados);
    expect(resposta?.erros?.[campo]).toBeTruthy();
    expect(await lerLink(token)).not.toBeNull();
    expect(await senhaConfere(ana.id, "senha-antiga-123")).toBe(true);
  });

  it("sem cookie ou com o link já usado, mostra o erro e não troca nada", async () => {
    const ana = await criarConta();
    expect((await criarSenhaComLink({}, dadosSenha("senha-nova-456")))?.erro).toMatch(/venceu/);

    const token = (await criarLink(ana, "redefinir"))!;
    await redefinirSenhaComLink(token, "senha-nova-456");
    contexto.cookies.set(COOKIE_LINK, token);
    expect((await criarSenhaComLink({}, dadosSenha("outra-senha-789")))?.erro).toMatch(/venceu/);
    expect(await senhaConfere(ana.id, "senha-nova-456")).toBe(true);
    expect(criarSessao).not.toHaveBeenCalled();
  });

  it("passa pelo limite por IP, porque calcula o scrypt", async () => {
    const ana = await criarConta();
    for (let i = 0; i < LIMITE_POR_IP; i++) await criarSenhaComLink({}, dadosSenha("senha-nova-456"));
    contexto.cookies.set(COOKIE_LINK, (await criarLink(ana, "redefinir"))!);
    expect((await criarSenhaComLink({}, dadosSenha("senha-nova-456")))?.erro).toMatch(/Muitas tentativas/);
    expect(await senhaConfere(ana.id, "senha-antiga-123")).toBe(true);
  });
});

describe("usarLinkDoEmail", () => {
  it("não gasta um link de senha nova: ele só se usa criando a senha", async () => {
    const ana = await criarConta();
    const token = (await criarLink(ana, "redefinir"))!;
    contexto.cookies.set(COOKIE_LINK, token);

    expect(await redirecionou(usarLinkDoEmail())).toBe("redirecionado:/link");
    expect(await lerLink(token)).not.toBeNull();
    expect(contexto.cookies.has(COOKIE_LINK)).toBe(true);
    expect(criarSessao).not.toHaveBeenCalled();
    expect((await db.usuario.findUniqueOrThrow({ where: { id: ana.id } })).emailConfirmadoEm).toBeNull();
  });
});

describe("mandarLinkDeSenhaNova (no painel)", () => {
  it("manda o link de senha nova para o e-mail de quem está logado, depois da resposta", async () => {
    contexto.usuario = await criarConta("ana@exemplo.com", null);

    expect(await mandarLinkDeSenhaNova()).toEqual({ enviado: true });
    expect((await db.linkEmail.findFirstOrThrow()).finalidade).toBe("redefinir");
    await rodarDepois();
    expect(enviados().map((e) => e.para)).toEqual(["ana@exemplo.com"]);
  });

  it(`passa do limite de ${LIMITE_LINKS_POR_HORA} links por hora com um aviso`, async () => {
    contexto.usuario = await criarConta();
    for (let i = 0; i < LIMITE_LINKS_POR_HORA; i++) await mandarLinkDeSenhaNova();
    expect((await mandarLinkDeSenhaNova())?.erro).toMatch(/muitos e-mails/);
    expect(await db.linkEmail.count()).toBe(LIMITE_LINKS_POR_HORA);
  });

  it("sem login, não manda nada", async () => {
    await expect(mandarLinkDeSenhaNova()).rejects.toThrow("sem login");
    expect(await db.linkEmail.count()).toBe(0);
  });
});
