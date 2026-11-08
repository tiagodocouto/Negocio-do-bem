import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

// A Server Action roda fora do Next: o redirect vira um erro com o destino, a sessão
// devolve a conta que o teste escolher (ou manda para o login) e os eventos do
// Analytics ficam numa lista.
type Conta = { id: string; nome: string; email: string };
const sessao = vi.hoisted(() => ({ usuario: null as Conta | null }));
const eventos = vi.hoisted(() => [] as unknown[]);
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirect:${destino}`);
  },
}));
vi.mock("@/lib/auth/sessao", async (original) => ({
  ...(await original<typeof import("@/lib/auth/sessao")>()),
  exigirUsuario: async (voltar: string) => {
    if (!sessao.usuario) throw new Error(`redirect:/entrar?voltar=${encodeURIComponent(voltar)}`);
    return { ...sessao.usuario, moderador: false, emailConfirmado: true };
  },
}));
vi.mock("@/lib/medicao-servidor", () => ({ medir: async (evento: unknown) => void eventos.push(evento) }));

const { favoritar } = await import("@/acoes/favoritos");
const { coracoesDaLista } = await import("@/lib/consultas");

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaFavorita", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

function formulario(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

let leitora: Conta;
let dona: Conta;
let empresaId: string;

const porNosFavoritos = (campos: Record<string, string> = {}) => favoritar(false, formulario({ empresaId, favoritar: "sim", ...campos }));
const tirarDosFavoritos = () => favoritar(true, formulario({ empresaId, favoritar: "nao" }));
const favoritos = () => db.empresaFavorita.findMany({ where: { empresaId } });
const sessaoDe = (conta: Conta) => ({ ...conta, moderador: false, emailConfirmado: true });

beforeEach(async () => {
  await limparBanco();
  eventos.length = 0;
  leitora = await db.usuario.create({ data: { nome: "Lia Leitora", email: "lia@exemplo.com", senhaHash: "scrypt$segredo" } });
  dona = await db.usuario.create({ data: { nome: "Dora Dona", email: "dora@exemplo.com", senhaHash: "scrypt$segredo" } });
  const empresa = await db.empresa.create({
    data: {
      instagramUsername: "padaria.flor",
      nome: "Padaria Flor",
      resumo: "Um negócio do bem",
      categoria: "Café e padaria",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      membros: { create: { usuarioId: dona.id } },
    },
  });
  empresaId = empresa.id;
  sessao.usuario = leitora;
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("favoritar um negócio", () => {
  it("põe um negócio do diretório nos favoritos e conta no Analytics", async () => {
    expect(await porNosFavoritos()).toBe(true);

    expect(await favoritos()).toMatchObject([{ usuarioId: leitora.id }]);
    expect(eventos).toEqual([{ nome: "negocio_favoritado", params: { categoria: "Café e padaria", uf: "PE" } }]);
  });

  it("dois toques ao mesmo tempo gravam uma vez só e contam uma vez só", async () => {
    expect(await Promise.all([porNosFavoritos(), porNosFavoritos()])).toEqual([true, true]);
    expect(await porNosFavoritos()).toBe(true);

    expect(await favoritos()).toHaveLength(1);
    expect(eventos).toHaveLength(1);
  });

  it("um negócio sem dono também pode ser favoritado", async () => {
    await db.empresaMembro.deleteMany({ where: { empresaId } });

    expect(await porNosFavoritos()).toBe(true);
    expect(await favoritos()).toHaveLength(1);
  });

  it("sem login, manda para o login e volta à página de onde a pessoa veio", async () => {
    sessao.usuario = null;

    await expect(porNosFavoritos({ voltar: "/explorar?q=pao" })).rejects.toThrow(
      `redirect:/entrar?voltar=${encodeURIComponent("/explorar?q=pao")}`,
    );
    expect(await favoritos()).toHaveLength(0);
  });

  it("sem login e com um endereço de volta para outro site, volta ao perfil", async () => {
    sessao.usuario = null;

    await expect(porNosFavoritos({ voltar: "//golpe.example/favoritos" })).rejects.toThrow(
      `redirect:/entrar?voltar=${encodeURIComponent("/empresas/padaria.flor")}`,
    );
  });

  it("a dona não favorita o próprio negócio, mesmo chamando a ação direto", async () => {
    sessao.usuario = dona;

    expect(await porNosFavoritos()).toBe(false);
    expect(await favoritos()).toHaveLength(0);
    expect(eventos).toHaveLength(0);
  });

  it.each([
    ["oculto pelo dono", { oculta: true }],
    ["tirado do ar", { moderacao: "rejeitada" }],
  ])("não favorita um negócio %s", async (_caso, dados) => {
    await db.empresa.update({ where: { id: empresaId }, data: dados });

    expect(await porNosFavoritos()).toBe(false);
    expect(await favoritos()).toHaveLength(0);
  });

  it("um negócio que não existe não grava nada", async () => {
    expect(await favoritar(false, formulario({ empresaId: "nao-existe", favoritar: "sim" }))).toBe(false);
  });
});

describe("tirar dos favoritos", () => {
  it("apaga só o favorito de quem pediu", async () => {
    await db.empresaFavorita.createMany({
      data: [
        { empresaId, usuarioId: leitora.id },
        { empresaId, usuarioId: dona.id },
      ],
    });

    expect(await tirarDosFavoritos()).toBe(false);
    expect(await favoritos()).toMatchObject([{ usuarioId: dona.id }]);
    expect(eventos).toHaveLength(0);
  });

  it("vale mesmo depois que o negócio saiu do diretório", async () => {
    await db.empresaFavorita.create({ data: { empresaId, usuarioId: leitora.id } });
    await db.empresa.update({ where: { id: empresaId }, data: { oculta: true } });

    expect(await tirarDosFavoritos()).toBe(false);
    expect(await favoritos()).toHaveLength(0);
  });
});

describe("coração de cada negócio de uma lista", () => {
  it("sem login, todos levam ao login e voltam para a lista", async () => {
    const coracao = await coracoesDaLista(null, [empresaId], "/explorar");

    expect(coracao(empresaId)).toEqual({ empresaId, logado: false, favorito: false, voltar: "/explorar" });
  });

  it("mostra quais a pessoa já favoritou", async () => {
    await db.empresaFavorita.create({ data: { empresaId, usuarioId: leitora.id } });
    const outra = await db.empresa.create({
      data: { instagramUsername: "cafe.sol", nome: "Café Sol", resumo: "Outro negócio", categoria: "Café e padaria", cidade: "Recife", uf: "PE" },
    });

    const coracao = await coracoesDaLista(sessaoDe(leitora), [empresaId, outra.id], "/explorar");

    expect(coracao(empresaId)?.favorito).toBe(true);
    expect(coracao(outra.id)?.favorito).toBe(false);
  });

  it("o dono não vê o coração no próprio negócio", async () => {
    const coracao = await coracoesDaLista(sessaoDe(dona), [empresaId], "/explorar");

    expect(coracao(empresaId)).toBeUndefined();
  });
});
