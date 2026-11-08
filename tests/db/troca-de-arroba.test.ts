import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { enderecoAtual, trocarArroba } from "@/lib/troca-de-arroba";

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Cupom", "Oferta", "LiberacaoClube", "EnderecoAntigo", "EmpresaMembro", "Empresa", "Usuario" CASCADE`,
  );
}

const dadosDaEmpresa = (instagramUsername: string) => ({
  instagramUsername,
  nome: "Padaria Flor",
  resumo: "Um negócio do bem",
  categoria: "Café e padaria",
  cidade: "Recife",
  uf: "PE",
  moderacao: "aprovada",
  status: "verificada",
});

let dona: { id: string };
let moderadora: { id: string };

async function empresa(instagramUsername: string) {
  return db.empresa.findUniqueOrThrow({ where: { instagramUsername } });
}

function trocar(de: string, para: string, pelaModeracao = false) {
  return db.$transaction(async (tx) => {
    const atual = await tx.empresa.findUniqueOrThrow({ where: { instagramUsername: de } });
    return trocarArroba(tx, atual, para, { usuarioId: pelaModeracao ? moderadora.id : dona.id, pelaModeracao });
  });
}

beforeEach(async () => {
  await limparBanco();
  dona = await db.usuario.create({ data: { nome: "Dora Dona", email: "dora@exemplo.com" } });
  moderadora = await db.usuario.create({ data: { nome: "Mara Moderadora", email: "mara@exemplo.com", papel: "moderador" } });
  await db.empresa.create({
    data: {
      ...dadosDaEmpresa("padaria.flor"),
      membros: { create: { usuarioId: dona.id } },
      liberacoesClube: { create: { usuarioId: dona.id, cnpj: "11222333000181" } },
    },
  });
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("trocar o @ do Instagram", () => {
  it("troca o @, guarda o antigo para redirecionar e atualiza a busca", async () => {
    expect(await trocar("padaria.flor", "florpadaria")).toBe("trocado");

    const nova = await empresa("florpadaria");
    expect(nova.busca).toContain("florpadaria");
    expect(await enderecoAtual("padaria.flor")).toBe("florpadaria");
    expect(await db.registroAuditoria.findFirstOrThrow({ where: { acao: "empresa.arroba_trocado" } })).toMatchObject({
      usuarioId: dona.id,
      alvoId: nova.id,
      detalhes: "@padaria.flor (padaria.flor) → @florpadaria",
    });
  });

  it("recusa um @ que já é de outro negócio", async () => {
    await db.empresa.create({ data: dadosDaEmpresa("outra.padaria") });

    expect(await trocar("padaria.flor", "outra.padaria")).toBe("ocupado");
    expect(await empresa("padaria.flor")).toBeTruthy();
    expect(await db.enderecoAntigo.count()).toBe(0);
  });

  it("não faz nada quando o @ é o mesmo", async () => {
    expect(await trocar("padaria.flor", "padaria.flor")).toBe("mesmo");
    expect(await db.registroAuditoria.count()).toBe(0);
  });

  it("vários @ antigos levam ao atual, e voltar a um @ antigo tira o redirecionamento", async () => {
    await trocar("padaria.flor", "florpadaria");
    await trocar("florpadaria", "flor.recife");
    expect(await enderecoAtual("padaria.flor")).toBe("flor.recife");
    expect(await enderecoAtual("florpadaria")).toBe("flor.recife");

    await trocar("flor.recife", "padaria.flor");
    expect(await enderecoAtual("padaria.flor")).toBeNull();
    expect(await enderecoAtual("flor.recife")).toBe("padaria.flor");
  });

  it("um negócio sem Instagram ganha um @, e o endereço com hífen leva a ele", async () => {
    await db.empresa.create({ data: dadosDaEmpresa("doceria-da-ana-recife") });

    expect(await trocar("doceria-da-ana-recife", "doceriadaana")).toBe("trocado");
    expect(await enderecoAtual("doceria-da-ana-recife")).toBe("doceriadaana");
  });

  it("a troca pelo dono suspende o Clube do Bem; pela moderação, não", async () => {
    await trocar("padaria.flor", "florpadaria", true);
    expect((await db.liberacaoClube.findFirstOrThrow()).status).toBe("liberada");
    expect(await db.registroAuditoria.count({ where: { acao: "empresa.arroba_trocado_pela_moderacao" } })).toBe(1);

    await trocar("florpadaria", "flor.recife");
    expect(await db.liberacaoClube.findFirstOrThrow()).toMatchObject({ status: "suspensa", motivo: "O @ do Instagram mudou" });
  });
});
