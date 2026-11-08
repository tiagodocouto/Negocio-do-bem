import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  aprovarPendentesSemDono,
  MOTIVO_CLUBE_SEM_DONO,
  processarLoginInstagram,
  removerDono,
  solicitarPorDocumento,
} from "@/lib/reivindicacao";

// A moderação tira uma conta dos donos de um negócio (#292).

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Cupom", "Oferta", "LiberacaoClube", "Reivindicacao", "EmpresaMembro", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

let contador = 0;
async function criarUsuario(nome: string) {
  contador++;
  return db.usuario.create({ data: { nome, email: `pessoa${contador}@exemplo.com`, senhaHash: "x" } });
}

async function criarEmpresa(username: string) {
  return db.empresa.create({
    data: {
      instagramUsername: username,
      nome: `Negócio ${username}`,
      resumo: "Um negócio do bem",
      categoria: "Café e padaria",
      cidade: "São Paulo",
      uf: "SP",
      moderacao: "aprovada",
    },
  });
}

const dadosDoNegocio = { cnpj: null, site: null, relacao: "Sou a dona", contato: "11 99999-9999", mensagem: null };

/** A pessoa vira dona pelo caminho de verdade: o pedido pelos dados do negócio, aprovado na hora. */
async function assumir(empresaId: string, usuarioId: string) {
  const pedido = await solicitarPorDocumento({ empresaId, usuarioId, ...dadosDoNegocio });
  expect(pedido.status).toBe("aprovada");
  return pedido;
}

async function criarOferta(empresaId: string, criadaPorId: string) {
  return db.oferta.create({
    data: { empresaId, criadaPorId, titulo: "10% no café", tipo: "percentual", valor: 10, ondeVale: "local", fim: new Date(Date.now() + 86_400_000) },
  });
}

let moderador: { id: string };
beforeEach(async () => {
  await limparBanco();
  moderador = await criarUsuario("Moderadora");
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("removerDono", () => {
  it("tira o único dono: o pedido vira revogado, o perfil volta a sem dono e a auditoria registra o motivo", async () => {
    const empresa = await criarEmpresa("coffeelab");
    const cristiane = await criarUsuario("Cristiane Oliveira");
    const pedido = await assumir(empresa.id, cristiane.id);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).status).toBe("verificada");

    const resultado = await removerDono({
      empresaId: empresa.id,
      usuarioId: cristiane.id,
      moderadorId: moderador.id,
      motivo: "O nome não bate com a sócia na Receita",
    });

    expect(resultado).toEqual({ removido: true, username: "coffeelab", nome: "Cristiane Oliveira", semDono: true, ofertasSuspensas: 0 });
    expect(await db.empresaMembro.count({ where: { empresaId: empresa.id } })).toBe(0);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).status).toBe("indicada");
    expect(await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } })).toMatchObject({
      status: "revogada",
      motivoRecusa: "O nome não bate com a sócia na Receita",
      revisadoPorId: moderador.id,
    });
    const auditoria = await db.registroAuditoria.findMany({ where: { acao: "empresa.dono_removido" } });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({
      usuarioId: moderador.id,
      alvoTipo: "empresa",
      alvoId: empresa.id,
      detalhes: "@coffeelab · Cristiane Oliveira · O nome não bate com a sócia na Receita",
    });
  });

  it("com outro dono, o perfil continua assumido", async () => {
    const empresa = await criarEmpresa("padaria");
    const ana = await criarUsuario("Ana");
    const bia = await criarUsuario("Bia");
    await assumir(empresa.id, ana.id);
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: bia.id } });

    const resultado = await removerDono({ empresaId: empresa.id, usuarioId: ana.id, moderadorId: moderador.id, motivo: "Teste" });

    expect(resultado).toMatchObject({ removido: true, semDono: false });
    expect((await db.empresaMembro.findMany({ where: { empresaId: empresa.id } })).map((m) => m.usuarioId)).toEqual([bia.id]);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).status).toBe("verificada");
  });

  it("remover de novo não grava outra vez, e um negócio que não existe devolve null", async () => {
    const empresa = await criarEmpresa("loja");
    const ana = await criarUsuario("Ana");
    await assumir(empresa.id, ana.id);
    const params = { empresaId: empresa.id, usuarioId: ana.id, moderadorId: moderador.id, motivo: "Teste" };

    await removerDono(params);
    expect(await removerDono(params)).toEqual({ removido: false, username: "loja" });
    expect(await db.registroAuditoria.count({ where: { acao: "empresa.dono_removido" } })).toBe(1);
    expect(await removerDono({ ...params, empresaId: "nao-existe" })).toBeNull();
  });

  it("duas remoções ao mesmo tempo tiram os dois donos e o perfil fica sem dono", async () => {
    const empresa = await criarEmpresa("feira");
    const ana = await criarUsuario("Ana");
    const bia = await criarUsuario("Bia");
    await assumir(empresa.id, ana.id);
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: bia.id } });

    await Promise.all(
      [ana, bia].map((dono) => removerDono({ empresaId: empresa.id, usuarioId: dono.id, moderadorId: moderador.id, motivo: "Teste" })),
    );

    expect(await db.empresaMembro.count({ where: { empresaId: empresa.id } })).toBe(0);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).status).toBe("indicada");
  });
});

