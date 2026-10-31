import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { denunciarDepoimento } from "@/acoes/depoimentos";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { after } from "next/server";

vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: vi.fn() }));
// O aviso por e-mail (after) não roda: o teste só conta quantas vezes ele foi agendado.
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string): never => {
    throw new Error(`redirecionamento:${destino}`);
  },
}));

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

async function criarCenario() {
  const [autor, primeiraPessoa, segundaPessoa] = await Promise.all(
    ["autor", "primeira", "segunda"].map((nome) =>
      db.usuario.create({ data: { nome, email: `${nome}@exemplo.com`, senhaHash: "nao-utilizada" } }),
    ),
  );
  const empresa = await db.empresa.create({
    data: {
      instagramUsername: "negocio.denuncia",
      nome: "Negócio da denúncia",
      resumo: "Um negócio para o teste de denúncia",
      categoria: "Serviços",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
    },
  });
  const depoimento = await db.depoimento.create({
    data: { empresaId: empresa.id, autorId: autor.id, texto: "Um relato da comunidade sobre o negócio." },
  });
  return { autor, primeiraPessoa, segundaPessoa, empresa, depoimento };
}

function dadosDaDenuncia(depoimentoId: string, motivo: string) {
  const dados = new FormData();
  dados.set("depoimentoId", depoimentoId);
  dados.set("motivo", motivo);
  return dados;
}

function autenticar(usuario: { id: string; nome: string; email: string }) {
  vi.mocked(exigirUsuario).mockResolvedValueOnce({ ...usuario, moderador: false, emailConfirmado: true });
}

