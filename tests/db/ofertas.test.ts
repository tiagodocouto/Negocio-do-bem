import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { suspenderDoClube } from "@/lib/clube";
import { db } from "@/lib/db";
import {
  contatoMudou,
  criarOferta,
  encerrarOferta,
  esquemaDaOferta,
  fimDoDia,
  gerarCupom,
  rotuloOndeVale,
  situacaoDoCupom,
  somarDias,
  suspenderPorContatoAlterado,
  temContatoOuPagamento,
  usarCupom,
  type DadosOferta,
} from "@/lib/ofertas";

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Cupom", "Oferta", "LiberacaoClube", "EmpresaFavorita", "EmpresaMembro", "Empresa", "Usuario" CASCADE`,
  );
}

const HOJE = "2026-11-06";
const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000);
const oferta = (extra: Partial<DadosOferta> = {}): DadosOferta => ({
  titulo: "15% em qualquer pão",
  tipo: "percentual",
  valor: 15,
  condicoes: null,
  ondeVale: "local",
  fim: daqui(7),
  limite: null,
  ...extra,
});

let dona: { id: string };
let cliente: { id: string };
let outraCliente: { id: string };
let empresaId: string;

beforeEach(async () => {
  await limparBanco();
  dona = await db.usuario.create({ data: { nome: "Dora Dona", email: "dora@exemplo.com" } });
  cliente = await db.usuario.create({ data: { nome: "Cris Cliente", email: "cris@exemplo.com" } });
  outraCliente = await db.usuario.create({ data: { nome: "Olga Outra", email: "olga@exemplo.com" } });
  const empresa = await db.empresa.create({
    data: {
      instagramUsername: "padaria.flor",
      nome: "Padaria Flor",
      resumo: "Um negócio do bem",
      categoria: "Café e padaria",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      status: "verificada",
      whatsapp: "5581999998888",
      membros: { create: { usuarioId: dona.id } },
      liberacoesClube: { create: { usuarioId: dona.id, cnpj: "11222333000181" } },
    },
  });
  empresaId = empresa.id;
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("os dados da oferta", () => {
  const conferir = (campos: Record<string, unknown>) =>
    esquemaDaOferta(HOJE).safeParse({
      titulo: "15% em qualquer pão",
      tipo: "percentual",
      valor: "15",
      condicoes: "",
      ondeVale: ["local"],
      ultimoDia: somarDias(HOJE, 6),
      limite: "",
      ...campos,
    });
  const erroEm = (campos: Record<string, unknown>) => {
    const resultado = conferir(campos);
    return resultado.success ? null : resultado.error.issues.map((problema) => problema.path[0]);
  };

  it("aceita uma oferta de 7 dias e termina às 23h59 de Brasília do último dia", () => {
    const resultado = conferir({});
    expect(resultado.success && resultado.data.fim.toISOString()).toBe("2026-11-13T02:59:59.999Z");
  });

  it("dura de hoje até 15 dias, contando hoje", () => {
    expect(erroEm({ ultimoDia: HOJE })).toBeNull();
    expect(erroEm({ ultimoDia: somarDias(HOJE, 14) })).toBeNull();
    expect(erroEm({ ultimoDia: somarDias(HOJE, 15) })).toEqual(["ultimoDia"]);
    expect(erroEm({ ultimoDia: somarDias(HOJE, -1) })).toEqual(["ultimoDia"]);
  });

  it("aceita desconto livre, de 1% a 100%, e valor inteiro em reais; o brinde não tem valor", () => {
    expect(erroEm({ valor: "100" })).toBeNull();
    expect(erroEm({ valor: "101" })).toEqual(["valor"]);
    expect(erroEm({ tipo: "valor", valor: "50000" })).toBeNull();
    expect(erroEm({ valor: "0" })).toEqual(["valor"]);
    expect(erroEm({ tipo: "valor", valor: "20" })).toBeNull();
    expect(erroEm({ tipo: "valor", valor: "20.5" })).toEqual(["valor"]);
    const brinde = conferir({ tipo: "brinde", valor: "" });
    expect(brinde.success && brinde.data.valor).toBeNull();
  });

  it("recusa link, telefone, e-mail, documento e Pix no título e nas condições", () => {
    expect(erroEm({ titulo: "Pague no Pix e ganhe 10%" })).toEqual(["titulo"]);
    expect(erroEm({ condicoes: "Chame no (81) 99999-8888" })).toEqual(["condicoes"]);
    expect(erroEm({ condicoes: "Veja em padariaflor.com.br" })).toEqual(["condicoes"]);
    expect(erroEm({ condicoes: "Mande para contato@padaria.com" })).toEqual(["condicoes"]);
    expect(erroEm({ condicoes: "CNPJ 11.222.333/0001-81" })).toEqual(["condicoes"]);
    expect(temContatoOuPagamento("Válido até 10/11, não vale com outras promoções")).toBe(false);
  });

  it("precisa dizer onde vale e escreve isso em português", () => {
    expect(erroEm({ ondeVale: [] })).toEqual(["ondeVale"]);
    expect(rotuloOndeVale("local,whatsapp,site")).toBe("No local, pelo WhatsApp e pelo site");
    expect(rotuloOndeVale("whatsapp")).toBe("Pelo WhatsApp");
  });

  it("o fim é 23h59 em Brasília", () => {
    expect(fimDoDia("2026-11-20").toISOString()).toBe("2026-11-21T02:59:59.999Z");
  });
});

describe("criar e encerrar oferta", () => {
  it("o dono liberado cria a oferta, com auditoria", async () => {
    const id = await criarOferta(empresaId, dona.id, oferta());

    expect(await db.oferta.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "ativa", criadaPorId: dona.id });
    expect(await db.registroAuditoria.findMany({ where: { acao: "oferta.criada" } })).toHaveLength(1);
  });

  it("sem liberação, ou com ela suspensa, não cria", async () => {
    await db.liberacaoClube.updateMany({ data: { status: "suspensa" } });

    await expect(criarOferta(empresaId, dona.id, oferta())).rejects.toThrow("não foi liberado");
  });

  it("uma oferta valendo por vez, mesmo com dois envios ao mesmo tempo", async () => {
    const resultados = await Promise.allSettled([criarOferta(empresaId, dona.id, oferta()), criarOferta(empresaId, dona.id, oferta())]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.oferta.count()).toBe(1);
  });

  it("negócio oculto não cria oferta", async () => {
    await db.empresa.update({ where: { id: empresaId }, data: { oculta: true } });

    await expect(criarOferta(empresaId, dona.id, oferta())).rejects.toThrow("precisa estar no diretório");
  });

  it("encerrar tira a oferta do ar, mas o cupom já gerado vale até o fim previsto", async () => {
    const id = await criarOferta(empresaId, dona.id, oferta());
    const gerado = await gerarCupom(id, cliente.id);

    expect(await encerrarOferta(id, dona.id)).toBe("padaria.flor");
    expect(await gerarCupom(id, outraCliente.id)).toEqual({ erro: "indisponivel" });
    expect("cupom" in gerado && (await usarCupom(empresaId, gerado.cupom.codigo, dona.id)).situacao).toBe("usado_agora");
  });

  it("quem não é dono não encerra", async () => {
    const id = await criarOferta(empresaId, dona.id, oferta());

    expect(await encerrarOferta(id, cliente.id)).toBeNull();
    expect((await db.oferta.findUniqueOrThrow({ where: { id } })).status).toBe("ativa");
  });
});

describe("gerar cupom", () => {
  it("gera um código de 6 caracteres sem 0, O, 1 e I, e favorita o negócio", async () => {
    const id = await criarOferta(empresaId, dona.id, oferta());

    const resultado = await gerarCupom(id, cliente.id);

    expect(resultado).toMatchObject({ novo: true, favoritou: true });
    expect("cupom" in resultado && resultado.cupom.codigo).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(await db.empresaFavorita.count({ where: { empresaId, usuarioId: cliente.id } })).toBe(1);
  });

  it("um cupom por pessoa por oferta, mesmo com dois pedidos ao mesmo tempo", async () => {
    const id = await criarOferta(empresaId, dona.id, oferta());

    const [a, b] = await Promise.all([gerarCupom(id, cliente.id), gerarCupom(id, cliente.id)]);

    expect("cupom" in a && "cupom" in b && a.cupom.codigo === b.cupom.codigo).toBe(true);
    expect(await db.cupom.count()).toBe(1);
    expect((await db.oferta.findUniqueOrThrow({ where: { id } })).cuponsGerados).toBe(1);
  });

  it("o último cupom vai para uma pessoa só, mesmo com duas pedindo ao mesmo tempo", async () => {
    const id = await criarOferta(empresaId, dona.id, oferta({ limite: 1 }));

    const resultados = await Promise.all([gerarCupom(id, cliente.id), gerarCupom(id, outraCliente.id)]);

    expect(resultados.filter((r) => "cupom" in r)).toHaveLength(1);
    expect(resultados.filter((r) => "erro" in r && r.erro === "esgotada")).toHaveLength(1);
    expect(await db.cupom.count()).toBe(1);
  });

  it("o dono não gera cupom do próprio negócio", async () => {
    const id = await criarOferta(empresaId, dona.id, oferta());

    expect(await gerarCupom(id, dona.id)).toEqual({ erro: "dono" });
  });

  it("negócio que saiu do diretório não gera cupom", async () => {
    const id = await criarOferta(empresaId, dona.id, oferta());
    await db.empresa.update({ where: { id: empresaId }, data: { oculta: true } });

    expect(await gerarCupom(id, cliente.id)).toEqual({ erro: "indisponivel" });
  });
});

describe("validar no balcão", () => {
  async function cupomDe(pessoa: { id: string }, extra: Partial<DadosOferta> = {}) {
    const id = await criarOferta(empresaId, dona.id, oferta(extra));
    const resultado = await gerarCupom(id, pessoa.id);
    if (!("cupom" in resultado)) throw new Error("O cupom não saiu.");
    return { ofertaId: id, codigo: resultado.cupom.codigo };
  }

  it("marca como usado uma vez só, mesmo com duas validações ao mesmo tempo", async () => {
    const { codigo } = await cupomDe(cliente);

    const resultados = await Promise.all([usarCupom(empresaId, codigo, dona.id), usarCupom(empresaId, codigo.toLowerCase(), dona.id)]);

    expect(resultados.map((r) => r.situacao).sort()).toEqual(["usado", "usado_agora"]);
    expect(await db.cupom.findUniqueOrThrow({ where: { codigo } })).toMatchObject({ validadoPorId: dona.id });
  });

  it("aceita o código com hífen e minúsculas", async () => {
    const { codigo } = await cupomDe(cliente);

    expect((await usarCupom(empresaId, `${codigo.slice(0, 3)}-${codigo.slice(3)}`.toLowerCase(), dona.id)).situacao).toBe("usado_agora");
  });

  it("cupom de outro negócio, ou validado por quem não é dono, não é achado", async () => {
    const { codigo } = await cupomDe(cliente);
    const outra = await db.empresa.create({
      data: { instagramUsername: "outra", nome: "Outra", resumo: "Outra", categoria: "Serviços", cidade: "Recife", uf: "PE", membros: { create: { usuarioId: outraCliente.id } } },
    });

    expect((await usarCupom(outra.id, codigo, outraCliente.id)).situacao).toBe("nao_encontrado");
    expect((await usarCupom(empresaId, codigo, cliente.id)).situacao).toBe("nao_encontrado");
  });

  it("cupom vencido não vale", async () => {
    const { ofertaId, codigo } = await cupomDe(cliente);
    await db.oferta.update({ where: { id: ofertaId }, data: { fim: daqui(-1) } });

    expect((await usarCupom(empresaId, codigo, dona.id)).situacao).toBe("vencido");
  });

  it("a suspensão pela moderação tira a oferta do ar, e o cupom deixa de valer", async () => {
    const { ofertaId, codigo } = await cupomDe(cliente);
    const liberacao = await db.liberacaoClube.findFirstOrThrow();

    await suspenderDoClube({ liberacaoId: liberacao.id, moderadorId: dona.id, motivo: "Conferência" });

    expect((await db.oferta.findUniqueOrThrow({ where: { id: ofertaId } })).status).toBe("suspensa");
    expect((await usarCupom(empresaId, codigo, dona.id)).situacao).toBe("suspenso");
  });

  it("a situação de um cupom", () => {
    const agora = new Date("2026-11-06T12:00:00Z");
    const fim = new Date("2026-11-07T02:59:59.999Z");
    expect(situacaoDoCupom({ usadoEm: null, oferta: { fim, status: "encerrada" } }, agora)).toBe("valido");
    expect(situacaoDoCupom({ usadoEm: agora, oferta: { fim, status: "ativa" } }, agora)).toBe("usado");
  });
});

describe("contato trocado pelo dono", () => {
  it("só os campos de contato contam, e vazio é igual a nada", () => {
    const antes = { whatsapp: "5581999998888", telefoneComercial: null, site: null, emailContato: null };
    expect(contatoMudou(antes, { ...antes, telefoneComercial: "" })).toBe(false);
    expect(contatoMudou(antes, { ...antes, whatsapp: "5581911112222" })).toBe(true);
  });

  it("suspende as liberações e tira as ofertas do ar, como sistema na auditoria", async () => {
    const id = await criarOferta(empresaId, dona.id, oferta());

    await db.$transaction((tx) => suspenderPorContatoAlterado(tx, { id: empresaId, instagramUsername: "padaria.flor" }));

    expect((await db.liberacaoClube.findFirstOrThrow()).status).toBe("suspensa");
    expect((await db.oferta.findUniqueOrThrow({ where: { id } })).status).toBe("suspensa");
    expect(await db.registroAuditoria.findFirst({ where: { acao: "clube.suspenso" } })).toMatchObject({ usuarioId: null });
  });
});
