import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { apagarFoto } from "@/lib/armazenamento";
import { aprovarReivindicacao, decidirDenuncia, moderarEmpresa, publicarIndicacoesPendentes, recusarReivindicacao } from "@/acoes/moderacao";
import { alternarVisibilidade, indicarEmpresa, removerFoto, salvarEmpresa, trocarFoto } from "@/acoes/empresas";

const identidade = vi.hoisted(() => ({ id: "", nome: "Pessoa de teste", email: "pessoa@exemplo.com", moderador: true, emailConfirmado: true }));
const FOTO_ANTIGA = "/enviados/perfis/antiga.jpg";
const FOTO_NOVA = "/enviados/perfis/nova.jpg";

vi.mock("@/lib/auth/sessao", async (importarOriginal) => ({
  ...await importarOriginal<typeof import("@/lib/auth/sessao")>(),
  exigirUsuario: vi.fn(async () => identidade),
  exigirModerador: vi.fn(async () => identidade),
}));

vi.mock("next/navigation", () => ({
  redirect: (destino: string) => { throw new Error(`REDIRECIONAR:${destino}`); },
}));

// Mock the preview task that runs after the response to prevent requests to Meta.
vi.mock("next/server", () => ({ after: vi.fn() }));

vi.mock("@/lib/armazenamento", async (importarOriginal) => ({
  ...await importarOriginal<typeof import("@/lib/armazenamento")>(),
  guardarFoto: vi.fn(async () => FOTO_NOVA),
  apagarFoto: vi.fn(async () => {}),
}));

let empresaId: string;
let depoimentoId: string;
let reivindicacaoId: string;
let solicitanteId: string;

function formulario(campos: Record<string, string> = {}) {
  const dados = new FormData();
  for (const [campo, valor] of Object.entries({ empresaId, ...campos })) dados.set(campo, valor);
  return dados;
}

function edicao() {
  const dados = formulario({
    nome: "Nome atualizado",
    categoria: "Serviços",
    municipio: "Recife, PE",
    resumo: "Um resumo atualizado para o negócio",
    historia: "Uma história atualizada.",
    site: "",
    whatsapp: "",
    emailContato: "",
  });
  dados.append("causas", "escala-5x2");
  return dados;
}

function foto() {
  const dados = formulario();
  dados.set("foto", new File([new Uint8Array([0xff, 0xd8, 0xff])], "foto.jpg", { type: "image/jpeg" }));
  return dados;
}

async function limparBanco() {
  await db.$executeRawUnsafe('ALTER TABLE "RegistroAuditoria" DROP CONSTRAINT IF EXISTS "falha_auditoria_teste"');
  await db.$executeRawUnsafe(
    'TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE',
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await limparBanco();
  const pessoa = await db.usuario.create({ data: { nome: identidade.nome, email: identidade.email, senhaHash: "teste", papel: "moderador" } });
  identidade.id = pessoa.id;
  const autor = await db.usuario.create({ data: { nome: "Autor", email: "autor@exemplo.com", senhaHash: "teste" } });
  const empresa = await db.empresa.create({
    data: {
      instagramUsername: "negocio.teste",
      nome: "Nome original",
      resumo: "Um negócio da comunidade",
      categoria: "Serviços",
      cidade: "Recife",
      uf: "PE",
      historia: "História original.",
      fotoUrl: FOTO_ANTIGA,
      moderacao: "aprovada",
      membros: { create: { usuarioId: pessoa.id, papel: "dono" } },
      causas: { create: { causa: "pet-friendly" } },
    },
  });
  empresaId = empresa.id;
  solicitanteId = autor.id;
  const pedido = await db.reivindicacao.create({
    data: { empresaId, usuarioId: solicitanteId, metodo: "documento", expiraEm: new Date(Date.now() + 86_400_000) },
  });
  reivindicacaoId = pedido.id;
  const depoimento = await db.depoimento.create({
    data: { empresaId, autorId: autor.id, texto: "Um depoimento sobre o negócio.", denunciado: true, motivoDenuncia: "Motivo original", denunciadoPorId: pessoa.id },
  });
  depoimentoId = depoimento.id;
});

