import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cadastrar, entrar, trocarSenha } from "@/acoes/conta";
import { criarLink, lerLink } from "@/lib/auth/links";
import * as senha from "@/lib/auth/senha";
import { LIMITE_POR_EMAIL, LIMITE_POR_IP, reservarTentativaDoEmail } from "@/lib/auth/tentativas";
import { db } from "@/lib/db";
import { authParaContaValidada } from "@/lib/auth/ponte-sessao";
import { gravarCookiesAuth } from "@/lib/auth/better-auth";
import { enviarEmail, type Email } from "@/lib/email";

// Estes testes passam pelas ações de verdade (entrar, cadastrar e trocarSenha). Só o que
// precisa de uma requisição do Next fica de mentira: os cabeçalhos, o redirect, os
// cookies, quem está logado, o after e o envio do e-mail. O scrypt é o de verdade, com espiões para contar quantas
// vezes ele roda: o limite existe para impedir justamente essas conferências.
const contexto = vi.hoisted(() => ({
  cabecalhos: {} as Record<string, string>,
  // Cabeçalhos das próximas chamadas, na ordem em que elas pedem os cabeçalhos.
  proximos: [] as Record<string, string>[],
  // Quem está logado (para exigirUsuario) e o token no cookie da sessão.
  usuario: null as { id: string; nome: string; email: string; moderador: boolean; emailConfirmado: boolean } | null,
  cookieSessao: undefined as string | undefined,
  depois: [] as (() => unknown)[],
}));
const criarSessao = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: async () => new Headers(contexto.proximos.shift() ?? contexto.cabecalhos),
  cookies: async () => ({
    get: (nome: string) => (nome === "ndb_sessao" && contexto.cookieSessao ? { value: contexto.cookieSessao } : undefined),
    set: (nome: string, valor: string) => { if (nome === "ndb_sessao") contexto.cookieSessao = valor; },
    toString: () => contexto.cookieSessao ? `ndb_sessao=${contexto.cookieSessao}` : "",
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirecionado");
  },
}));
vi.mock("next/server", () => ({ after: (tarefa: () => unknown) => contexto.depois.push(tarefa) }));
// O idDaSessaoAtual é o de verdade, para conferir no banco qual sessão sobra depois da troca.
vi.mock("@/lib/auth/sessao", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/auth/sessao")>();
  return {
    ...original,
    caminhoSeguro: () => "/",
    criarSessao,
    encerrarSessao: vi.fn(),
    exigirUsuario: async () => {
      if (!contexto.usuario) throw new Error("sem login");
      return contexto.usuario;
    },
  };
});
vi.mock("@/lib/email", () => ({ envioLigado: vi.fn(() => true), enviarEmail: vi.fn(async () => true) }));
vi.mock("@/lib/auth/senha", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/auth/senha")>();
  return {
    ...original,
    gerarHashSenha: vi.fn(original.gerarHashSenha),
    verificarSenha: vi.fn(original.verificarSenha),
  };
});

const SENHA_CERTA = "senha-certa-123";
const SENHA_ERRADA = "senha-errada-123";
const MENSAGEM_RECUSA = "E-mail ou senha incorretos.";
const MENSAGEM_LIMITE_CADASTRO = "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";

function formulario(email: string, senhaDigitada = SENHA_ERRADA) {
  const dados = new FormData();
  dados.set("nome", "Pessoa de teste");
  dados.set("email", email);
  dados.set("telefone", "(11) 99148-8052");
  dados.set("senha", senhaDigitada);
  return dados;
}

/** Tenta entrar `vezes` vezes, cada uma com um e-mail novo, para só o limite por IP agir. */
async function entrarVezes(vezes: number, cabecalhosDaVez: (indice: number) => Record<string, string>) {
  const respostas = [];
  for (let indice = 0; indice < vezes; indice++) {
    contexto.cabecalhos = cabecalhosDaVez(indice);
    respostas.push(await entrar({}, formulario(`pessoa-${indice}@exemplo.com`)));
  }
  return respostas;
}

