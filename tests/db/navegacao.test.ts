import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { contarOfertasValendo, negociosDoClube, perfilDaBarra } from "@/lib/navegacao";
import { condicaoDeOfertaPublica } from "@/lib/ofertas";

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "RegistroAuditoria", "Cupom", "Oferta", "LiberacaoClube", "EmpresaFavorita", "EmpresaMembro", "Empresa", "Usuario" CASCADE`);
}

const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000);

async function criarNegocio(username: string, extra: { moderacao?: string; oculta?: boolean } = {}) {
  return db.empresa.create({
    data: {
      instagramUsername: username,
      nome: `Negócio ${username}`,
      resumo: "Um negócio do bem",
      categoria: "Café e padaria",
      cidade: "Recife",
      uf: "PE",
      moderacao: extra.moderacao ?? "aprovada",
      oculta: extra.oculta ?? false,
      status: "verificada",
      whatsapp: "5581999998888",
    },
  });
}

let dona: { id: string; nome: string; email: string; moderador: boolean; emailConfirmado: boolean };

beforeEach(async () => {
  await limparBanco();
  const usuario = await db.usuario.create({ data: { nome: "Dora Dona", email: "dora@exemplo.com" } });
  dona = { id: usuario.id, nome: usuario.nome, email: usuario.email, moderador: false, emailConfirmado: true };
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("ofertas que o público vê", () => {
  it("conta só a oferta ativa de negócio aprovado e visível", async () => {
    const aberto = await criarNegocio("aberto");
    const oculto = await criarNegocio("oculto", { oculta: true });
    const pendente = await criarNegocio("pendente", { moderacao: "pendente" });
    const base = { titulo: "10% off", tipo: "percentual", valor: 10, ondeVale: "local", fim: daqui(3) };
    await db.oferta.createMany({
      data: [
        { empresaId: aberto.id, ...base },
        { empresaId: aberto.id, ...base, status: "encerrada" },
        { empresaId: aberto.id, ...base, fim: daqui(-1) },
        { empresaId: oculto.id, ...base },
        { empresaId: pendente.id, ...base },
      ],
    });
    expect(await contarOfertasValendo()).toBe(1);
    expect(await db.oferta.findMany({ where: condicaoDeOfertaPublica() })).toHaveLength(1);
  });
});

describe("barra de baixo do celular", () => {
  it("quem não tem negócio liberado vê a barra de quem compra", async () => {
    expect(await perfilDaBarra(null)).toEqual({ tipo: "comprador", ofertas: 0 });
    const negocio = await criarNegocio("padaria");
    await db.empresaMembro.create({ data: { empresaId: negocio.id, usuarioId: dona.id } });
    // Dono, mas sem liberação no clube: não ganha o botão Validar.
    expect(await perfilDaBarra(dona)).toEqual({ tipo: "comprador", ofertas: 0 });
  });

  it("o dono liberado ganha o botão Validar e vai direto ao negócio, se for um só", async () => {
    const negocio = await criarNegocio("padaria");
    await db.empresaMembro.create({ data: { empresaId: negocio.id, usuarioId: dona.id } });
    await db.liberacaoClube.create({ data: { empresaId: negocio.id, usuarioId: dona.id, cnpj: "11222333000181" } });
    expect(await perfilDaBarra(dona)).toEqual({ tipo: "dono", ofertas: 0, negocio: "/negocio?negocio=padaria" });
  });

  it("com dois negócios liberados, a aba leva à escolha", async () => {
    for (const username of ["padaria", "cafe"]) {
      const negocio = await criarNegocio(username);
      await db.empresaMembro.create({ data: { empresaId: negocio.id, usuarioId: dona.id } });
      await db.liberacaoClube.create({ data: { empresaId: negocio.id, usuarioId: dona.id, cnpj: "11222333000181" } });
    }
    expect(await perfilDaBarra(dona)).toMatchObject({ tipo: "dono", negocio: "/negocio" });
  });

  it("liberação suspensa, ou de quem deixou de ser dono, não conta", async () => {
    const suspenso = await criarNegocio("suspenso");
    await db.empresaMembro.create({ data: { empresaId: suspenso.id, usuarioId: dona.id } });
    await db.liberacaoClube.create({ data: { empresaId: suspenso.id, usuarioId: dona.id, cnpj: "11222333000181", status: "suspensa" } });
    const antigo = await criarNegocio("antigo");
    await db.liberacaoClube.create({ data: { empresaId: antigo.id, usuarioId: dona.id, cnpj: "11222333000181" } });
    expect(await negociosDoClube(dona.id)).toEqual([]);
  });
});
