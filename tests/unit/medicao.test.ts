import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_EVENTOS, juntarEvento, lerEventos, medirContato, type Evento } from "@/lib/medicao";
import { medir } from "@/lib/medicao-servidor";

// O cookie de mentira guarda o valor e as opções de cada `set`, como o Next faria na resposta.
const loja = vi.hoisted(() => new Map<string, { value: string; opcoes: Record<string, unknown> }>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => loja.get(nome),
    set: (nome: string, value: string, opcoes: Record<string, unknown>) => loja.set(nome, { value, opcoes }),
  }),
}));

const CADASTRO: Evento = { nome: "sign_up", params: { method: "senha" } };
const INDICACAO: Evento = {
  nome: "negocio_cadastrado",
  params: { tipo: "indicacao", categoria: "Café e padaria", uf: "BA", cidade: "Salvador", com_instagram: "sim" },
};

describe("lerEventos", () => {
  it.each([undefined, "", "lixo", "{}", '{"nome":"login"}', "null"])("ignora o cookie fora do formato %j", (valor) => {
    expect(lerEventos(valor)).toEqual([]);
  });

  it("descarta os eventos com nome ou parâmetros estranhos e mantém os bons", () => {
    const valor = JSON.stringify([
      CADASTRO,
      { nome: "Com Espaço", params: {} },
      { nome: "login", params: { method: 1 } },
      { nome: "login" },
      "login",
      INDICACAO,
    ]);
    expect(lerEventos(valor)).toEqual([CADASTRO, INDICACAO]);
  });
});

describe("juntarEvento", () => {
  it("põe o evento no fim da fila e guarda só os 5 últimos", () => {
    let valor: string | undefined;
    for (let i = 0; i < 6; i++) valor = juntarEvento(valor, i === 5 ? INDICACAO : CADASTRO);
    const eventos = lerEventos(valor);
    expect(eventos).toHaveLength(5);
    expect(eventos.at(-1)).toEqual(INDICACAO);
  });
});

describe("medirContato", () => {
  it("marca o clique com o canal, a categoria e a UF, sem nada que identifique o negócio", () => {
    expect(medirContato("whatsapp", { categoria: "Café e padaria", uf: "BA" })).toEqual({
      "data-medir": "contato_negocio",
      "data-canal": "whatsapp",
      "data-categoria": "Café e padaria",
      "data-uf": "BA",
    });
  });
});

describe("medir", () => {
  beforeEach(() => loja.clear());
  afterEach(() => vi.unstubAllEnvs());

  it("não cria cookie sem o Analytics configurado", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "");
    await medir(CADASTRO);
    expect(loja.size).toBe(0);
  });

  it("deixa os eventos, em ordem, num cookie curto que o navegador consegue ler", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TESTE");
    await medir(CADASTRO);
    await medir(INDICACAO);

    const cookie = loja.get(COOKIE_EVENTOS);
    expect(lerEventos(cookie?.value)).toEqual([CADASTRO, INDICACAO]);
    expect(cookie?.opcoes).toMatchObject({ httpOnly: false, sameSite: "lax", path: "/", maxAge: 300 });
  });
});
