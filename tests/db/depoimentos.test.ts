import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

// A Server Action roda fora do Next: o redirect vira um erro com o destino, a
// sessão devolve a conta que o teste escolher, e o aviso por e-mail (after) não roda.
const sessao = vi.hoisted(() => ({ usuario: { id: "", nome: "", email: "", moderador: false, emailConfirmado: true } }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirect:${destino}`);
  },
}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao.usuario }));

const { denunciarDepoimento } = await import("@/acoes/depoimentos");

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

function entrarComo(usuario: { id: string; nome: string; email: string }) {
  sessao.usuario = { ...usuario, moderador: false, emailConfirmado: true };
}

function formulario(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

let autora: { id: string; nome: string; email: string };
let leitor: { id: string; nome: string; email: string };
let depoimentoId: string;

beforeEach(async () => {
  await limparBanco();
  autora = await db.usuario.create({ data: { nome: "Ana Autora", email: "ana@exemplo.com", senhaHash: "scrypt$segredo" } });
  leitor = await db.usuario.create({ data: { nome: "Lauro Leitor", email: "lauro@exemplo.com", senhaHash: "scrypt$segredo" } });
  const empresa = await db.empresa.create({
    data: {
      instagramUsername: "padaria.flor",
      nome: "Padaria Flor",
      resumo: "Um negócio do bem",
      categoria: "Serviços",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
    },
  });
  const depoimento = await db.depoimento.create({
    data: { empresaId: empresa.id, autorId: autora.id, texto: "Pão quentinho e gente boa." },
  });
  depoimentoId = depoimento.id;
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("denunciar depoimento", () => {
  it("a autora não denuncia o próprio depoimento, mesmo chamando a ação direto", async () => {
    entrarComo(autora);

    await expect(denunciarDepoimento(formulario({ depoimentoId, motivo: "Quero apagar" }))).rejects.toThrow(
      "redirect:/empresas/padaria.flor#depoimentos",
    );

    expect(await db.depoimento.findUniqueOrThrow({ where: { id: depoimentoId } })).toMatchObject({
      denunciado: false,
      motivoDenuncia: null,
      denunciadoPorId: null,
    });
  });

  it("outra pessoa logada denuncia normalmente", async () => {
    entrarComo(leitor);

    await expect(denunciarDepoimento(formulario({ depoimentoId, motivo: "Ofensivo" }))).rejects.toThrow(
      "redirect:/empresas/padaria.flor?aviso=denuncia_enviada#depoimentos",
    );

    expect(await db.depoimento.findUniqueOrThrow({ where: { id: depoimentoId } })).toMatchObject({
      denunciado: true,
      motivoDenuncia: "Ofensivo",
      denunciadoPorId: leitor.id,
    });
  });
});
