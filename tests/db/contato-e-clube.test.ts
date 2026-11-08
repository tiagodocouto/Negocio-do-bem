import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

// A edição do perfil roda fora do Next: o redirect vira um erro, e a sessão é a conta do teste.
const identidade = vi.hoisted(() => ({ id: "", nome: "Dora Dona", email: "dora@exemplo.com", moderador: true, emailConfirmado: true }));
vi.mock("@/lib/auth/sessao", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("@/lib/auth/sessao")>()),
  exigirUsuario: vi.fn(async () => identidade),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECIONAR:${destino}`);
  },
}));
vi.mock("next/server", () => ({ after: vi.fn() }));

const { salvarEmpresa } = await import("@/acoes/empresas");

let empresaId: string;
let donaId: string;

function edicao(whatsapp: string) {
  const dados = new FormData();
  for (const [campo, valor] of Object.entries({
    empresaId,
    nome: "Padaria Flor",
    categoria: "Café e padaria",
    municipio: "Recife, PE",
    resumo: "Um negócio do bem em Recife",
    historia: "",
    site: "",
    whatsapp,
    emailContato: "",
    telefoneComercial: "",
  })) {
    dados.set(campo, valor);
  }
  return dados;
}

async function salvar(whatsapp: string) {
  await expect(salvarEmpresa(undefined, edicao(whatsapp))).rejects.toThrow("REDIRECIONAR:");
}

const situacao = async () => ({
  liberacao: (await db.liberacaoClube.findFirstOrThrow()).status,
  oferta: (await db.oferta.findFirstOrThrow()).status,
});

beforeEach(async () => {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Cupom", "Oferta", "LiberacaoClube", "EmpresaMembro", "EmpresaCausa", "Empresa", "Usuario" CASCADE`,
  );
  const dona = await db.usuario.create({ data: { nome: identidade.nome, email: identidade.email, papel: "moderador" } });
  donaId = dona.id;
  identidade.id = dona.id;
  const empresa = await db.empresa.create({
    data: {
      instagramUsername: "padaria.flor",
      nome: "Padaria Flor",
      resumo: "Um negócio do bem em Recife",
      categoria: "Café e padaria",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      whatsapp: "5581999998888",
      membros: { create: { usuarioId: dona.id } },
      liberacoesClube: { create: { usuarioId: dona.id, cnpj: "11222333000181" } },
      ofertas: { create: { titulo: "15% em tudo", tipo: "percentual", valor: 15, ondeVale: "local", fim: new Date(Date.now() + 86_400_000) } },
    },
  });
  empresaId = empresa.id;
});
afterAll(async () => {
  await db.$disconnect();
});

describe("contato do perfil e Clube do Bem", () => {
  it("o dono troca o WhatsApp: a liberação e a oferta ficam suspensas, como Sistema na auditoria", async () => {
    await salvar("(81) 91111-2222");

    expect(await situacao()).toEqual({ liberacao: "suspensa", oferta: "suspensa" });
    expect(await db.registroAuditoria.findFirst({ where: { acao: "clube.suspenso" } })).toMatchObject({ usuarioId: null });
  });

  it("salvar sem mudar o contato não mexe no clube", async () => {
    await salvar("(81) 99999-8888");

    expect(await situacao()).toEqual({ liberacao: "liberada", oferta: "ativa" });
  });

  it("a moderação troca o contato sem suspender o clube", async () => {
    await db.empresaMembro.deleteMany({ where: { usuarioId: donaId } });

    await salvar("(81) 91111-2222");

    expect(await situacao()).toEqual({ liberacao: "liberada", oferta: "ativa" });
  });
});