/** Tenta cadastrar `vezes` vezes, cada uma com um e-mail novo. Devolve as respostas que não foram redirect. */
async function cadastrarVezes(vezes: number, cabecalhosDaVez: (indice: number) => Record<string, string>) {
  const respostas = [];
  for (let indice = 0; indice < vezes; indice++) {
    contexto.cabecalhos = cabecalhosDaVez(indice);
    try {
      respostas.push(await cadastrar({}, formulario(`nova-${indice}@exemplo.com`, SENHA_CERTA)));
    } catch (erro) {
      if (!(erro instanceof Error) || erro.message !== "redirecionado") throw erro;
    }
  }
  return respostas;
}

async function criarUsuario(email: string) {
  const usuario = await db.usuario.create({ data: { nome: "Pessoa de teste", email, senhaHash: await senha.gerarHashSenha(SENHA_CERTA) } });
  await db.vinculoAuth.create({ data: { usuarioId: usuario.id, contaId: usuario.id, provedorId: "credential", senha: usuario.senhaHash } });
  vi.clearAllMocks();
  return usuario;
}

function trabalhosSenha() {
  return vi.mocked(senha.gerarHashSenha).mock.calls.length + vi.mocked(senha.verificarSenha).mock.calls.length;
}

// O hash falso do entrar é calculado uma vez só e guardado no módulo. Aqui ele
// é calculado antes de todos os testes, para a contagem de gerarHashSenha não
// depender de qual teste roda primeiro.
beforeAll(async () => {
  await db.$executeRawUnsafe(`TRUNCATE "TentativaAcesso", "Usuario" CASCADE`);
  await entrar({}, formulario("aquecer@exemplo.com"));
  await db.$executeRawUnsafe(`TRUNCATE "TentativaAcesso", "Usuario" CASCADE`);
});

beforeEach(async () => {
  contexto.cabecalhos = {};
  contexto.proximos = [];
  contexto.usuario = null;
  contexto.cookieSessao = undefined;
  contexto.depois = [];
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("AUTENTICACAO_PROXY_CONFIAVEL", undefined);
  await db.$executeRawUnsafe(`TRUNCATE "TentativaAcesso", "Usuario" CASCADE`);
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await db.$executeRawUnsafe(`TRUNCATE "TentativaAcesso", "Usuario" CASCADE`);
  await db.$disconnect();
});

describe("de onde vem o IP", () => {
  it("no Vercel, usa só o x-vercel-forwarded-for e ignora o x-real-ip e o x-forwarded-for", async () => {
    const respostas = await entrarVezes(LIMITE_POR_IP + 2, (i) => ({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-real-ip": `198.51.100.${i + 1}`,
      "x-forwarded-for": `192.0.2.${i + 1}, 203.0.113.7`,
    }));
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(LIMITE_POR_IP + 2).fill(MENSAGEM_RECUSA));
  });

  it("no Vercel, sem x-vercel-forwarded-for, o IP é desconhecido: o x-forwarded-for e o x-real-ip não valem", async () => {
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-real-ip": `198.51.100.${i + 1}`, "x-forwarded-for": `192.0.2.${i + 1}` }));
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP);
  });

  it("fora do Vercel e sem proxy declarado, nenhum cabeçalho vale", async () => {
    vi.stubEnv("VERCEL", undefined);
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({
      "x-vercel-forwarded-for": `203.0.113.${i + 1}`,
      "x-real-ip": `198.51.100.${i + 1}`,
      "x-forwarded-for": `192.0.2.${i + 1}`,
    }));
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP);
  });

  it("com o proxy declarado, usa o último valor do x-forwarded-for, que é o que o proxy pôs", async () => {
    vi.stubEnv("VERCEL", undefined);
    vi.stubEnv("AUTENTICACAO_PROXY_CONFIAVEL", "1");
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({
      "x-forwarded-for": `192.0.2.${i + 1}, 198.51.100.${i + 1}, 203.0.113.7`,
      "x-real-ip": `198.51.100.${i + 1}`,
    }));
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP);
    // Outro IP posto pelo proxy tem a cota própria.
    contexto.cabecalhos = { "x-forwarded-for": "203.0.113.8" };
    await entrar({}, formulario("outra-pessoa@exemplo.com"));
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP + 1);
  });

  it("com o proxy declarado, um valor que não é IP vai para o contador do IP desconhecido", async () => {
    vi.stubEnv("VERCEL", undefined);
    vi.stubEnv("AUTENTICACAO_PROXY_CONFIAVEL", "1");
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-forwarded-for": i % 2 ? `nao-e-ip-${i}` : "" }));
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP);
  });
});

