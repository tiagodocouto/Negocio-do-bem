import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { enviarEmail, type Email } from "@/lib/email";
import {
  avisarDecisaoDaReivindicacao,
  avisarDecisaoDoClube,
  avisarDonoRemovido,
  avisarNovaDenuncia,
  avisarNovaReivindicacao,
  avisarNovoDepoimento,
  avisarNovoPedidoDoClube,
} from "@/lib/notificacoes";
import { aprovar, recusar, removerDono, solicitarPorDocumento } from "@/lib/reivindicacao";

// O envio de verdade é testado em tests/unit/email.test.ts. Aqui só importa quem
// recebe cada aviso e o que vai nele.
vi.mock("@/lib/email", () => ({ envioLigado: vi.fn(() => true), enviarEmail: vi.fn(async () => true) }));

const enviados = () => vi.mocked(enviarEmail).mock.calls.map(([email]) => email as Email);
const destinatarios = () => enviados().map((email) => email.para).sort();

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

async function criarConta(nome: string, email: string, papel = "membro") {
  return db.usuario.create({ data: { nome, email, senhaHash: "x", papel } });
}

async function criarEmpresa(username: string, donos: { id: string }[] = []) {
  return db.empresa.create({
    data: {
      instagramUsername: username,
      nome: `Padaria ${username}`,
      resumo: "Um negócio do bem",
      categoria: "Café e padaria",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      membros: { create: donos.map((dono) => ({ usuarioId: dono.id })) },
    },
  });
}

const dadosDoNegocio = { cnpj: null, site: null, relacao: "Sou a dona", contato: "81 99999-9999", mensagem: null };

beforeEach(async () => {
  await limparBanco();
  vi.mocked(enviarEmail).mockClear();
  await criarConta("Moderadora Um", "mod1@exemplo.com", "moderador");
  await criarConta("Moderador Dois", "mod2@exemplo.com", "moderador");
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("decisão da reivindicação", () => {
  it("avisa quem pediu quando a moderação aprova", async () => {
    const moderadora = await db.usuario.findUniqueOrThrow({ where: { email: "mod1@exemplo.com" } });
    const dona = await criarConta("Ana Souza", "ana@exemplo.com");
    const outra = await criarConta("Bia", "bia@exemplo.com");
    const empresa = await criarEmpresa("florescer", [outra]);
    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: dona.id, ...dadosDoNegocio });
    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderadora.id, modo: "transferir" });

    await avisarDecisaoDaReivindicacao(pedido.id);

    expect(destinatarios()).toEqual(["ana@exemplo.com"]);
    const [email] = enviados();
    expect(email!.assunto).toBe("Você agora é dono de Padaria florescer no Negócio do Bem");
    expect(email!.texto).toContain("Olá, Ana!");
    expect(email!.texto).toContain("/painel/florescer");
  });

  it("avisa quem pediu quando a moderação recusa, com o motivo", async () => {
    const moderadora = await db.usuario.findUniqueOrThrow({ where: { email: "mod1@exemplo.com" } });
    const pessoa = await criarConta("Caio", "caio@exemplo.com");
    const dono = await criarConta("Dono", "dono@exemplo.com");
    const empresa = await criarEmpresa("florescer", [dono]);
    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: pessoa.id, ...dadosDoNegocio });
    await recusar({ reivindicacaoId: pedido.id, revisorId: moderadora.id, motivo: "O CNPJ é de outro negócio." });

    await avisarDecisaoDaReivindicacao(pedido.id);

    expect(destinatarios()).toEqual(["caio@exemplo.com"]);
    expect(enviados()[0]!.assunto).toBe("Seu pedido para Padaria florescer não foi aprovado");
    expect(enviados()[0]!.texto).toContain("Motivo: O CNPJ é de outro negócio.");
  });

  it("não manda nada para um pedido que ainda está na fila", async () => {
    const pessoa = await criarConta("Caio", "caio@exemplo.com");
    const dono = await criarConta("Dono", "dono@exemplo.com");
    const empresa = await criarEmpresa("florescer", [dono]);
    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: pessoa.id, ...dadosDoNegocio });

    await avisarDecisaoDaReivindicacao(pedido.id);

    expect(enviarEmail).not.toHaveBeenCalled();
  });
});

describe("avisos para a moderação", () => {
  it("cada pessoa da moderação recebe o próprio e-mail de um pedido novo, sem dados de quem pediu", async () => {
    const pessoa = await criarConta("Caio Lima", "caio@exemplo.com");
    const dono = await criarConta("Dono", "dono@exemplo.com");
    const empresa = await criarEmpresa("florescer", [dono]);
    await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: pessoa.id, ...dadosDoNegocio });

    await avisarNovaReivindicacao(empresa.id);

    expect(destinatarios()).toEqual(["mod1@exemplo.com", "mod2@exemplo.com"]);
    for (const email of enviados()) {
      expect(email.assunto).toBe("Novo pedido de reivindicação: @florescer");
      expect(email.texto).toContain("/moderacao?aba=reivindicacoes");
      expect(email.texto).not.toContain("Caio");
      expect(email.texto).not.toContain("81 99999-9999");
    }
  });

  it("a moderação recebe a denúncia de um depoimento", async () => {
    const autora = await criarConta("Lia", "lia@exemplo.com");
    const empresa = await criarEmpresa("florescer");
    const depoimento = await db.depoimento.create({
      data: { empresaId: empresa.id, autorId: autora.id, texto: "Um texto qualquer que foi denunciado." },
    });

    await avisarNovaDenuncia(depoimento.id);

    expect(destinatarios()).toEqual(["mod1@exemplo.com", "mod2@exemplo.com"]);
    expect(enviados()[0]!.assunto).toBe("Depoimento denunciado em Padaria florescer");
    expect(enviados()[0]!.texto).toContain("/moderacao?aba=denuncias");
  });
});