describe("removerDono no Clube do Bem", () => {
  it("suspende a liberação e as ofertas que a pessoa criou; a oferta de outro dono continua", async () => {
    const empresa = await criarEmpresa("cafe");
    const ana = await criarUsuario("Ana");
    const bia = await criarUsuario("Bia");
    await assumir(empresa.id, ana.id);
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: bia.id } });
    const liberacao = await db.liberacaoClube.create({
      data: { empresaId: empresa.id, usuarioId: ana.id, cnpj: "06352406000110", status: "liberada", decididoPorId: moderador.id },
    });
    const daAna = await criarOferta(empresa.id, ana.id);
    const daBia = await criarOferta(empresa.id, bia.id);

    const resultado = await removerDono({ empresaId: empresa.id, usuarioId: ana.id, moderadorId: moderador.id, motivo: "Teste" });

    expect(resultado).toMatchObject({ removido: true, ofertasSuspensas: 1 });
    expect(await db.liberacaoClube.findUniqueOrThrow({ where: { id: liberacao.id } })).toMatchObject({
      status: "suspensa",
      motivo: MOTIVO_CLUBE_SEM_DONO,
      decididoPorId: moderador.id,
    });
    expect((await db.oferta.findUniqueOrThrow({ where: { id: daAna.id } })).status).toBe("suspensa");
    expect((await db.oferta.findUniqueOrThrow({ where: { id: daBia.id } })).status).toBe("ativa");
    expect(await db.registroAuditoria.count({ where: { acao: "clube.suspenso", alvoId: empresa.id } })).toBe(1);
  });

  it("um pedido do clube em análise vira recusado, e uma liberação já suspensa não muda", async () => {
    const empresa = await criarEmpresa("bistro");
    const ana = await criarUsuario("Ana");
    const bia = await criarUsuario("Bia");
    await assumir(empresa.id, ana.id);
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: bia.id } });
    const pedido = await db.liberacaoClube.create({ data: { empresaId: empresa.id, usuarioId: ana.id, cnpj: "06352406000110", status: "pendente" } });
    const suspensa = await db.liberacaoClube.create({
      data: { empresaId: empresa.id, usuarioId: bia.id, cnpj: "06352406000110", status: "suspensa", motivo: "O contato do perfil mudou" },
    });

    await removerDono({ empresaId: empresa.id, usuarioId: ana.id, moderadorId: moderador.id, motivo: "Teste" });
    await removerDono({ empresaId: empresa.id, usuarioId: bia.id, moderadorId: moderador.id, motivo: "Teste" });

    expect(await db.liberacaoClube.findUniqueOrThrow({ where: { id: pedido.id } })).toMatchObject({ status: "recusada", motivo: MOTIVO_CLUBE_SEM_DONO });
    expect(await db.liberacaoClube.findUniqueOrThrow({ where: { id: suspensa.id } })).toMatchObject({
      status: "suspensa",
      motivo: "O contato do perfil mudou",
    });
    expect(await db.registroAuditoria.count({ where: { acao: "clube.recusado" } })).toBe(1);
    expect(await db.registroAuditoria.count({ where: { acao: "clube.suspenso" } })).toBe(0);
  });
});

describe("depois de tirar o dono", () => {
  async function tirarDona() {
    const empresa = await criarEmpresa("coffeelab");
    const cristiane = await criarUsuario("Cristiane Oliveira");
    await assumir(empresa.id, cristiane.id);
    await removerDono({ empresaId: empresa.id, usuarioId: cristiane.id, moderadorId: moderador.id, motivo: "Teste" });
    return { empresa, cristiane };
  }

  it("o pedido novo de quem foi tirado vai para a moderação, com uma anotação", async () => {
    const { empresa, cristiane } = await tirarDona();

    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: cristiane.id, ...dadosDoNegocio });

    expect(pedido.status).toBe("pendente");
    expect(pedido.notas).toContain("A moderação já tirou esta conta dos donos deste negócio");
    expect(await db.empresaMembro.count({ where: { empresaId: empresa.id } })).toBe(0);
  });

  it("outra pessoa assume o negócio sem dono na hora", async () => {
    const { empresa } = await tirarDona();
    const isabela = await criarUsuario("Isabela Canto");

    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: isabela.id, ...dadosDoNegocio });

    expect(pedido.status).toBe("aprovada");
    expect(pedido.notas).toBe("");
  });

  it("o botão de aprovar os pedidos sem dono deixa na fila o pedido de quem foi tirado", async () => {
    const { empresa, cristiane } = await tirarDona();
    const pedido = await db.reivindicacao.create({
      data: { empresaId: empresa.id, usuarioId: cristiane.id, metodo: "documento", expiraEm: new Date(Date.now() + 86_400_000) },
    });

    expect(await aprovarPendentesSemDono(moderador.id)).toEqual([]);
    expect((await db.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } })).status).toBe("pendente");
  });

  it("entrar com o Instagram do negócio também vai para a moderação", async () => {
    const { empresa, cristiane } = await tirarDona();

    const resultado = await processarLoginInstagram({
      empresaId: empresa.id,
      usuarioId: cristiane.id,
      conta: { userId: "ig-123", username: "coffeelab" },
    });

    expect(resultado).toEqual({ tipo: "em_analise" });
    const pedido = await db.reivindicacao.findFirstOrThrow({ where: { usuarioId: cristiane.id, metodo: "instagram_login" } });
    expect(pedido.notas).toContain("A moderação já tirou esta conta dos donos deste negócio");
  });
});