describe("limite por e-mail", () => {
  it("só 5 tentativas do mesmo lugar chegam ao scrypt", async () => {
    await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = { "x-vercel-forwarded-for": "198.51.100.1" };
    const respostas = [];
    for (let i = 0; i < LIMITE_POR_EMAIL + 2; i++) respostas.push(await entrar({}, formulario("ana@exemplo.com")));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_EMAIL);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(LIMITE_POR_EMAIL + 2).fill(MENSAGEM_RECUSA));
  });

  it("tentativas ao mesmo tempo, do mesmo lugar, também param em 5 no scrypt", async () => {
    await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = { "x-vercel-forwarded-for": "198.51.100.1" };
    const total = LIMITE_POR_IP;
    const respostas = await Promise.all(Array.from({ length: total }, () => entrar({}, formulario("ana@exemplo.com"))));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_EMAIL);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(total).fill(MENSAGEM_RECUSA));
  });

  it("quem erra a senha de outra pessoa não bloqueia a dona da conta, que entra de outro lugar", async () => {
    const usuario = await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = { "x-vercel-forwarded-for": "198.51.100.1" };
    for (let i = 0; i < LIMITE_POR_EMAIL + 2; i++) await entrar({}, formulario("ana@exemplo.com"));

    contexto.cabecalhos = { "x-vercel-forwarded-for": "203.0.113.50" };
    await expect(entrar({}, formulario("ana@exemplo.com", SENHA_CERTA))).rejects.toThrow("redirecionado");
    expect(await db.sessao.count({ where: { usuarioId: usuario.id, token: { not: null } } })).toBe(1);
    expect(Boolean(contexto.cookieSessao)).toBe(true);
  });

  it("cada lugar tem as próprias 5 tentativas para o mesmo e-mail", async () => {
    await criarUsuario("ana@exemplo.com");
    for (const ip of ["198.51.100.1", "198.51.100.2"]) {
      contexto.cabecalhos = { "x-vercel-forwarded-for": ip };
      for (let i = 0; i < LIMITE_POR_EMAIL + 1; i++) await entrar({}, formulario("ana@exemplo.com"));
    }
    expect(senha.verificarSenha).toHaveBeenCalledTimes(2 * LIMITE_POR_EMAIL);
  });
});