describe("Clube do Bem", () => {
  async function pedidoDe(status: string, motivo: string | null = null) {
    const dona = await criarConta("Dora Dona", "dora@exemplo.com");
    const empresa = await criarEmpresa("florescer", [dona]);
    await db.liberacaoClube.create({ data: { empresaId: empresa.id, usuarioId: dona.id, cnpj: "11222333000181", status, motivo } });
    return { empresaId: empresa.id, donaId: dona.id };
  }

  it("cada pessoa da moderação recebe o pedido de verificação, sem o nome nem o CNPJ do dono", async () => {
    const { empresaId } = await pedidoDe("pendente");

    await avisarNovoPedidoDoClube(empresaId);

    expect(destinatarios()).toEqual(["mod1@exemplo.com", "mod2@exemplo.com"]);
    for (const email of enviados()) {
      expect(email.assunto).toBe("Novo pedido do Clube do Bem: @florescer");
      expect(email.texto).toContain("/moderacao?aba=clube");
      expect(email.texto).not.toContain("Dora");
      expect(email.texto).not.toContain("11.222.333");
    }
  });

  it("o dono liberado recebe o link do painel do clube", async () => {
    const { empresaId, donaId } = await pedidoDe("liberada");

    await avisarDecisaoDoClube(empresaId, donaId);

    expect(destinatarios()).toEqual(["dora@exemplo.com"]);
    expect(enviados()[0]!.assunto).toBe("Padaria florescer está no Clube do Bem");
    expect(enviados()[0]!.texto).toContain("/painel/florescer/clube");
  });

  it("o dono recusado recebe o motivo e o caminho para pedir de novo", async () => {
    const { empresaId, donaId } = await pedidoDe("recusada", "O nome não bate com os sócios.");

    await avisarDecisaoDoClube(empresaId, donaId);

    expect(destinatarios()).toEqual(["dora@exemplo.com"]);
    expect(enviados()[0]!.texto).toContain("Motivo: O nome não bate com os sócios.");
    expect(enviados()[0]!.texto).toContain("/painel/florescer/clube");
  });

  it("um pedido ainda na fila não manda nada para o dono", async () => {
    const { empresaId, donaId } = await pedidoDe("pendente");

    await avisarDecisaoDoClube(empresaId, donaId);

    expect(enviados()).toHaveLength(0);
  });
});

describe("dono removido pela moderação", () => {
  it("só a pessoa recebe, com o motivo e o caminho para pedir o perfil de novo", async () => {
    const moderadora = await db.usuario.findUniqueOrThrow({ where: { email: "mod1@exemplo.com" } });
    const dona = await criarConta("Cristiane Oliveira", "cris@exemplo.com");
    const empresa = await criarEmpresa("coffeelab", [dona]);
    const motivo = "O nome não bate com a sócia na Receita";
    await removerDono({ empresaId: empresa.id, usuarioId: dona.id, moderadorId: moderadora.id, motivo });

    await avisarDonoRemovido(empresa.id, dona.id, motivo);

    expect(destinatarios()).toEqual(["cris@exemplo.com"]);
    const [email] = enviados();
    expect(email!.assunto).toBe("Você não é mais dono de Padaria coffeelab no Negócio do Bem");
    expect(email!.texto).toContain("Olá, Cristiane!");
    expect(email!.texto).toContain("Motivo: O nome não bate com a sócia na Receita.");
    expect(email!.texto).toContain("/empresas/coffeelab/reivindicar");
  });
});

describe("depoimento novo", () => {
  it("cada dono recebe o próprio e-mail, com o texto e o link para responder", async () => {
    const ana = await criarConta("Ana Souza", "ana@exemplo.com");
    const bia = await criarConta("Bia Reis", "bia@exemplo.com");
    const autora = await criarConta("Lia Prado", "lia@exemplo.com");
    const empresa = await criarEmpresa("florescer", [ana, bia]);
    const depoimento = await db.depoimento.create({
      data: { empresaId: empresa.id, autorId: autora.id, texto: "O melhor pão da cidade, e feito com carinho." },
    });

    await avisarNovoDepoimento(depoimento.id);

    expect(destinatarios()).toEqual(["ana@exemplo.com", "bia@exemplo.com"]);
    const paraAna = enviados().find((email) => email.para === "ana@exemplo.com")!;
    expect(paraAna.assunto).toBe("Novo depoimento em Padaria florescer");
    expect(paraAna.texto).toContain("Olá, Ana!");
    expect(paraAna.texto).toContain("Lia Prado deixou um depoimento");
    expect(paraAna.texto).toContain('"O melhor pão da cidade, e feito com carinho."');
    expect(paraAna.texto).toContain("/painel/florescer#depoimentos");
  });

  it("um negócio sem dono não manda nada", async () => {
    const autora = await criarConta("Lia", "lia@exemplo.com");
    const empresa = await criarEmpresa("florescer");
    const depoimento = await db.depoimento.create({
      data: { empresaId: empresa.id, autorId: autora.id, texto: "O melhor pão da cidade, e feito com carinho." },
    });

    await avisarNovoDepoimento(depoimento.id);

    expect(enviarEmail).not.toHaveBeenCalled();
  });
});
