import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apagarFoto, guardarFoto } from "@/lib/armazenamento";
import { db } from "@/lib/db";
import { aplicarFotoDoInstagram } from "@/lib/fotos-instagram";

vi.mock("@/lib/armazenamento", () => ({
  guardarFoto: vi.fn(),
  apagarFoto: vi.fn(),
}));

const FOTO_NOVA = "/enviados/perfis/importada.webp";
const FOTO_DONO = "/enviados/perfis/do-dono.webp";
const foto = () => ({ arquivo: new File([new Uint8Array([1])], "perfil.webp"), tipo: "image/webp" as const });

async function limparBanco() {
  await db.$executeRawUnsafe('ALTER TABLE "RegistroAuditoria" DROP CONSTRAINT IF EXISTS "falha_auditoria_foto_teste"');
  await db.$executeRawUnsafe(
    'TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE',
  );
}

function criarEmpresa(fotoUrl: string | null = null) {
  return db.empresa.create({
    data: {
      instagramUsername: "foto.auditoria",
      nome: "Negócio de teste",
      resumo: "Um negócio da comunidade",
      categoria: "Serviços",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      fotoUrl,
    },
  });
}

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.mocked(guardarFoto).mockReset().mockResolvedValue(FOTO_NOVA);
  vi.mocked(apagarFoto).mockReset().mockResolvedValue();
  await limparBanco();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.$executeRawUnsafe('ALTER TABLE "RegistroAuditoria" DROP CONSTRAINT IF EXISTS "falha_auditoria_foto_teste"');
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("foto importada e auditoria na mesma transação", () => {
  it("desfaz a gravação da foto quando o insert da auditoria falha", async () => {
    const empresa = await criarEmpresa();
    await db.$executeRawUnsafe('ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "falha_auditoria_foto_teste" CHECK (false)');

    await expect(aplicarFotoDoInstagram(empresa.id, foto())).rejects.toThrow();

    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).fotoUrl).toBeNull();
    expect(await db.registroAuditoria.count()).toBe(0);
    expect(apagarFoto).not.toHaveBeenCalled();
  });

  it("confirma a foto e a auditoria juntas quando tudo funciona", async () => {
    const empresa = await criarEmpresa();

    expect(await aplicarFotoDoInstagram(empresa.id, foto())).toBe("gravada");

    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).fotoUrl).toBe(FOTO_NOVA);
    expect(await db.registroAuditoria.findFirst({ where: { alvoId: empresa.id } })).toMatchObject({
      usuarioId: null,
      acao: "empresa.foto_do_instagram",
      detalhes: "@foto.auditoria",
    });
    expect(await db.registroAuditoria.count()).toBe(1);
    expect(apagarFoto).not.toHaveBeenCalled();
  });

  it("preserva a foto que o dono grava enquanto o upload está em andamento", async () => {
    const empresa = await criarEmpresa();
    vi.mocked(guardarFoto).mockImplementationOnce(async () => {
      await db.empresa.update({ where: { id: empresa.id }, data: { fotoUrl: FOTO_DONO } });
      return FOTO_NOVA;
    });
    vi.mocked(apagarFoto).mockImplementationOnce(async () => {
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).fotoUrl).toBe(FOTO_DONO);
      expect(await db.registroAuditoria.count()).toBe(0);
    });

    expect(await aplicarFotoDoInstagram(empresa.id, foto())).toBe("ja_tem_foto");

    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).fotoUrl).toBe(FOTO_DONO);
    expect(apagarFoto).toHaveBeenCalledExactlyOnceWith(FOTO_NOVA);
  });

  it("não envia nem apaga arquivos quando o negócio já tem foto", async () => {
    const empresa = await criarEmpresa(FOTO_DONO);

    expect(await aplicarFotoDoInstagram(empresa.id, foto())).toBe("ja_tem_foto");

    expect(guardarFoto).not.toHaveBeenCalled();
    expect(apagarFoto).not.toHaveBeenCalled();
    expect(await db.registroAuditoria.count()).toBe(0);
  });

  it("não apaga o objeto quando o resultado do commit é incerto", async () => {
    const empresa = await criarEmpresa();
    const transacaoOriginal = db.$transaction.bind(db);
    vi.spyOn(db, "$transaction").mockImplementationOnce(async (operacao) => {
      if (typeof operacao !== "function") throw new Error("O teste exige uma transação interativa.");
      await transacaoOriginal(operacao);
      throw new Error("Resultado do commit incerto.");
    });

    await expect(aplicarFotoDoInstagram(empresa.id, foto())).rejects.toThrow("Resultado do commit incerto.");

    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).fotoUrl).toBe(FOTO_NOVA);
    expect(await db.registroAuditoria.count()).toBe(1);
    expect(apagarFoto).not.toHaveBeenCalled();
  });
});
