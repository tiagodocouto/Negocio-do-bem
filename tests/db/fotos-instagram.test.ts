import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { apagarFoto } from "@/lib/armazenamento";
import { db } from "@/lib/db";
import { aplicarFotoDoInstagram, autorizado, negociosSemFoto } from "@/lib/fotos-instagram";

const WEBP = [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")];
const foto = () => ({ arquivo: new File([new Uint8Array(WEBP)], "perfil.webp", { type: "image/webp" }), tipo: "image/webp" as const });

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

function criarEmpresa(username: string, extra: Partial<{ fotoUrl: string; moderacao: string }> = {}) {
  return db.empresa.create({
    data: {
      instagramUsername: username,
      nome: `Negócio ${username}`,
      resumo: "Um negócio do bem",
      categoria: "Serviços",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      ...extra,
    },
  });
}

// Sem domínio R2 configurado, as fotos gravadas nos testes vão para public/enviados: apaga depois.
afterEach(async () => {
  const comFoto = await db.empresa.findMany({ where: { fotoUrl: { startsWith: "/enviados/" } }, select: { fotoUrl: true } });
  const gravadas = comFoto.filter((e) => /^\/enviados\/perfis\/[0-9a-f]{24}\.webp$/.test(e.fotoUrl ?? ""));
  await Promise.all(gravadas.map((e) => apagarFoto(e.fotoUrl)));
});
beforeEach(limparBanco);
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("fotos do Instagram", () => {
  it("lista só os negócios sem foto e que não foram tirados do ar", async () => {
    await criarEmpresa("sem.foto");
    await criarEmpresa("pendente.sem.foto", { moderacao: "pendente" });
    await criarEmpresa("com.foto", { fotoUrl: "/enviados/perfis/existente.webp" });
    await criarEmpresa("fora.do.ar", { moderacao: "rejeitada" });

    const usernames = (await negociosSemFoto()).map((e) => e.instagramUsername).sort();

    expect(usernames).toEqual(["pendente.sem.foto", "sem.foto"]);
  });

  it("grava a foto num negócio sem foto e registra como sistema", async () => {
    const empresa = await criarEmpresa("loja.sem.foto");

    expect(await aplicarFotoDoInstagram(empresa.id, foto())).toBe("gravada");

    const gravada = await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } });
    expect(gravada.fotoUrl).toMatch(/^\/enviados\/perfis\/[0-9a-f]+\.webp$/);
    expect(await db.registroAuditoria.findFirst({ where: { acao: "empresa.foto_do_instagram" } })).toMatchObject({
      usuarioId: null,
      alvoId: empresa.id,
      detalhes: "@loja.sem.foto",
    });
  });

  it("nunca troca a foto que o dono ou a moderação colocou", async () => {
    const empresa = await criarEmpresa("loja.com.foto", { fotoUrl: "/enviados/perfis/do-dono.webp" });

    expect(await aplicarFotoDoInstagram(empresa.id, foto())).toBe("ja_tem_foto");

    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).fotoUrl).toBe("/enviados/perfis/do-dono.webp");
    expect(await db.registroAuditoria.count()).toBe(0);
  });

  it("responde nao_encontrado para um negócio que não existe", async () => {
    expect(await aplicarFotoDoInstagram("nao-existe", foto())).toBe("nao_encontrado");
  });

  it("só aceita o token exato", () => {
    const token = "a".repeat(64);
    expect(autorizado(`Bearer ${token}`, token)).toBe(true);
    expect(autorizado(`Bearer ${"b".repeat(64)}`, token)).toBe(false);
    expect(autorizado(token, token)).toBe(false);
    expect(autorizado(null, token)).toBe(false);
  });
});