describe("o limite vale nas duas ações e vem antes do scrypt", () => {
  const vercel = { "x-vercel-forwarded-for": "203.0.113.7" };

  it("o cadastro para no limite por IP sem gerar o hash e sem criar conta", async () => {
    const respostas = await cadastrarVezes(LIMITE_POR_IP + 2, () => vercel);
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(2).fill(MENSAGEM_LIMITE_CADASTRO));
    expect(await db.usuario.count()).toBe(LIMITE_POR_IP);
  });

  it("cadastro e login dividem a cota do mesmo IP", async () => {
    await cadastrarVezes(6, () => vercel);
    await entrarVezes(6, () => vercel);
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP);
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
  });

  it("cadastros ao mesmo tempo, do mesmo IP, também geram só 10 hashes", async () => {
    contexto.cabecalhos = vercel;
    const respostas = await Promise.all(
      Array.from({ length: LIMITE_POR_IP + 5 }, (_, i) => cadastrar({}, formulario(`junto-${i}@exemplo.com`, SENHA_CERTA)).catch((erro: Error) => erro)),
    );
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    expect(respostas.filter((r) => r instanceof Error)).toHaveLength(LIMITE_POR_IP);
    expect(await db.usuario.count()).toBe(LIMITE_POR_IP);
  });

  it("depois do limite, nem a senha certa entra: a conferência nem acontece", async () => {
    await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = vercel;
    for (let i = 0; i < LIMITE_POR_IP; i++) await entrar({}, formulario(`outra-${i}@exemplo.com`));
    vi.clearAllMocks();
    const resposta = await entrar({}, formulario("ana@exemplo.com", SENHA_CERTA));
    expect(resposta?.erro).toBe(MENSAGEM_RECUSA);
    expect(senha.verificarSenha).not.toHaveBeenCalled();
    expect(criarSessao).not.toHaveBeenCalled();
  });

  it("depois do limite por e-mail, nem a senha certa entra do mesmo lugar: a conferência nem acontece", async () => {
    await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = { "x-vercel-forwarded-for": "198.51.100.1" };
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await entrar({}, formulario("ana@exemplo.com"));
    vi.clearAllMocks();
    const resposta = await entrar({}, formulario("ana@exemplo.com", SENHA_CERTA));
    expect(resposta?.erro).toBe(MENSAGEM_RECUSA);
    expect(senha.verificarSenha).not.toHaveBeenCalled();
    expect(criarSessao).not.toHaveBeenCalled();
  });

  it("no login, a recusa pelo IP, pelo e-mail e pela senha errada têm a mesma resposta", async () => {
    await criarUsuario("ana@exemplo.com");
    const senhaErrada = await entrar({}, formulario("ana@exemplo.com"));

    for (let i = 1; i < LIMITE_POR_EMAIL; i++) await entrar({}, formulario("ana@exemplo.com"));
    const porEmail = await entrar({}, formulario("ana@exemplo.com"));

    contexto.cabecalhos = { "x-vercel-forwarded-for": "203.0.113.99" };
    for (let i = 0; i < LIMITE_POR_IP; i++) await entrar({}, formulario(`outra-${i}@exemplo.com`));
    const porIp = await entrar({}, formulario("ana@exemplo.com"));

    expect(senhaErrada).toEqual({ erro: MENSAGEM_RECUSA, valores: expect.anything() });
    expect(porEmail).toEqual(senhaErrada);
    expect(porIp).toEqual(senhaErrada);
  });

  it("um login certo zera a contagem do e-mail naquele lugar e abre mais 5 tentativas", async () => {
    const usuario = await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = { "x-vercel-forwarded-for": "198.51.100.1" };
    for (let i = 0; i < LIMITE_POR_EMAIL - 1; i++) await entrar({}, formulario("ana@exemplo.com"));
    await expect(entrar({}, formulario("ana@exemplo.com", SENHA_CERTA))).rejects.toThrow("redirecionado");
    expect(await db.sessao.count({ where: { usuarioId: usuario.id, token: { not: null } } })).toBe(1);
    expect(Boolean(contexto.cookieSessao)).toBe(true);

    vi.clearAllMocks();
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await entrar({}, formulario("ana@exemplo.com"));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_EMAIL);
  });

  it("o banco guarda só o hash do IP e do e-mail", async () => {
    contexto.cabecalhos = vercel;
    await entrar({}, formulario("privado@exemplo.com"));
    const tentativas = await db.tentativaAcesso.findMany();
    expect(tentativas).toHaveLength(2);
    for (const { chave } of tentativas) {
      expect(chave).toMatch(/^[0-9a-f]{64}$/);
    }
    // A linha do limite por e-mail também guarda o e-mail só em hash.
    expect(tentativas.map((t) => t.email).filter(Boolean)).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/)]);
  });
});