afterEach(async () => {
  await db.$executeRawUnsafe('ALTER TABLE "RegistroAuditoria" DROP CONSTRAINT IF EXISTS "falha_auditoria_teste"');
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

const casos = [
  {
    nome: "aprovação com transferência da reivindicação",
    acao: () => aprovarReivindicacao(formulario({ reivindicacaoId, modo: "transferir" })),
    registro: "reivindicacao.aprovada_com_transferencia",
    conferir: async (alterada: boolean) => {
      const pedido = await db.reivindicacao.findUniqueOrThrow({ where: { id: reivindicacaoId } });
      expect(pedido.status).toBe(alterada ? "aprovada" : "pendente");
      expect(pedido.revisadoPorId).toBe(alterada ? identidade.id : null);
      const empresa = await db.empresa.findUniqueOrThrow({ where: { id: empresaId }, include: { membros: true } });
      expect(empresa.status).toBe(alterada ? "verificada" : "indicada");
      expect(empresa.membros.map(({ usuarioId }) => usuarioId)).toEqual([alterada ? solicitanteId : identidade.id]);
    },
  },
  {
    nome: "recusa da reivindicação",
    acao: () => recusarReivindicacao(formulario({ reivindicacaoId, motivo: "Dados insuficientes" })),
    registro: "reivindicacao.recusada",
    conferir: async (alterada: boolean) => {
      const pedido = await db.reivindicacao.findUniqueOrThrow({ where: { id: reivindicacaoId } });
      expect(pedido.status).toBe(alterada ? "recusada" : "pendente");
      expect(pedido.motivoRecusa).toBe(alterada ? "Dados insuficientes" : null);
      expect(pedido.revisadoPorId).toBe(alterada ? identidade.id : null);
    },
  },
  {
    nome: "publicação da fila antiga",
    antes: () => db.empresa.update({ where: { id: empresaId }, data: { moderacao: "pendente" } }),
    acao: () => publicarIndicacoesPendentes(),
    registro: "empresa.aprovada",
    conferir: async (alterada: boolean) => {
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).moderacao).toBe(alterada ? "aprovada" : "pendente");
    },
  },
  {
    nome: "moderação do negócio",
    acao: () => moderarEmpresa(formulario({ decisao: "rejeitar", de: "aprovada" })),
    registro: "empresa.rejeitada",
    conferir: async (alterada: boolean) => {
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).moderacao).toBe(alterada ? "rejeitada" : "aprovada");
    },
  },
  {
    nome: "publicação do negócio",
    antes: () => db.empresa.update({ where: { id: empresaId }, data: { moderacao: "pendente" } }),
    acao: () => moderarEmpresa(formulario({ decisao: "aprovar", de: "pendente" })),
    registro: "empresa.aprovada",
    conferir: async (alterada: boolean) => {
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).moderacao).toBe(alterada ? "aprovada" : "pendente");
    },
  },
  {
    nome: "denúncia mantida no ar",
    acao: () => decidirDenuncia(formulario({ depoimentoId, decisao: "manter" })),
    registro: "depoimento.mantido",
    conferir: async (alterada: boolean) => {
      const depoimento = await db.depoimento.findUniqueOrThrow({ where: { id: depoimentoId } });
      expect(depoimento.status).toBe("publicado");
      expect(depoimento.denunciado).toBe(!alterada);
      expect(depoimento.motivoDenuncia).toBe(alterada ? null : "Motivo original");
    },
  },
  {
    nome: "decisão da denúncia",
    acao: () => decidirDenuncia(formulario({ depoimentoId, decisao: "remover" })),
    registro: "depoimento.removido",
    conferir: async (alterada: boolean) => {
      const depoimento = await db.depoimento.findUniqueOrThrow({ where: { id: depoimentoId } });
      expect(depoimento.status).toBe(alterada ? "removido" : "publicado");
      expect(depoimento.denunciado).toBe(!alterada);
      expect(depoimento.motivoDenuncia).toBe("Motivo original");
    },
  },
  {
    nome: "edição do perfil e das causas",
    acao: () => salvarEmpresa(undefined, edicao()),
    registro: "empresa.editada",
    conferir: async (alterada: boolean) => {
      const empresa = await db.empresa.findUniqueOrThrow({ where: { id: empresaId }, include: { causas: true } });
      expect(empresa.nome).toBe(alterada ? "Nome atualizado" : "Nome original");
      expect(empresa.historia).toBe(alterada ? "Uma história atualizada." : "História original.");
      expect(empresa.causas.map(({ causa }) => causa)).toEqual([alterada ? "escala-5x2" : "pet-friendly"]);
    },
  },
  {
    nome: "visibilidade do negócio",
    acao: () => alternarVisibilidade(formulario({ ocultar: "sim" })),
    registro: "empresa.ocultada",
    conferir: async (alterada: boolean) => {
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).oculta).toBe(alterada);
    },
  },
  {
    nome: "troca da foto",
    acao: () => trocarFoto(undefined, foto()),
    registro: "empresa.foto_trocada",
    conferir: async (alterada: boolean) => {
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).fotoUrl).toBe(alterada ? FOTO_NOVA : FOTO_ANTIGA);
      if (!alterada) expect(apagarFoto).not.toHaveBeenCalled();
    },
  },
  {
    nome: "remoção da foto",
    acao: () => removerFoto(formulario()),
    registro: "empresa.foto_removida",
    conferir: async (alterada: boolean) => {
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).fotoUrl).toBe(alterada ? null : FOTO_ANTIGA);
      if (!alterada) expect(apagarFoto).not.toHaveBeenCalled();
    },
  },
  {
    nome: "indicação do negócio",
    acao: () => {
      const dados = edicao();
      dados.set("instagram", "novo.negocio");
      return indicarEmpresa(undefined, dados);
    },
    registro: "empresa.indicada",
    conferir: async (alterada: boolean) => {
      expect(await db.empresa.count({ where: { instagramUsername: "novo.negocio" } })).toBe(alterada ? 1 : 0);
    },
  },
];

