import { renderToReadableStream } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { suspenderDoClube } from "@/lib/clube";
import { db } from "@/lib/db";
import { criarOferta, encerrarOferta, gerarCupom, situacaoDoCupom, usarCupom, type DadosOferta } from "@/lib/ofertas";
import { removerDono } from "@/lib/reivindicacao";

const sessao = vi.hoisted(() => ({
  id: "",
  nome: "Dora Dona",
  email: "dora@exemplo.com",
  moderador: true,
  emailConfirmado: true,
}));

vi.mock("@/lib/auth/sessao", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("@/lib/auth/sessao")>()),
  exigirUsuario: vi.fn(async () => sessao),
  exigirModerador: vi.fn(async () => sessao),
}));

vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECIONAR:${destino}`);
  },
}));

vi.mock("next/server", () => ({ after: vi.fn() }));

const { salvarEmpresa, alternarVisibilidade } = await import("@/acoes/empresas");
const { moderarEmpresa } = await import("@/acoes/moderacao");
const { default: MeusCupons } = await import("@/app/cupons/meus/page");

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Cupom", "Oferta", "LiberacaoClube", "EmpresaFavorita", "EmpresaCausa", "EmpresaMembro", "Empresa", "Usuario" CASCADE`,
  );
}

const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000);
const dadosOferta = (extra: Partial<DadosOferta> = {}): DadosOferta => ({
  titulo: "15% em qualquer pão",
  tipo: "percentual",
  valor: 15,
  condicoes: null,
  ondeVale: "local",
  fim: daqui(7),
  limite: null,
  ...extra,
});

function formDe(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.set(chave, valor);
  return dados;
}

async function renderizarPagina(elemento: React.ReactElement): Promise<string> {
  const fluxo = await renderToReadableStream(elemento);
  await fluxo.allReady;
  return new Response(fluxo).text();
}

let dona: { id: string; nome: string; email: string };
let moderadora: { id: string; nome: string; email: string };
let cliente: { id: string; nome: string; email: string };
let empresaId: string;
let liberacaoId: string;