beforeEach(async () => {
  vi.mocked(exigirUsuario).mockReset();
  vi.mocked(after).mockReset();
  await limparBanco();
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("denunciarDepoimento", () => {
  it("permite a denúncia de outra pessoa sem remover o depoimento", async () => {
    const { primeiraPessoa, empresa, depoimento } = await criarCenario();
    autenticar(primeiraPessoa);

    await expect(denunciarDepoimento(dadosDaDenuncia(depoimento.id, "  Conteúdo ofensivo  "))).rejects.toThrow(
      `redirecionamento:/empresas/${empresa.instagramUsername}?aviso=denuncia_enviada#depoimentos`,
    );

    expect(await db.depoimento.findUniqueOrThrow({ where: { id: depoimento.id } })).toMatchObject({
      denunciado: true,
      motivoDenuncia: "Conteúdo ofensivo",
      denunciadoPorId: primeiraPessoa.id,
      status: "publicado",
    });
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("mantém o motivo e a autoria da denúncia que já estava aberta", async () => {
    const { primeiraPessoa, segundaPessoa, empresa, depoimento } = await criarCenario();
    await db.depoimento.update({
      where: { id: depoimento.id },
      data: { denunciado: true, motivoDenuncia: "Primeiro motivo", denunciadoPorId: primeiraPessoa.id },
    });
    autenticar(segundaPessoa);

    // A segunda pessoa volta ao perfil com o mesmo aviso, mas nada é gravado.
    await expect(denunciarDepoimento(dadosDaDenuncia(depoimento.id, "Outro motivo"))).rejects.toThrow(
      `redirecionamento:/empresas/${empresa.instagramUsername}?aviso=denuncia_enviada#depoimentos`,
    );

    expect(await db.depoimento.findUniqueOrThrow({ where: { id: depoimento.id } })).toMatchObject({
      denunciado: true,
      motivoDenuncia: "Primeiro motivo",
      denunciadoPorId: primeiraPessoa.id,
    });
    expect(after).not.toHaveBeenCalled();
  });

  it("não denuncia um depoimento removido", async () => {
    const { primeiraPessoa, depoimento } = await criarCenario();
    await db.depoimento.update({ where: { id: depoimento.id }, data: { status: "removido" } });
    autenticar(primeiraPessoa);

    await expect(denunciarDepoimento(dadosDaDenuncia(depoimento.id, "Motivo"))).rejects.toThrow("redirecionamento:");

    expect(await db.depoimento.findUniqueOrThrow({ where: { id: depoimento.id } })).toMatchObject({
      status: "removido",
      denunciado: false,
      motivoDenuncia: null,
      denunciadoPorId: null,
    });
    expect(after).not.toHaveBeenCalled();
  });

  it("não denuncia um depoimento removido depois da leitura", async () => {
    const { primeiraPessoa, depoimento } = await criarCenario();
    vi.mocked(exigirUsuario).mockImplementationOnce(async () => {
      await db.depoimento.update({ where: { id: depoimento.id }, data: { status: "removido" } });
      return { ...primeiraPessoa, moderador: false, emailConfirmado: true };
    });

    await expect(denunciarDepoimento(dadosDaDenuncia(depoimento.id, "Motivo"))).rejects.toThrow("redirecionamento:");

    expect(await db.depoimento.findUniqueOrThrow({ where: { id: depoimento.id } })).toMatchObject({
      status: "removido",
      denunciado: false,
      motivoDenuncia: null,
      denunciadoPorId: null,
    });
    expect(after).not.toHaveBeenCalled();
  });

  it("não deixa uma leitura concorrente antiga substituir a primeira denúncia", async () => {
    const { primeiraPessoa, segundaPessoa, depoimento } = await criarCenario();
    // Este teste depende da ordem dentro da ação: ela lê o depoimento ANTES de chamar `exigirUsuario` e grava DEPOIS.
    // Se o login passar a ser checado antes da leitura, as duas leituras deixam de ser antigas e o teste passa sem provar nada.
    const primeiraLeu = Promise.withResolvers<void>();
    const ambasLeram = Promise.withResolvers<void>();
    const primeiraTerminou = Promise.withResolvers<void>();
    vi.mocked(exigirUsuario).mockImplementationOnce(async () => {
      primeiraLeu.resolve();
      await ambasLeram.promise;
      return { ...primeiraPessoa, moderador: false, emailConfirmado: true };
    });
    vi.mocked(exigirUsuario).mockImplementationOnce(async () => {
      ambasLeram.resolve();
      await primeiraTerminou.promise;
      return { ...segundaPessoa, moderador: false, emailConfirmado: true };
    });

    const primeira = denunciarDepoimento(dadosDaDenuncia(depoimento.id, "Primeiro motivo"));
    const primeiraConcluida = expect(primeira).rejects.toThrow("redirecionamento:");
    await primeiraLeu.promise;
    const segunda = denunciarDepoimento(dadosDaDenuncia(depoimento.id, "Outro motivo"));
    const segundaConcluida = expect(segunda).rejects.toThrow("redirecionamento:");
    try {
      await primeiraConcluida;
    } finally {
      primeiraTerminou.resolve();
    }
    await segundaConcluida;

    expect(exigirUsuario).toHaveBeenCalledTimes(2);
    // Só a denúncia gravada avisa a moderação.
    expect(after).toHaveBeenCalledTimes(1);
    expect(await db.depoimento.findUniqueOrThrow({ where: { id: depoimento.id } })).toMatchObject({
      denunciado: true,
      motivoDenuncia: "Primeiro motivo",
      denunciadoPorId: primeiraPessoa.id,
      status: "publicado",
    });
  });

  it.each([
    ["   ", "Sem motivo informado"],
    ["a".repeat(301), "a".repeat(300)],
  ])("preserva a validação do motivo: %j", async (motivo, esperado) => {
    const { primeiraPessoa, depoimento } = await criarCenario();
    autenticar(primeiraPessoa);

    await expect(denunciarDepoimento(dadosDaDenuncia(depoimento.id, motivo))).rejects.toThrow("redirecionamento:");

    expect((await db.depoimento.findUniqueOrThrow({ where: { id: depoimento.id } })).motivoDenuncia).toBe(esperado);
  });

  it("exige autenticação antes de registrar a denúncia", async () => {
    const { depoimento } = await criarCenario();
    vi.mocked(exigirUsuario).mockRejectedValueOnce(new Error("entrada necessária"));

    await expect(denunciarDepoimento(dadosDaDenuncia(depoimento.id, "Motivo"))).rejects.toThrow("entrada necessária");

    expect(await db.depoimento.findUniqueOrThrow({ where: { id: depoimento.id } })).toMatchObject({
      denunciado: false,
      motivoDenuncia: null,
      denunciadoPorId: null,
    });
  });
});