describe("IPv6", () => {
  it("os endereços do mesmo prefixo /64 dividem a cota, mesmo com o IPv6 escrito de jeitos diferentes", async () => {
    const respostas = await entrarVezes(LIMITE_POR_IP + 2, (i) => ({
      "x-vercel-forwarded-for": i % 2 ? `2001:db8:abcd:12::${i + 1}` : `2001:0DB8:ABCD:0012:${i + 1}:ffff:ffff:ffff`,
    }));
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(LIMITE_POR_IP + 2).fill(MENSAGEM_RECUSA));
    // Outro prefixo /64 tem a cota própria.
    contexto.cabecalhos = { "x-vercel-forwarded-for": "2001:db8:abcd:13::1" };
    await entrar({}, formulario("outra-pessoa@exemplo.com"));
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP + 1);
  });

  it("o IPv4 escrito como IPv6 divide a cota com o IPv4", async () => {
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-vercel-forwarded-for": i % 2 ? "::ffff:203.0.113.5" : "203.0.113.5" }));
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP);
  });

  it("o cadastro também divide a cota por prefixo /64", async () => {
    await cadastrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-vercel-forwarded-for": `2001:db8:abcd:12::${i + 1}` }));
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
  });
});

describe("IP desconhecido", () => {
  it("o cadastro não confere o scrypt sem limite: todos os cadastros sem IP dividem um contador só", async () => {
    const respostas = await cadastrarVezes(LIMITE_POR_IP + 2, () => ({}));
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(2).fill(MENSAGEM_LIMITE_CADASTRO));
    expect(await db.usuario.count()).toBe(LIMITE_POR_IP);
  });

  it("login e cadastro sem IP dividem o mesmo contador", async () => {
    await cadastrarVezes(LIMITE_POR_IP - 2, () => ({}));
    await entrarVezes(4, () => ({}));
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    expect(trabalhosSenha()).toBe(LIMITE_POR_IP);
    expect(await db.tentativaAcesso.count()).toBe(1 + 2);
  });
});

describe("conta sem senha", () => {
  it("a conta criada pelo Google não entra com senha nenhuma, e a resposta é a mesma", async () => {
    contexto.cabecalhos = { "x-vercel-forwarded-for": "203.0.113.7" };
    await db.usuario.create({ data: { nome: "Pessoa do Google", email: "google@exemplo.com", googleId: "google-1" } });

    expect((await entrar({}, formulario("google@exemplo.com", "")))?.erro).toBe(MENSAGEM_RECUSA);
    expect((await entrar({}, formulario("google@exemplo.com", SENHA_CERTA)))?.erro).toBe(MENSAGEM_RECUSA);
    // Better Auth calculates a hash when no password credential exists.
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(2);
    expect(senha.verificarSenha).not.toHaveBeenCalled();
    expect(criarSessao).not.toHaveBeenCalled();
  });
});

describe("telefone no cadastro", () => {
  it("guarda o telefone com o 55 do Brasil", async () => {
    contexto.cabecalhos = { "x-vercel-forwarded-for": "203.0.113.7" };
    await expect(cadastrar({}, formulario("nova@exemplo.com", SENHA_CERTA))).rejects.toThrow("redirecionado");
    expect((await db.usuario.findUniqueOrThrow({ where: { email: "nova@exemplo.com" } })).telefone).toBe("5511991488052");
  });

  it.each([
    ["sem telefone", "", "Informe seu telefone com DDD."],
    ["com telefone sem DDD", "99148-8052", "Digite o telefone com DDD (ex.: 11 99148-8052)."],
  ])("%s, não cria a conta e mostra o erro no campo", async (_caso, telefone, mensagem) => {
    contexto.cabecalhos = { "x-vercel-forwarded-for": "203.0.113.7" };
    const dados = formulario("nova@exemplo.com", SENHA_CERTA);
    dados.set("telefone", telefone);

    const resposta = await cadastrar({}, dados);
    expect(resposta?.erros?.telefone).toBe(mensagem);
    expect(resposta?.valores?.telefone).toBe(telefone);
    expect(await db.usuario.count()).toBe(0);
    expect(senha.gerarHashSenha).not.toHaveBeenCalled();
  });
});

