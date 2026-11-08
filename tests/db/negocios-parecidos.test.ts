import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { negociosParecidos } from "@/lib/consultas";
import { db } from "@/lib/db";

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

function criar(username: string, dados: { categoria: string; cidade?: string; uf?: string; status?: string; moderacao?: string; oculta?: boolean }) {
  return db.empresa.create({
    data: { instagramUsername: username, nome: username, resumo: "Um negócio do bem", cidade: "Recife", uf: "PE", moderacao: "aprovada", ...dados },
  });
}

beforeEach(limparBanco);
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("negociosParecidos", () => {
  it("traz só negócios do diretório da mesma cidade, sem o próprio negócio", async () => {
    const eu = await criar("eu", { categoria: "Café e padaria" });
    await criar("vizinho", { categoria: "Café e padaria" });
    await criar("outra.cidade", { categoria: "Café e padaria", cidade: "São Paulo", uf: "SP" });
    await criar("mesma.cidade.outra.uf", { categoria: "Café e padaria", uf: "SP" });
    await criar("pendente", { categoria: "Café e padaria", moderacao: "pendente" });
    await criar("oculto", { categoria: "Café e padaria", oculta: true });

    const parecidos = await negociosParecidos(eu);
    expect(parecidos.map((p) => p.instagramUsername)).toEqual(["vizinho"]);
  });

  it("põe os do mesmo tipo antes dos outros e respeita o limite", async () => {
    const eu = await criar("eu", { categoria: "Café e padaria" });
    await criar("moda", { categoria: "Moda e acessórios", status: "verificada" });
    await criar("cafe.um", { categoria: "Café e padaria" });
    await criar("cafe.dois", { categoria: "Café e padaria" });

    const parecidos = await negociosParecidos(eu, 2);
    expect(parecidos).toHaveLength(2);
    expect(parecidos.every((p) => p.categoria === "Café e padaria")).toBe(true);

    const todos = await negociosParecidos(eu);
    expect(todos.map((p) => p.instagramUsername).at(-1)).toBe("moda");
  });

  it("devolve lista vazia quando não há outro negócio na cidade", async () => {
    const eu = await criar("sozinho", { categoria: "Café e padaria" });
    expect(await negociosParecidos(eu)).toEqual([]);
  });
});