beforeEach(async () => {
  await limparBanco();
  dona = await db.usuario.create({ data: { nome: "Dora Dona", email: "dora@exemplo.com" } });
  moderadora = await db.usuario.create({ data: { nome: "Marta Moderadora", email: "marta@exemplo.com", papel: "moderador" } });
  cliente = await db.usuario.create({ data: { nome: "Cris Cliente", email: "cris@exemplo.com" } });

  const empresa = await db.empresa.create({
    data: {
      instagramUsername: "padaria.flor",
      nome: "Padaria Flor",
      resumo: "Um negócio do bem em Recife",
      categoria: "Café e padaria",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      status: "verificada",
      whatsapp: "5581999998888",
      membros: { create: { usuarioId: dona.id } },
      liberacoesClube: { create: { usuarioId: dona.id, cnpj: "11222333000181" } },
    },
    include: { liberacoesClube: true },
  });
  empresaId = empresa.id;
  liberacaoId = empresa.liberacoesClube[0].id;
  Object.assign(sessao, { id: dona.id, nome: dona.nome, email: dona.email, moderador: false });
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

async function criarOfertaEncerradaComCupom() {
  const ofertaId = await criarOferta(empresaId, dona.id, dadosOferta());
  const gerado = await gerarCupom(ofertaId, cliente.id);
  if (!("cupom" in gerado)) throw new Error("Falha ao gerar cupom no preparo.");
  await encerrarOferta(ofertaId, dona.id);
  expect((await db.oferta.findUniqueOrThrow({ where: { id: ofertaId } })).status).toBe("encerrada");
  return { ofertaId, codigo: gerado.cupom.codigo };
}

describe("cupons depois de suspensão do clube ou saída do negócio do ar (#304)", () => {
  it("oferta encerrada com cupom gerado, depois suspenderDoClube: o cupom fica suspenso e usarCupom recusa", async () => {
    const { ofertaId, codigo } = await criarOfertaEncerradaComCupom();

    await suspenderDoClube({ liberacaoId, moderadorId: moderadora.id, motivo: "Conferência" });

    const cupom = await db.cupom.findUniqueOrThrow({
      where: { codigo },
      include: { oferta: { select: { fim: true, status: true } } },
    });
    expect(cupom.oferta.status).toBe("suspensa");
    expect(situacaoDoCupom(cupom)).toBe("suspenso");
    expect((await usarCupom(empresaId, codigo, dona.id)).situacao).toBe("suspenso");
    expect((await db.oferta.findUniqueOrThrow({ where: { id: ofertaId } })).status).toBe("suspensa");
  });

  it("oferta encerrada com cupom gerado, depois troca de WhatsApp pelo dono (suspenderPorContatoAlterado): o cupom fica suspenso", async () => {
    const { ofertaId, codigo } = await criarOfertaEncerradaComCupom();

    Object.assign(sessao, { id: dona.id, nome: dona.nome, email: dona.email, moderador: false });
    await expect(
      salvarEmpresa(
        undefined,
        formDe({
          empresaId,
          nome: "Padaria Flor",
          categoria: "Café e padaria",
          municipio: "Recife, PE",
          resumo: "Um negócio do bem em Recife",
          historia: "",
          site: "",
          whatsapp: "(81) 91111-2222",
          emailContato: "",
          telefoneComercial: "",
        }),
      ),
    ).rejects.toThrow("REDIRECIONAR:");

    expect((await db.oferta.findUniqueOrThrow({ where: { id: ofertaId } })).status).toBe("suspensa");
    expect((await usarCupom(empresaId, codigo, dona.id)).situacao).toBe("suspenso");
  });

  it("oferta encerrada com cupom gerado, depois removerDono: suspende a oferta de quem saiu e preserva a da co-dona", async () => {
    const coDona = await db.usuario.create({ data: { nome: "Bia Sócia", email: "bia@exemplo.com" } });
    await db.empresaMembro.create({ data: { empresaId, usuarioId: coDona.id } });
    await db.liberacaoClube.create({ data: { empresaId, usuarioId: coDona.id, cnpj: "11222333000181" } });

    const { ofertaId: ofertaDaDona, codigo: cupomDaDona } = await criarOfertaEncerradaComCupom();
    const ofertaDaCoDona = await criarOferta(empresaId, coDona.id, dadosOferta({ titulo: "20% no café coado" }));
    const geradoCoDona = await gerarCupom(ofertaDaCoDona, cliente.id);
    if (!("cupom" in geradoCoDona)) throw new Error("Falha ao gerar segundo cupom.");
    await encerrarOferta(ofertaDaCoDona, coDona.id);

    const resultado = await removerDono({
      empresaId,
      usuarioId: dona.id,
      moderadorId: moderadora.id,
      motivo: "Não faz parte do quadro societário",
    });

    expect(resultado).toMatchObject({ removido: true, ofertasSuspensas: 1 });
    expect((await db.oferta.findUniqueOrThrow({ where: { id: ofertaDaDona } })).status).toBe("suspensa");
    expect((await usarCupom(empresaId, cupomDaDona, coDona.id)).situacao).toBe("suspenso");
    expect((await db.oferta.findUniqueOrThrow({ where: { id: ofertaDaCoDona } })).status).toBe("encerrada");
    expect((await usarCupom(empresaId, geradoCoDona.cupom.codigo, coDona.id)).situacao).toBe("usado_agora");
  });

  it("oferta já vencida não muda de status nas suspensões nem na rejeição", async () => {
    const vencidaAtiva = await db.oferta.create({
      data: {
        empresaId,
        criadaPorId: dona.id,
        titulo: "Oferta vencida ativa",
        tipo: "percentual",
        valor: 10,
        ondeVale: "local",
        status: "ativa",
        fim: daqui(-2),
      },
    });
    const vencidaEncerrada = await db.oferta.create({
      data: {
        empresaId,
        criadaPorId: dona.id,
        titulo: "Oferta vencida encerrada",
        tipo: "percentual",
        valor: 10,
        ondeVale: "local",
        status: "encerrada",
        fim: daqui(-1),
      },
    });

    await suspenderDoClube({ liberacaoId, moderadorId: moderadora.id, motivo: "Conferência" });
    Object.assign(sessao, { id: moderadora.id, nome: moderadora.nome, email: moderadora.email, moderador: true });
    await expect(moderarEmpresa(formDe({ empresaId, decisao: "rejeitar", aba: "negocios" }))).rejects.toThrow("REDIRECIONAR:");

    expect((await db.oferta.findUniqueOrThrow({ where: { id: vencidaAtiva.id } })).status).toBe("ativa");
    expect((await db.oferta.findUniqueOrThrow({ where: { id: vencidaEncerrada.id } })).status).toBe("encerrada");
  });

  it("negócio rejeitado pela moderação: ofertas ativas e encerradas no prazo ficam suspensas, e os cupons ficam suspensos", async () => {
    const { ofertaId: encerradaId, codigo: codigoEncerrada } = await criarOfertaEncerradaComCupom();
    const ativaId = await criarOferta(empresaId, dona.id, dadosOferta({ titulo: "Brinde da casa", tipo: "brinde", valor: null }));
    const geradoAtiva = await gerarCupom(ativaId, cliente.id);
    if (!("cupom" in geradoAtiva)) throw new Error("Falha ao gerar cupom da oferta ativa.");

    Object.assign(sessao, { id: moderadora.id, nome: moderadora.nome, email: moderadora.email, moderador: true });
    await expect(moderarEmpresa(formDe({ empresaId, decisao: "rejeitar", aba: "negocios" }))).rejects.toThrow("REDIRECIONAR:");

    expect((await db.oferta.findUniqueOrThrow({ where: { id: encerradaId } })).status).toBe("suspensa");
    expect((await db.oferta.findUniqueOrThrow({ where: { id: ativaId } })).status).toBe("suspensa");
    expect((await usarCupom(empresaId, codigoEncerrada, dona.id)).situacao).toBe("suspenso");
    expect((await usarCupom(empresaId, geradoAtiva.cupom.codigo, dona.id)).situacao).toBe("suspenso");
  });

  it("negócio oculto pelo dono: o cupom continua válido e /cupons mostra o nome sem link 404 e com aviso", async () => {
    const ofertaId = await criarOferta(empresaId, dona.id, dadosOferta());
    const gerado = await gerarCupom(ofertaId, cliente.id);
    if (!("cupom" in gerado)) throw new Error("Falha ao gerar cupom.");

    Object.assign(sessao, { id: cliente.id, nome: cliente.nome, email: cliente.email, moderador: false });
    const htmlVisivel = await renderizarPagina(<MeusCupons params={Promise.resolve({})} searchParams={Promise.resolve({})} />);
    expect(htmlVisivel).toContain('href="/empresas/padaria.flor"');
    expect(htmlVisivel).not.toContain("Este negócio saiu do diretório.");

    Object.assign(sessao, { id: dona.id, nome: dona.nome, email: dona.email, moderador: false });
    await expect(alternarVisibilidade(formDe({ empresaId, ocultar: "sim" }))).rejects.toThrow("REDIRECIONAR:");

    Object.assign(sessao, { id: cliente.id, nome: cliente.nome, email: cliente.email, moderador: false });
    const htmlOculto = await renderizarPagina(<MeusCupons params={Promise.resolve({})} searchParams={Promise.resolve({})} />);
    expect(htmlOculto).toContain("Padaria Flor");
    expect(htmlOculto).not.toContain('href="/empresas/padaria.flor"');
    expect(htmlOculto).toContain("Este negócio saiu do diretório. O cupom vale no balcão até o fim da oferta.");

    expect((await usarCupom(empresaId, gerado.cupom.codigo, dona.id)).situacao).toBe("usado_agora");
  });
});