describe("trocar a senha no painel", () => {
  const vercel = { "x-vercel-forwarded-for": "198.51.100.1" };
  const NOVA_SENHA = "nova-senha-123";
  const MENSAGEM_LIMITE = "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";

  function hashDoToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  async function logar(email: string) {
    const usuario = await criarUsuario(email);
    contexto.usuario = { id: usuario.id, nome: usuario.nome, email, moderador: false, emailConfirmado: true };
    contexto.cabecalhos = vercel;
    return usuario;
  }

  function trocar(senhaAtual: string, novaSenha = NOVA_SENHA, confirmarSenha = novaSenha) {
    const dados = new FormData();
    dados.set("senhaAtual", senhaAtual);
    dados.set("novaSenha", novaSenha);
    dados.set("confirmarSenha", confirmarSenha);
    return trocarSenha({}, dados);
  }

  async function senhaGravada(id: string) {
    return (await db.usuario.findUniqueOrThrow({ where: { id } })).senhaHash;
  }

  async function rodarDepois() {
    for (const tarefa of contexto.depois.splice(0)) await tarefa();
  }

  it("com a senha atual certa, grava a nova, mantém só a sessão deste aparelho e gasta os links abertos", async () => {
    const usuario = await logar("ana@exemplo.com");
    const outra = await db.usuario.create({ data: { nome: "Outra", email: "outra@exemplo.com", senhaHash: "x" } });
    const expiraEm = new Date(Date.now() + 60_000);
    const resposta = await authParaContaValidada(usuario.id).api.sessaoValidada({ body: {}, returnHeaders: true });
    await gravarCookiesAuth(resposta.headers);
    const sessaoAtual = await db.sessao.findFirstOrThrow({ where: { usuarioId: usuario.id } });
    await db.sessao.createMany({
      data: [
        { id: hashDoToken("token-de-outro-aparelho"), usuarioId: usuario.id, expiraEm },
        { id: hashDoToken("token-de-outra-conta"), usuarioId: outra.id, expiraEm },
      ],
    });
    const linkDeEntrar = (await criarLink(usuario, "entrar"))!;
    const linkDaOutra = (await criarLink(outra, "entrar"))!;

    await expect(trocar(SENHA_CERTA)).rejects.toThrow("redirecionado");

    expect(await senha.verificarSenha(NOVA_SENHA, (await senhaGravada(usuario.id))!)).toBe(true);
    const sessoes = await db.sessao.findMany({ select: { id: true } });
    expect(sessoes.map((s) => s.id).sort()).toEqual([sessaoAtual.id, hashDoToken("token-de-outra-conta")].sort());
    expect(await lerLink(linkDeEntrar)).toBeNull();
    expect(await lerLink(linkDaOutra)).not.toBeNull();
    expect(await db.registroAuditoria.findFirstOrThrow()).toMatchObject({
      usuarioId: usuario.id,
      acao: "usuario.senha_trocada",
      alvoTipo: "usuario",
      alvoId: usuario.id,
    });
  });

  it("avisa a dona por e-mail, depois da resposta", async () => {
    await logar("ana@exemplo.com");
    await expect(trocar(SENHA_CERTA)).rejects.toThrow("redirecionado");
    expect(enviarEmail).not.toHaveBeenCalled();

    await rodarDepois();
    const [email] = vi.mocked(enviarEmail).mock.calls.map(([e]) => e as Email);
    expect(email).toMatchObject({ para: "ana@exemplo.com", assunto: expect.stringContaining("foi trocada") });
    expect(email!.texto).toContain("no painel");
  });

  it("zera as tentativas do e-mail em todas as origens", async () => {
    await logar("ana@exemplo.com");
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await reservarTentativaDoEmail("ana@exemplo.com", "203.0.113.80");

    await expect(trocar(SENHA_CERTA)).rejects.toThrow("redirecionado");
    expect(await reservarTentativaDoEmail("ana@exemplo.com", "203.0.113.80")).toBe(true);
  });

  it("com a senha atual errada, mostra o erro no campo e não muda nada", async () => {
    const usuario = await logar("ana@exemplo.com");
    const antes = await senhaGravada(usuario.id);
    await db.sessao.create({ data: { id: hashDoToken("outro-aparelho"), usuarioId: usuario.id, expiraEm: new Date(Date.now() + 60_000) } });

    const resposta = await trocar(SENHA_ERRADA);

    expect(resposta?.erros?.senhaAtual).toBe("Senha atual incorreta.");
    expect(await senhaGravada(usuario.id)).toBe(antes);
    expect(await db.sessao.count()).toBe(1);
    expect(await db.registroAuditoria.count()).toBe(0);
  });

  it("nova senha curta ou confirmação diferente nem chegam ao scrypt nem contam tentativa", async () => {
    await logar("ana@exemplo.com");
    expect((await trocar(SENHA_CERTA, "curta"))?.erros?.novaSenha).toBe("Use pelo menos 8 caracteres.");
    expect((await trocar(SENHA_CERTA, NOVA_SENHA, "outra-coisa-123"))?.erros?.confirmarSenha).toBe("As senhas não conferem.");
    expect((await trocar(""))?.erros?.senhaAtual).toBe("Digite a senha atual.");
    expect(senha.verificarSenha).not.toHaveBeenCalled();
    expect(await db.tentativaAcesso.count()).toBe(0);
  });

  it("a senha atual tem o limite por e-mail, conferido antes do scrypt", async () => {
    const usuario = await logar("ana@exemplo.com");
    const respostas = [];
    for (let i = 0; i < LIMITE_POR_EMAIL + 2; i++) respostas.push(await trocar(SENHA_ERRADA));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_EMAIL);
    expect(respostas.slice(LIMITE_POR_EMAIL).map((r) => r?.erro)).toEqual(Array(2).fill(MENSAGEM_LIMITE));

    // Depois do limite, nem a senha certa troca: a conferência nem acontece.
    vi.clearAllMocks();
    const antes = await senhaGravada(usuario.id);
    expect((await trocar(SENHA_CERTA))?.erro).toBe(MENSAGEM_LIMITE);
    expect(senha.verificarSenha).not.toHaveBeenCalled();
    expect(await senhaGravada(usuario.id)).toBe(antes);
  });

  it("divide a cota do IP com o login e o cadastro", async () => {
    await logar("ana@exemplo.com");
    await entrarVezes(LIMITE_POR_IP, () => vercel);
    vi.clearAllMocks();
    expect((await trocar(SENHA_CERTA))?.erro).toBe(MENSAGEM_LIMITE);
    expect(senha.verificarSenha).not.toHaveBeenCalled();
  });

  it("de duas trocas ao mesmo tempo, só uma passa", async () => {
    const usuario = await logar("ana@exemplo.com");
    const respostas = await Promise.all([
      trocar(SENHA_CERTA, "primeira-nova-123").catch((erro: Error) => erro),
      trocar(SENHA_CERTA, "segunda-nova-123").catch((erro: Error) => erro),
    ]);

    expect(respostas.filter((r) => r instanceof Error)).toHaveLength(1);
    expect(respostas.find((r) => !(r instanceof Error))).toEqual({ erro: expect.stringContaining("A senha mudou") });
    const gravada = (await senhaGravada(usuario.id))!;
    const confere = await Promise.all(["primeira-nova-123", "segunda-nova-123"].map((s) => senha.verificarSenha(s, gravada)));
    expect(confere.filter(Boolean)).toHaveLength(1);
    expect(await db.registroAuditoria.count()).toBe(1);
  });

  it("a conta sem senha (do Google) não troca por aqui: ela cria a senha pelo link", async () => {
    const usuario = await db.usuario.create({ data: { nome: "Pessoa do Google", email: "google@exemplo.com", googleId: "google-1" } });
    contexto.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, moderador: false, emailConfirmado: true };
    contexto.cabecalhos = vercel;

    expect((await trocar(SENHA_CERTA))?.erros?.senhaAtual).toBe("Senha atual incorreta.");
    expect(await senhaGravada(usuario.id)).toBeNull();
  });

  it("sem login, não troca nada", async () => {
    await expect(trocar(SENHA_CERTA)).rejects.toThrow("sem login");
    expect(senha.verificarSenha).not.toHaveBeenCalled();
  });
});
