import { beforeEach, describe, expect, it, vi } from "vitest";
import { exigirModerador } from "@/lib/auth/sessao";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(),
  naoEncontrado: vi.fn(() => { throw new Error("pagina-nao-encontrada"); }),
  redirecionar: vi.fn((destino: string) => { throw new Error(`recusa-publica:${destino}`); }),
}));
vi.mock("@/lib/db", () => ({ db: { sessao: { findUnique: mocks.sessao } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "sessao-sintetica" }) }) }));
vi.mock("next/navigation", () => ({ notFound: mocks.naoEncontrado, redirect: mocks.redirecionar }));

function sessao(papel: string) {
  return {
    expiraEm: new Date(Date.now() + 60_000),
    usuario: { id: "pessoa-sintetica", nome: "Pessoa", email: "pessoa@exemplo.test", papel },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("guarda de moderação", () => {
  it.each([null, sessao("membro")])("mantém o 404 da página para uma sessão sem moderação", async (registro) => {
    mocks.sessao.mockResolvedValue(registro);
    await expect(exigirModerador()).rejects.toThrow("pagina-nao-encontrada");
    expect(mocks.naoEncontrado).toHaveBeenCalledOnce();
    expect(mocks.redirecionar).not.toHaveBeenCalled();
  });

  it.each([null, sessao("membro")])("recusa a ação com um redirecionamento público sem renderizar a fila", async (registro) => {
    mocks.sessao.mockResolvedValue(registro);
    await expect(exigirModerador("acao")).rejects.toThrow("recusa-publica");
    expect(mocks.redirecionar).toHaveBeenCalledWith("/404");
    expect(mocks.naoEncontrado).not.toHaveBeenCalled();
  });

  it.each(["pagina", "acao"] as const)("aceita a sessão de moderador no contexto %s", async (contexto) => {
    mocks.sessao.mockResolvedValue(sessao("moderador"));
    await expect(exigirModerador(contexto)).resolves.toMatchObject({ id: "pessoa-sintetica", moderador: true });
    expect(mocks.naoEncontrado).not.toHaveBeenCalled();
    expect(mocks.redirecionar).not.toHaveBeenCalled();
  });
});
