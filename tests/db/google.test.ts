import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { concluirCadastroGoogle } from "@/acoes/conta";
import { GET as entrarComGoogle } from "@/app/api/google/entrar/route";
import { GET as retornoDoGoogle } from "@/app/api/google/retorno/route";
import {
  apagarCadastroGoogle,
  contaDoGoogle,
  guardarCadastroGoogle,
  lerCadastroGoogle,
  VALIDADE_CADASTRO_GOOGLE_MS,
  type PerfilGoogle,
} from "@/lib/auth/google";
import { db } from "@/lib/db";

// As rotas e a ação passam de verdade pelo banco. Só fica de mentira o que precisa
// de uma requisição do Next (a sessão, os cookies da ação e o redirect), e o Google
// responde por um fetch falso.
const sessao = vi.hoisted(() => ({ criarSessao: vi.fn(), usuarioAtual: vi.fn(async () => null) }));
vi.mock("@/lib/auth/sessao", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("@/lib/auth/sessao")>()),
  ...sessao,
}));
const requisicao = vi.hoisted(() => ({ cookies: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (nome: string) => (requisicao.cookies.has(nome) ? { name: nome, value: requisicao.cookies.get(nome)! } : undefined),
    delete: (opcoes: string | { name: string }) => requisicao.cookies.delete(typeof opcoes === "string" ? opcoes : opcoes.name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirecionado para ${destino}`);
  },
  notFound: () => {
    throw new Error("não encontrado");
  },
}));

const TELEFONE = "5511991488052";

const CLIENTE = "cliente.apps.googleusercontent.com";
const SITE = "http://localhost:3000";

function perfil(campos: Partial<PerfilGoogle> = {}): PerfilGoogle {
  return { sub: "google-ana", email: "ana@gmail.com", emailVerificado: true, nome: "Ana Lúcia Santos", ...campos };
}

async function criarConta(campos: { email?: string; emailConfirmadoEm?: Date | null; googleId?: string } = {}) {
  const conta = await db.usuario.create({
    data: { nome: "Ana de antes", email: "ana@gmail.com", senhaHash: "scrypt$senha-antiga", ...campos },
  });
  await db.sessao.create({ data: { id: `sessao-${conta.id}`, usuarioId: conta.id, expiraEm: new Date(Date.now() + 60_000) } });
  return conta;
}

const conta = (id: string) => db.usuario.findUniqueOrThrow({ where: { id } });
const sessoesDe = (usuarioId: string) => db.sessao.count({ where: { usuarioId } });

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "Sessao", "CadastroGoogle", "Usuario" CASCADE`);
}

beforeEach(async () => {
  await limparBanco();
  vi.clearAllMocks();
  requisicao.cookies.clear();
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENTE);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "segredo");
  vi.stubEnv("APP_URL", SITE);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("contaDoGoogle", () => {
  it("sem conta com o e-mail e sem o telefone, pede o telefone e não cria nada", async () => {
    expect(await contaDoGoogle(perfil())).toEqual({ tipo: "precisa_telefone" });
    expect(await db.usuario.count()).toBe(0);
  });

  it("sem conta com o e-mail, cria uma com o telefone, já confirmada e sem senha", async () => {
    const resultado = await contaDoGoogle(perfil(), TELEFONE);
    const nova = await db.usuario.findUniqueOrThrow({ where: { email: "ana@gmail.com" } });
    expect(resultado).toEqual({ tipo: "entrou", usuarioId: nova.id });
    expect(nova).toMatchObject({ nome: "Ana Lúcia Santos", googleId: "google-ana", telefone: TELEFONE, senhaHash: null, papel: "membro" });
    expect(nova.emailConfirmadoEm).not.toBeNull();
  });

  it("ligar a uma conta que já existe não pede telefone", async () => {
    const existente = await criarConta();
    expect(await contaDoGoogle(perfil())).toEqual({ tipo: "entrou", usuarioId: existente.id });
  });

  it("a conta já ligada entra pelo Google mesmo depois de o e-mail mudar no Google", async () => {
    const ligada = await criarConta({ googleId: "google-ana" });
    expect(await contaDoGoogle(perfil({ email: "ana.nova@gmail.com" }))).toEqual({ tipo: "entrou", usuarioId: ligada.id });
    expect(await db.usuario.count()).toBe(1);
  });

  it("liga a conta de e-mail confirmado sem mexer na senha nem nas sessões", async () => {
    const confirmadaEm = new Date("2026-10-01T12:00:00Z");
    const existente = await criarConta({ emailConfirmadoEm: confirmadaEm });

    expect(await contaDoGoogle(perfil())).toEqual({ tipo: "entrou", usuarioId: existente.id });
    expect(await conta(existente.id)).toMatchObject({
      nome: "Ana de antes",
      googleId: "google-ana",
      senhaHash: "scrypt$senha-antiga",
      emailConfirmadoEm: confirmadaEm,
    });
    expect(await sessoesDe(existente.id)).toBe(1);
  });

  it("liga a conta de e-mail não confirmado apagando a senha e as sessões de quem a criou", async () => {
    const existente = await criarConta();

    expect(await contaDoGoogle(perfil())).toEqual({ tipo: "entrou", usuarioId: existente.id });
    const depois = await conta(existente.id);
    expect(depois).toMatchObject({ googleId: "google-ana", senhaHash: null });
    expect(depois.emailConfirmadoEm).not.toBeNull();
    expect(await sessoesDe(existente.id)).toBe(0);
  });

  it("com o e-mail não verificado pelo Google, não cria nem liga conta", async () => {
    expect(await contaDoGoogle(perfil({ emailVerificado: false }))).toEqual({ tipo: "email_nao_verificado" });
    expect(await db.usuario.count()).toBe(0);

    const existente = await criarConta();
    expect(await contaDoGoogle(perfil({ emailVerificado: false }))).toEqual({ tipo: "email_nao_verificado" });
    expect(await conta(existente.id)).toMatchObject({ googleId: null, senhaHash: "scrypt$senha-antiga" });
  });

  it("a conta já ligada entra mesmo se o Google deixar de dar o e-mail como verificado", async () => {
    const ligada = await criarConta({ googleId: "google-ana" });
    expect(await contaDoGoogle(perfil({ emailVerificado: false }))).toEqual({ tipo: "entrou", usuarioId: ligada.id });
  });

  it("não liga outro Google à conta que já tem um", async () => {
    const existente = await criarConta({ googleId: "google-outro" });
    expect(await contaDoGoogle(perfil())).toEqual({ tipo: "outra_conta_google" });
    expect(await conta(existente.id)).toMatchObject({ googleId: "google-outro", senhaHash: "scrypt$senha-antiga" });
    expect(await sessoesDe(existente.id)).toBe(1);
  });

  it("dois retornos ao mesmo tempo criam uma conta só", async () => {
    const [primeiro, segundo] = await Promise.all([contaDoGoogle(perfil(), TELEFONE), contaDoGoogle(perfil(), TELEFONE)]);
    expect(primeiro).toEqual(segundo);
    expect(await db.usuario.count()).toBe(1);
  });

  it("dois retornos ao mesmo tempo ligam a conta uma vez", async () => {
    const existente = await criarConta();
    const resultados = await Promise.all([contaDoGoogle(perfil()), contaDoGoogle(perfil())]);
    expect(resultados).toEqual([
      { tipo: "entrou", usuarioId: existente.id },
      { tipo: "entrou", usuarioId: existente.id },
    ]);
  });
});

/** Cookie que /api/google/entrar grava: state, verificador e o voltar em base64url. */
function cookieDoLogin(voltar = "/indicar", estado = "estado-certo", verificador = "verificador-certo") {
  return `ndb_google=${estado}.${verificador}.${Buffer.from(voltar).toString("base64url")}`;
}

function retorno(busca: Record<string, string>, cookie = cookieDoLogin()) {
  const url = new URL("/api/google/retorno", SITE);
  url.search = new URLSearchParams(busca).toString();
  return retornoDoGoogle(new NextRequest(url, { headers: { cookie } }));
}

function googleResponde(campos: Record<string, unknown> = {}) {
  const parte = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString("base64url");
  const dados = {
    iss: "https://accounts.google.com",
    aud: CLIENTE,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: "google-ana",
    email: "ana@gmail.com",
    email_verified: true,
    name: "Ana Lúcia Santos",
    ...campos,
  };
  const idToken = [parte({ alg: "RS256" }), parte(dados), "assinatura"].join(".");
  const fetch = vi.fn(async () => Response.json({ access_token: "token", id_token: idToken }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const avisoDe = (resposta: Response) => new URL(resposta.headers.get("location")!).searchParams.get("aviso");

describe("/api/google/entrar", () => {
  it("manda para o Google com o state e o PKCE guardados no cookie", async () => {
    const resposta = await entrarComGoogle(new NextRequest(`${SITE}/api/google/entrar?voltar=%2Findicar%3Fx%3D1`));
    const destino = new URL(resposta.headers.get("location")!);
    expect(destino.origin).toBe("https://accounts.google.com");

    const [estado, verificador, voltar] = resposta.cookies.get("ndb_google")!.value.split(".");
    expect(destino.searchParams.get("state")).toBe(estado);
    expect(destino.searchParams.get("code_challenge")).toBe(createHash("sha256").update(verificador!).digest("base64url"));
    expect(Buffer.from(voltar!, "base64url").toString()).toBe("/indicar?x=1");
    expect(resposta.cookies.get("ndb_google")).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/api/google" });
  });

  it("não aceita um voltar para outro site", async () => {
    const resposta = await entrarComGoogle(new NextRequest(`${SITE}/api/google/entrar?voltar=%2F%2Foutro.exemplo`));
    const voltar = resposta.cookies.get("ndb_google")!.value.split(".")[2]!;
    expect(Buffer.from(voltar, "base64url").toString()).toBe("/");
  });

  it("sem a configuração do Google, volta para /entrar com o aviso", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    const resposta = await entrarComGoogle(new NextRequest(`${SITE}/api/google/entrar?voltar=%2Findicar`));
    expect(resposta.headers.get("location")).toBe(`${SITE}/entrar?voltar=%2Findicar&aviso=google_indisponivel`);
    expect(resposta.cookies.get("ndb_google")).toBeUndefined();
  });
});

describe("/api/google/retorno", () => {
  it("troca o código com o verificador, abre a sessão e volta para onde a pessoa estava", async () => {
    const ligada = await criarConta({ googleId: "google-ana" });
    const fetch = googleResponde();
    const resposta = await retorno({ code: "codigo", state: "estado-certo" });

    expect(resposta.headers.get("location")).toBe(`${SITE}/indicar`);
    const [, opcoes] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const corpo = new URLSearchParams(opcoes.body as URLSearchParams);
    expect(corpo.get("code")).toBe("codigo");
    expect(corpo.get("code_verifier")).toBe("verificador-certo");
    expect(corpo.get("redirect_uri")).toBe(`${SITE}/api/google/retorno`);

    expect(sessao.criarSessao).toHaveBeenCalledWith(ligada.id);
    // O cookie do login é apagado.
    expect(resposta.cookies.get("ndb_google")?.value).toBe("");
  });

  it("conta nova: guarda o cadastro e manda para a tela do telefone, sem criar conta nem sessão", async () => {
    googleResponde();
    const resposta = await retorno({ code: "codigo", state: "estado-certo" });

    expect(resposta.headers.get("location")).toBe(`${SITE}/cadastrar/google`);
    const cookie = resposta.cookies.get("ndb_google_cadastro")!;
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/cadastrar/google", maxAge: 30 * 60 });
    expect(resposta.cookies.get("ndb_google")?.value).toBe("");
    expect(await lerCadastroGoogle(cookie.value)).toEqual({
      perfil: { sub: "google-ana", email: "ana@gmail.com", emailVerificado: true, nome: "Ana Lúcia Santos" },
      destino: "/indicar",
    });
    expect(await db.usuario.count()).toBe(0);
    expect(sessao.criarSessao).not.toHaveBeenCalled();
  });

  it("com o state diferente do cookie, não fala com o Google nem abre sessão", async () => {
    const fetch = googleResponde();
    const resposta = await retorno({ code: "codigo", state: "estado-de-outra-pessoa" });
    expect(resposta.headers.get("location")).toBe(`${SITE}/entrar?voltar=%2Findicar&aviso=google_erro`);
    expect(fetch).not.toHaveBeenCalled();
    expect(sessao.criarSessao).not.toHaveBeenCalled();
  });

  it("sem o cookie do login, não abre sessão e volta para o começo", async () => {
    const fetch = googleResponde();
    const resposta = await retorno({ code: "codigo", state: "estado-certo" }, "");
    expect(resposta.headers.get("location")).toBe(`${SITE}/entrar?voltar=%2F&aviso=google_erro`);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("quando a pessoa cancela no Google, mostra o aviso de cancelado", async () => {
    googleResponde();
    expect(avisoDe(await retorno({ error: "access_denied", state: "estado-certo" }))).toBe("google_cancelado");
    expect(sessao.criarSessao).not.toHaveBeenCalled();
  });

  it("com o e-mail não verificado, mostra o aviso e não cria conta", async () => {
    googleResponde({ email_verified: false });
    expect(avisoDe(await retorno({ code: "codigo", state: "estado-certo" }))).toBe("google_email_nao_verificado");
    expect(await db.usuario.count()).toBe(0);
  });

  it("com o e-mail já ligado a outro Google, mostra o aviso", async () => {
    await criarConta({ googleId: "google-outro" });
    googleResponde();
    expect(avisoDe(await retorno({ code: "codigo", state: "estado-certo" }))).toBe("google_outra_conta");
    expect(sessao.criarSessao).not.toHaveBeenCalled();
  });

  it("quando o Google recusa o código, mostra o aviso de erro e registra o motivo do Google como texto", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "invalid_client", error_description: "Unauthorized" }, { status: 401 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(avisoDe(await retorno({ code: "codigo", state: "estado-certo" }))).toBe("google_erro");
    expect(sessao.criarSessao).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "Falha no retorno do login com o Google: O Google não aceitou o código de autorização (HTTP 401, invalid_client: Unauthorized).",
    );
  });

  it("sem motivo na resposta do Google, registra só o status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 502 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(avisoDe(await retorno({ code: "codigo", state: "estado-certo" }))).toBe("google_erro");
    expect(log).toHaveBeenCalledWith("Falha no retorno do login com o Google: O Google não aceitou o código de autorização (HTTP 502).");
  });

  it("recusa o id_token feito para outro app", async () => {
    googleResponde({ aud: "outro.apps.googleusercontent.com" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(avisoDe(await retorno({ code: "codigo", state: "estado-certo" }))).toBe("google_erro");
    expect(await db.usuario.count()).toBe(0);
  });
});

describe("cadastro pelo Google esperando o telefone", () => {
  it("guarda só o sha256 do token e vale por 30 minutos", async () => {
    const token = await guardarCadastroGoogle(perfil(), "/indicar");
    const [guardado] = await db.cadastroGoogle.findMany();
    expect(guardado!.id).toBe(createHash("sha256").update(token).digest("hex"));
    expect(guardado!.expiraEm.getTime() - guardado!.criadoEm.getTime()).toBeCloseTo(VALIDADE_CADASTRO_GOOGLE_MS, -3);

    await db.cadastroGoogle.updateMany({ data: { expiraEm: new Date(Date.now() - 1000) } });
    expect(await lerCadastroGoogle(token)).toBeNull();
  });

  it("os vencidos são apagados quando outro é guardado", async () => {
    await guardarCadastroGoogle(perfil(), "/");
    await db.cadastroGoogle.updateMany({ data: { expiraEm: new Date(Date.now() - 1000) } });
    await guardarCadastroGoogle(perfil({ sub: "google-bia", email: "bia@gmail.com" }), "/");
    expect((await db.cadastroGoogle.findMany()).map((c) => c.email)).toEqual(["bia@gmail.com"]);
  });

  it("token vazio ou desconhecido não acha nada", async () => {
    await guardarCadastroGoogle(perfil(), "/");
    expect(await lerCadastroGoogle("")).toBeNull();
    expect(await lerCadastroGoogle("token-que-nao-existe")).toBeNull();
    await apagarCadastroGoogle("");
    expect(await db.cadastroGoogle.count()).toBe(1);
  });
});

describe("concluirCadastroGoogle", () => {
  function comTelefone(telefone: string) {
    const dados = new FormData();
    dados.set("telefone", telefone);
    return dados;
  }

  it("com o telefone, cria a conta, abre a sessão, apaga o cadastro e vai ao destino", async () => {
    requisicao.cookies.set("ndb_google_cadastro", await guardarCadastroGoogle(perfil(), "/indicar"));

    await expect(concluirCadastroGoogle({}, comTelefone("(11) 99148-8052"))).rejects.toThrow("redirecionado para /indicar");
    const nova = await db.usuario.findUniqueOrThrow({ where: { email: "ana@gmail.com" } });
    expect(nova).toMatchObject({ googleId: "google-ana", telefone: TELEFONE, senhaHash: null });
    expect(sessao.criarSessao).toHaveBeenCalledWith(nova.id);
    expect(await db.cadastroGoogle.count()).toBe(0);
    expect(requisicao.cookies.has("ndb_google_cadastro")).toBe(false);
  });

  it("com o telefone inválido, mostra o erro e mantém o cadastro", async () => {
    requisicao.cookies.set("ndb_google_cadastro", await guardarCadastroGoogle(perfil(), "/indicar"));

    const resposta = await concluirCadastroGoogle({}, comTelefone("99148-8052"));
    expect(resposta?.erros?.telefone).toBe("Digite o telefone com DDD (ex.: 11 99148-8052).");
    expect(await db.usuario.count()).toBe(0);
    expect(await db.cadastroGoogle.count()).toBe(1);
  });

  it("sem cadastro guardado, volta para a página, que avisa que o prazo acabou", async () => {
    await expect(concluirCadastroGoogle({}, comTelefone("(11) 99148-8052"))).rejects.toThrow("redirecionado para /cadastrar/google");
    expect(await db.usuario.count()).toBe(0);
    expect(sessao.criarSessao).not.toHaveBeenCalled();
  });

  it("se o e-mail foi ligado a outro Google enquanto isso, mostra o aviso e não cria conta", async () => {
    requisicao.cookies.set("ndb_google_cadastro", await guardarCadastroGoogle(perfil(), "/"));
    await criarConta({ googleId: "google-outro" });

    const resposta = await concluirCadastroGoogle({}, comTelefone("(11) 99148-8052"));
    expect(resposta?.erro).toBe("Este e-mail já está ligado a outra conta do Google. Entre com ela, com a senha ou com um link por e-mail.");
    expect(sessao.criarSessao).not.toHaveBeenCalled();
  });
});
