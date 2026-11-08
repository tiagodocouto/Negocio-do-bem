import { renderToReadableStream } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  aprovarPendentesSemDono,
  foiTiradaDosDonos,
  pendentesQueAprovamSozinhos,
  removerDono,
  solicitarPorDocumento,
} from "@/lib/reivindicacao";

const sessao = vi.hoisted(() => ({
  id: "",
  nome: "Marta Moderadora",
  email: "marta@exemplo.com",
  moderador: true,
  emailConfirmado: true,
}));

vi.mock("@/lib/auth/sessao", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("@/lib/auth/sessao")>()),
  usuarioAtual: vi.fn(async () => (sessao.id ? sessao : null)),
  exigirUsuario: vi.fn(async () => sessao),
  exigirModerador: vi.fn(async () => sessao),
}));

vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECIONAR:${destino}`);
  },
  notFound: () => {
    throw new Error("NAO_ENCONTRADO");
  },
}));

vi.mock("next/server", () => ({ after: vi.fn() }));

const { enviarDocumento } = await import("@/acoes/reivindicacoes");
const { default: Moderacao } = await import("@/app/moderacao/page");
const { default: PaginaReivindicar } = await import("@/app/empresas/[usuario]/reivindicar/page");

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Cupom", "Oferta", "LiberacaoClube", "Reivindicacao", "EmpresaMembro", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

let contador = 0;
async function criarUsuario(nome: string, papel: "usuario" | "moderador" = "usuario") {
  contador++;
  return db.usuario.create({
    data: { nome, email: `pessoa${contador}@exemplo.com`, senhaHash: "x", papel, emailConfirmadoEm: new Date() },
  });
}

async function criarEmpresa(username: string, extra: { oculta?: boolean } = {}) {
  return db.empresa.create({
    data: {
      instagramUsername: username,
      nome: `Negócio ${username}`,
      resumo: "Um negócio do bem",
      categoria: "Café e padaria",
      cidade: "São Paulo",
      uf: "SP",
      moderacao: "aprovada",
      ...extra,
    },
  });
}

const dadosDoNegocio = { cnpj: null, site: null, relacao: "Sou a dona", contato: "11 99999-9999", mensagem: null };

async function assumir(empresaId: string, usuarioId: string) {
  const pedido = await solicitarPorDocumento({ empresaId, usuarioId, ...dadosDoNegocio });
  expect(pedido.status).toBe("aprovada");
  return pedido;
}

function formDe(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.set(chave, valor);
  return dados;
}

async function renderizarPagina(elemento: React.ReactElement): Promise<string> {
  const fluxo = await renderToReadableStream(elemento);
  await fluxo.allReady;
  const bruto = await new Response(fluxo).text();
  // O React separa textos vizinhos com <!-- -->; tirar só esse marcador evita sanitizar HTML com regex.
  return bruto.split("<!-- -->").join("");
}

let moderadora: { id: string; nome: string; email: string };
beforeEach(async () => {
  await limparBanco();
  moderadora = await criarUsuario("Marta Moderadora", "moderador");
  Object.assign(sessao, {
    id: moderadora.id,
    nome: moderadora.nome,
    email: moderadora.email,
    moderador: true,
    emailConfirmado: true,
  });
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("remoção de dono: botão em lote, avisos e perfil oculto (#305)", () => {
  it("conta removida pede de novo um negócio sem dono: a função compartilhada não devolve esse pedido e o botão em lote não aparece", async () => {
    const empresa = await criarEmpresa("coffeelab");
    const cristiane = await criarUsuario("Cristiane Oliveira");
    await assumir(empresa.id, cristiane.id);
    await removerDono({ empresaId: empresa.id, usuarioId: cristiane.id, moderadorId: moderadora.id, motivo: "Não é sócia" });

    const novoPedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: cristiane.id, ...dadosDoNegocio });
    expect(novoPedido.status).toBe("pendente");

    const html = await renderizarPagina(
      <Moderacao params={Promise.resolve({})} searchParams={Promise.resolve({ aba: "reivindicacoes" })} />,
    );
    expect(html).toContain("Cristiane Oliveira");
    expect(html).not.toContain("Aprovar o pedido sem dono");

    expect(await foiTiradaDosDonos(empresa.id, cristiane.id)).toBe(true);
    expect(await pendentesQueAprovamSozinhos()).toEqual([]);
  });

  it("pedido comum pendente de negócio sem dono continua aparecendo e sendo aprovado pelo botão, mesmo após pedido de conta removida", async () => {
    const coffeelab = await criarEmpresa("coffeelab");
    const padaria = await criarEmpresa("padaria");
    const cristiane = await criarUsuario("Cristiane Removida");
    const ana = await criarUsuario("Ana Removida");
    const isabela = await criarUsuario("Isabela Comum");
    const carlos = await criarUsuario("Carlos Segundo");

    await assumir(coffeelab.id, cristiane.id);
    await removerDono({ empresaId: coffeelab.id, usuarioId: cristiane.id, moderadorId: moderadora.id, motivo: "Teste" });
    await assumir(padaria.id, ana.id);
    await removerDono({ empresaId: padaria.id, usuarioId: ana.id, moderadorId: moderadora.id, motivo: "Teste" });

    const base = Date.now();
    const pedidoCristiane = await db.reivindicacao.create({
      data: {
        empresaId: coffeelab.id,
        usuarioId: cristiane.id,
        metodo: "documento",
        criadoEm: new Date(base - 30_000),
        expiraEm: new Date(base + 86_400_000),
      },
    });
    const pedidoIsabela = await db.reivindicacao.create({
      data: {
        empresaId: coffeelab.id,
        usuarioId: isabela.id,
        metodo: "documento",
        criadoEm: new Date(base - 20_000),
        expiraEm: new Date(base + 86_400_000),
      },
    });
    const pedidoCarlos = await db.reivindicacao.create({
      data: {
        empresaId: coffeelab.id,
        usuarioId: carlos.id,
        metodo: "documento",
        criadoEm: new Date(base - 10_000),
        expiraEm: new Date(base + 86_400_000),
      },
    });
    const pedidoAna = await db.reivindicacao.create({
      data: {
        empresaId: padaria.id,
        usuarioId: ana.id,
        metodo: "documento",
        criadoEm: new Date(base - 25_000),
        expiraEm: new Date(base + 86_400_000),
      },
    });

    const html = await renderizarPagina(
      <Moderacao params={Promise.resolve({})} searchParams={Promise.resolve({ aba: "reivindicacoes" })} />,
    );
    expect(html).toContain("Aprovar o pedido sem dono");
    expect(html).not.toContain("Aprovar os 2 pedidos sem dono");

    expect(await pendentesQueAprovamSozinhos()).toEqual([
      { id: pedidoIsabela.id, empresaId: coffeelab.id, usuarioId: isabela.id },
    ]);

    expect(await aprovarPendentesSemDono(moderadora.id)).toEqual([pedidoIsabela.id]);
    expect((await db.reivindicacao.findUniqueOrThrow({ where: { id: pedidoIsabela.id } })).status).toBe("aprovada");
    expect((await db.reivindicacao.findUniqueOrThrow({ where: { id: pedidoCristiane.id } })).status).toBe("pendente");
    expect((await db.reivindicacao.findUniqueOrThrow({ where: { id: pedidoCarlos.id } })).status).toBe("pendente");
    expect((await db.reivindicacao.findUniqueOrThrow({ where: { id: pedidoAna.id } })).status).toBe("pendente");
  });

  it("remover o último dono de um perfil oculto grava oculta: false e status: indicada", async () => {
    const empresa = await criarEmpresa("coffeelab");
    const cristiane = await criarUsuario("Cristiane Oliveira");
    await assumir(empresa.id, cristiane.id);
    await db.empresa.update({ where: { id: empresa.id }, data: { oculta: true } });

    await removerDono({ empresaId: empresa.id, usuarioId: cristiane.id, moderadorId: moderadora.id, motivo: "Não é sócia" });

    const atualizada = await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } });
    expect(atualizada).toMatchObject({ status: "indicada", oculta: false });
  });

  it("remover um dono quando sobra outro não muda oculta", async () => {
    const empresa = await criarEmpresa("padaria");
    const ana = await criarUsuario("Ana");
    const bia = await criarUsuario("Bia");
    await assumir(empresa.id, ana.id);
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: bia.id } });
    await db.empresa.update({ where: { id: empresa.id }, data: { oculta: true } });

    const resultado = await removerDono({ empresaId: empresa.id, usuarioId: ana.id, moderadorId: moderadora.id, motivo: "Teste" });

    expect(resultado).toMatchObject({ removido: true, semDono: false });
    const atualizada = await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } });
    expect(atualizada).toMatchObject({ status: "verificada", oculta: true });
  });

  it("conta removida não vê 'passa a ser seu assim que você enviar' nem 'já tem dono', antes nem depois de enviar", async () => {
    const empresa = await criarEmpresa("coffeelab");
    const cristiane = await criarUsuario("Cristiane Oliveira");
    const visitanteComum = await criarUsuario("Visitante Comum");
    await assumir(empresa.id, cristiane.id);
    await removerDono({ empresaId: empresa.id, usuarioId: cristiane.id, moderadorId: moderadora.id, motivo: "Não é sócia" });

    // Mais de 5 solicitações canceladas recentes para garantir que o take: 5 do histórico não esconda a revogada.
    for (let i = 0; i < 6; i++) {
      await db.reivindicacao.create({
        data: {
          empresaId: empresa.id,
          usuarioId: cristiane.id,
          metodo: "documento",
          status: "cancelada",
          expiraEm: new Date(Date.now() + 86_400_000),
        },
      });
    }

    // Controle: pessoa comum num negócio sem dono ainda vê a promessa de aprovação imediata.
    Object.assign(sessao, {
      id: visitanteComum.id,
      nome: visitanteComum.nome,
      email: visitanteComum.email,
      moderador: false,
      emailConfirmado: true,
    });
    const htmlComum = await renderizarPagina(
      <PaginaReivindicar params={Promise.resolve({ usuario: "coffeelab" })} searchParams={Promise.resolve({})} />,
    );
    expect(htmlComum).toContain("Como ninguém assumiu este perfil ainda, ele passa a ser seu assim que você enviar.");

    // Antes do envio: conta removida vê texto neutro, sem promessa de aprovação imediata e sem dizer que já tem dono.
    Object.assign(sessao, {
      id: cristiane.id,
      nome: cristiane.nome,
      email: cristiane.email,
      moderador: false,
      emailConfirmado: true,
    });
    const htmlAntes = await renderizarPagina(
      <PaginaReivindicar params={Promise.resolve({ usuario: "coffeelab" })} searchParams={Promise.resolve({})} />,
    );
    expect(htmlAntes).toContain("A moderação analisa o pedido e decide. O resultado aparece no seu painel.");
    expect(htmlAntes).not.toContain("passa a ser seu assim que você enviar");
    expect(htmlAntes).not.toContain("já tem dono");

    // Envio pela Server Action real: redireciona para aviso neutro (documento_em_analise), não documento_enviado.
    let destino = "";
    try {
      await enviarDocumento(undefined, formDe({ empresaId: empresa.id, relacao: "Sou a sócia", mensagem: "" }));
    } catch (erro) {
      destino = erro instanceof Error ? erro.message : String(erro);
    }
    expect(destino).toBe("REDIRECIONAR:/empresas/coffeelab/reivindicar?aviso=documento_em_analise");

    const htmlDepois = await renderizarPagina(
      <PaginaReivindicar
        params={Promise.resolve({ usuario: "coffeelab" })}
        searchParams={Promise.resolve({ aviso: "documento_em_analise" })}
      />,
    );
    expect(htmlDepois).toContain("Recebemos seus dados. A moderação analisa o pedido e pode falar com você pelo contato informado.");
    expect(htmlDepois).not.toContain("passa a ser seu assim que você enviar");
    expect(htmlDepois).not.toContain("já tem dono");

    // Controle: disputa em negócio que já tem dono continua usando documento_enviado ("Como este perfil já tem dono").
    const comDono = await criarEmpresa("padaria");
    const donaAtual = await criarUsuario("Dona Atual");
    await assumir(comDono.id, donaAtual.id);
    Object.assign(sessao, {
      id: visitanteComum.id,
      nome: visitanteComum.nome,
      email: visitanteComum.email,
      moderador: false,
      emailConfirmado: true,
    });
    let destinoDisputa = "";
    try {
      await enviarDocumento(undefined, formDe({ empresaId: comDono.id, relacao: "Também sou sócia", mensagem: "" }));
    } catch (erro) {
      destinoDisputa = erro instanceof Error ? erro.message : String(erro);
    }
    expect(destinoDisputa).toBe("REDIRECIONAR:/empresas/padaria/reivindicar?aviso=documento_enviado");
  });
});