describe("alteração e auditoria na mesma transação", () => {
  it.each(casos)("desfaz $nome quando a auditoria falha", async ({ antes, acao, conferir }) => {
    await antes?.();
    await db.$executeRawUnsafe('ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "falha_auditoria_teste" CHECK (false)');

    const resultado = acao();
    await expect(resultado).rejects.toThrow();
    await expect(resultado).rejects.not.toThrow(/^REDIRECIONAR:/);

    await conferir(false);
    expect(await db.registroAuditoria.count()).toBe(0);
  });

  it.each(casos)("salva $nome e sua auditoria quando tudo funciona", async ({ antes, acao, conferir, registro }) => {
    await antes?.();
    await expect(acao()).rejects.toThrow(/^REDIRECIONAR:/);

    await conferir(true);
    expect(await db.registroAuditoria.count({ where: { acao: registro, usuarioId: identidade.id } })).toBe(1);
  });

  it.each([
    { nome: "trocar", acao: () => trocarFoto(undefined, foto()), url: FOTO_NOVA },
    { nome: "remover", acao: () => removerFoto(formulario()), url: null },
  ])("só apaga a foto antiga após confirmar o banco e a auditoria ao $nome", async ({ acao, url }) => {
    vi.mocked(apagarFoto).mockImplementationOnce(async () => {
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresaId } })).fotoUrl).toBe(url);
      expect(await db.registroAuditoria.count({ where: { alvoId: empresaId } })).toBe(1);
    });

    await expect(acao()).rejects.toThrow(/^REDIRECIONAR:/);
    expect(apagarFoto).toHaveBeenCalledExactlyOnceWith(FOTO_ANTIGA);
  });
});
