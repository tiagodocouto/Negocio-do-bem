import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cadastrar, entrar } from "@/acoes/conta";
import * as senha from "@/lib/auth/senha";
import { LIMITE_POR_EMAIL, LIMITE_POR_IP } from "@/lib/auth/tentativas";
import { db } from "@/lib/db";

// Estes testes passam pelas ações de verdade (entrar e cadastrar). Só o que
// precisa de uma requisição do Next fica de mentira: os cabeçalhos, o redirect,
// o cookie da sessão e o after (o e-mail de confirmação do cadastro). O scrypt é o de verdade, com espiões para contar quantas
// vezes ele roda: o limite existe para impedir justamente essas conferências.
const contexto = vi.hoisted(() => ({
  cabecalhos: {} as Record<string, string>,
  // Cabeçalhos das próximas chamadas, na ordem em que elas pedem os cabeçalhos.
  proximos: [] as Record<string, string>[],
}));
const criarSessao = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: async () => new Headers(contexto.proximos.shift() ?? contexto.cabecalhos) }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirecionado");
  },
}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/auth/sessao", () => ({ caminhoSeguro: () => "/", criarSessao, encerrarSessao: vi.fn() }));
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
  vi.clearAllMocks();
  return usuario;
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
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(LIMITE_POR_IP + 2).fill(MENSAGEM_RECUSA));
  });

  it("no Vercel, sem x-vercel-forwarded-for, o IP é desconhecido: o x-forwarded-for e o x-real-ip não valem", async () => {
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-real-ip": `198.51.100.${i + 1}`, "x-forwarded-for": `192.0.2.${i + 1}` }));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
  });

  it("fora do Vercel e sem proxy declarado, nenhum cabeçalho vale", async () => {
    vi.stubEnv("VERCEL", undefined);
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({
      "x-vercel-forwarded-for": `203.0.113.${i + 1}`,
      "x-real-ip": `198.51.100.${i + 1}`,
      "x-forwarded-for": `192.0.2.${i + 1}`,
    }));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
  });

  it("com o proxy declarado, usa o último valor do x-forwarded-for, que é o que o proxy pôs", async () => {
    vi.stubEnv("VERCEL", undefined);
    vi.stubEnv("AUTENTICACAO_PROXY_CONFIAVEL", "1");
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({
      "x-forwarded-for": `192.0.2.${i + 1}, 198.51.100.${i + 1}, 203.0.113.7`,
      "x-real-ip": `198.51.100.${i + 1}`,
    }));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    // Outro IP posto pelo proxy tem a cota própria.
    contexto.cabecalhos = { "x-forwarded-for": "203.0.113.8" };
    await entrar({}, formulario("outra-pessoa@exemplo.com"));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP + 1);
  });

  it("com o proxy declarado, um valor que não é IP vai para o contador do IP desconhecido", async () => {
    vi.stubEnv("VERCEL", undefined);
    vi.stubEnv("AUTENTICACAO_PROXY_CONFIAVEL", "1");
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-forwarded-for": i % 2 ? `nao-e-ip-${i}` : "" }));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
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
    expect(criarSessao).toHaveBeenCalledExactlyOnceWith(usuario.id);
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
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(6);
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP - 6);
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
    expect(criarSessao).toHaveBeenCalledExactlyOnceWith(usuario.id);

    vi.clearAllMocks();
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await entrar({}, formulario("ana@exemplo.com"));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_EMAIL);
  });

  it("o banco guarda só o hash do IP e do e-mail", async () => {
    contexto.cabecalhos = vercel;
    await entrar({}, formulario("privado@exemplo.com"));
    const chaves = (await db.tentativaAcesso.findMany()).map((t) => t.chave);
    expect(chaves).toHaveLength(2);
    for (const chave of chaves) {
      expect(chave).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("IPv6", () => {
  it("os endereços do mesmo prefixo /64 dividem a cota, mesmo com o IPv6 escrito de jeitos diferentes", async () => {
    const respostas = await entrarVezes(LIMITE_POR_IP + 2, (i) => ({
      "x-vercel-forwarded-for": i % 2 ? `2001:db8:abcd:12::${i + 1}` : `2001:0DB8:ABCD:0012:${i + 1}:ffff:ffff:ffff`,
    }));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(LIMITE_POR_IP + 2).fill(MENSAGEM_RECUSA));
    // Outro prefixo /64 tem a cota própria.
    contexto.cabecalhos = { "x-vercel-forwarded-for": "2001:db8:abcd:13::1" };
    await entrar({}, formulario("outra-pessoa@exemplo.com"));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP + 1);
  });

  it("o IPv4 escrito como IPv6 divide a cota com o IPv4", async () => {
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-vercel-forwarded-for": i % 2 ? "::ffff:203.0.113.5" : "203.0.113.5" }));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
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
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP - 2);
    expect(senha.verificarSenha).toHaveBeenCalledTimes(2);
    expect(await db.tentativaAcesso.count()).toBe(1 + 2);
  });
});
