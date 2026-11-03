import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

// A sessão e o redirecionamento dependem do Next. Aqui o usuário é fixo
// e o redirecionamento vira uma exceção, como na Server Action de verdade.
const sessao = vi.hoisted(() => ({ usuario: null as { id: string; nome: string; email: string; moderador: boolean; emailConfirmado: boolean } | null }));

class Redirecionou extends Error {}

vi.mock("@/lib/auth/sessao", () => ({
  exigirUsuario: async () => sessao.usuario,
  caminhoSeguro: (valor: unknown, padrao = "/") => (typeof valor === "string" ? valor : padrao),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Redirecionou(destino);
  },
}));
// O after() roda na hora, e a foto do Instagram só fica registrada (a Meta não é chamada).
vi.mock("next/server", () => ({ after: (tarefa: () => unknown) => tarefa() }));
const fotos = vi.hoisted(() => ({ pedidas: [] as [string, string][] }));
vi.mock("@/lib/fotos-instagram", () => ({
  gravarFotoDaPrevia: async (empresaId: string, username: string) => {
    fotos.pedidas.push([empresaId, username]);
  },
}));

const { indicarEmpresa } = await import("@/acoes/empresas");

const LIMITE = 10;
const DIA = 24 * 60 * 60 * 1000;

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

let contador = 0;
async function criarUsuarioLogado() {
  contador++;
  const usuario = await db.usuario.create({
    data: { nome: "Pessoa", email: `indicadora${contador}@exemplo.com`, senhaHash: "x" },
  });
  sessao.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, moderador: false, emailConfirmado: true };
  return usuario;
}

async function indicacoesAnteriores(usuarioId: string, quantas: number, criadoEm = new Date()) {
  for (let i = 0; i < quantas; i++) {
    await db.empresa.create({
      data: {
        instagramUsername: `antiga.${usuarioId.slice(-8)}.${i}`,
        nome: `Antiga ${i}`,
        resumo: "Um negócio do bem",
        categoria: "Serviços",
        cidade: "Recife",
        uf: "PE",
        moderacao: "aprovada",
        indicadaPorId: usuarioId,
        criadoEm,
      },
    });
  }
}

function formulario(instagram: string) {
  const dados = new FormData();
  dados.set("instagram", instagram);
  dados.set("nome", `Negócio ${instagram}`);
  dados.set("categoria", "Alimentação");
  dados.set("municipio", "Recife, PE");
  dados.set("resumo", "Um negócio do bem do bairro");
  return dados;
}

/** Envia uma indicação e diz como ela terminou: publicada (redirect) ou o estado devolvido. */
async function indicar(instagram: string) {
  try {
    const estado = await indicarEmpresa({}, formulario(instagram));
    return { publicada: false as const, estado: estado ?? {} };
  } catch (erro) {
    if (erro instanceof Redirecionou) return { publicada: true as const };
    throw erro;
  }
}

const publicadas = (resultados: Awaited<ReturnType<typeof indicar>>[]) => resultados.filter((r) => r.publicada).length;

beforeEach(async () => {
  fotos.pedidas = [];
  await limparBanco();
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("cota diária de indicações", () => {
  it("em série, recusa a indicação depois da décima", async () => {
    const usuario = await criarUsuarioLogado();
    await indicacoesAnteriores(usuario.id, LIMITE - 1);

    const primeira = await indicar("nova.um");
    const segunda = await indicar("nova.dois");

    expect(primeira.publicada).toBe(true);
    expect(segunda.publicada).toBe(false);
    if (!segunda.publicada) expect(segunda.estado.erro).toMatch(/muitas indicações hoje/);
    expect(await db.empresa.count({ where: { indicadaPorId: usuario.id } })).toBe(LIMITE);
  });

  it("não conta indicações de mais de 24 horas", async () => {
    const usuario = await criarUsuarioLogado();
    await indicacoesAnteriores(usuario.id, LIMITE, new Date(Date.now() - DIA - 60_000));

    const resultado = await indicar("nova.depois.do.dia");

    expect(resultado.publicada).toBe(true);
  });

  it("com envios simultâneos e usernames diferentes, nunca passa de dez em 24 horas", async () => {
    // A corrida é por tempo: repete com contas novas para a falha não depender da sorte.
    for (let rodada = 0; rodada < 4; rodada++) {
      const usuario = await criarUsuarioLogado();
      await indicacoesAnteriores(usuario.id, LIMITE - 1);

      const resultados = await Promise.all(Array.from({ length: 8 }, (_, i) => indicar(`disputa.${rodada}.n${i}`)));

      expect(publicadas(resultados), `rodada ${rodada}`).toBe(1);
      expect(await db.empresa.count({ where: { indicadaPorId: usuario.id } }), `rodada ${rodada}`).toBe(LIMITE);
      expect(
        await db.registroAuditoria.count({ where: { usuarioId: usuario.id, acao: "empresa.indicada" } }),
        `rodada ${rodada}`,
      ).toBe(1);
    }
  });

  it("com a conta vazia e envios simultâneos, publica exatamente dez", async () => {
    const usuario = await criarUsuarioLogado();

    const resultados = await Promise.all(Array.from({ length: 10 }, (_, i) => indicar(`vazia.n${i}`)));
    const mais = await Promise.all(Array.from({ length: 6 }, (_, i) => indicar(`vazia.extra${i}`)));

    expect(publicadas(resultados)).toBe(LIMITE);
    expect(publicadas(mais)).toBe(0);
    expect(await db.empresa.count({ where: { indicadaPorId: usuario.id } })).toBe(LIMITE);
  });
});

describe("falha na auditoria da indicação", () => {
  it("propaga P2002 da auditoria e desfaz o negócio sem consumir a cota", async () => {
    const usuario = await criarUsuarioLogado();
    await indicacoesAnteriores(usuario.id, LIMITE - 1);
    const registro = await db.registroAuditoria.create({
      data: { id: "auditoria-repetida", usuarioId: usuario.id, acao: "teste", alvoTipo: "usuario", alvoId: usuario.id },
    });

    await db.$executeRawUnsafe(`
      CREATE FUNCTION "repetirIdAuditoriaIndicacaoTeste"() RETURNS trigger AS $$
      BEGIN
        IF NEW.acao = 'empresa.indicada' THEN
          NEW.id := 'auditoria-repetida';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    try {
      await db.$executeRawUnsafe(`
        CREATE TRIGGER "repetirIdAuditoriaIndicacaoTeste"
        BEFORE INSERT ON "RegistroAuditoria"
        FOR EACH ROW EXECUTE FUNCTION "repetirIdAuditoriaIndicacaoTeste"()
      `);
      const dados = formulario("auditoria.falha");
      dados.append("causas", "negocio-de-bairro");
      const [resultado] = await Promise.allSettled([indicarEmpresa({}, dados)]);

      expect(await db.empresa.findUnique({ where: { instagramUsername: "auditoria.falha" } })).toBeNull();
      expect(await db.empresaCausa.count()).toBe(0);
      expect(await db.empresa.count({ where: { indicadaPorId: usuario.id } })).toBe(LIMITE - 1);
      expect(await db.registroAuditoria.findMany()).toEqual([registro]);
      expect(resultado).toMatchObject({ status: "rejected", reason: { code: "P2002" } });
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS "repetirIdAuditoriaIndicacaoTeste" ON "RegistroAuditoria"');
      await db.$executeRawUnsafe('DROP FUNCTION "repetirIdAuditoriaIndicacaoTeste"()');
    }

    expect((await indicar("auditoria.falha")).publicada).toBe(true);
    expect(await db.empresa.count({ where: { indicadaPorId: usuario.id } })).toBe(LIMITE);
    expect(await db.registroAuditoria.count({ where: { usuarioId: usuario.id, acao: "empresa.indicada" } })).toBe(1);
  });
});

describe("indicação do mesmo username ao mesmo tempo", () => {
  it("publica uma vez e avisa a outra pessoa que o negócio já existe", async () => {
    await criarUsuarioLogado();

    const resultados = await Promise.all(Array.from({ length: 4 }, () => indicar("mesmo.username")));

    expect(publicadas(resultados)).toBe(1);
    for (const r of resultados) {
      if (!r.publicada) expect(r.estado.erros?.instagram).toMatch(/já está no Negócio do Bem/);
    }
    expect(await db.empresa.count({ where: { instagramUsername: "mesmo.username" } })).toBe(1);
  });
});

/** Envia um formulário montado à mão e diz para onde a pessoa foi, ou o estado devolvido. */
async function enviar(dados: FormData) {
  try {
    return { estado: (await indicarEmpresa({}, dados)) ?? {}, destino: null };
  } catch (erro) {
    if (erro instanceof Redirecionou) return { estado: null, destino: erro.message };
    throw erro;
  }
}

function contatosCompletos(dados: FormData) {
  dados.set("telefoneComercial", "(81) 3333-4444");
  dados.set("whatsapp", "(81) 98888-7777");
  dados.set("site", "padaria.com.br");
  dados.set("emailContato", "ola@padaria.com.br");
  dados.set("emailDoDono", "Ana@Exemplo.com");
  dados.set("telefoneDoDono", "81 99999-0000");
  return dados;
}

describe("cadastro do próprio negócio", () => {
  it("pede o telefone comercial e o e-mail e o telefone de contato do dono", async () => {
    await criarUsuarioLogado();
    const dados = formulario("dono.sem.contato");
    dados.set("souDono", "sim");

    const { estado } = await enviar(dados);

    expect(estado?.erros).toMatchObject({
      telefoneComercial: expect.any(String),
      emailDoDono: expect.any(String),
      telefoneDoDono: expect.any(String),
    });
    expect(await db.empresa.count()).toBe(0);
  });

  it("grava os contatos do negócio e do dono, e leva para a confirmação", async () => {
    await criarUsuarioLogado();
    const dados = contatosCompletos(formulario("dono.completo"));
    dados.set("souDono", "sim");

    const { destino } = await enviar(dados);

    expect(destino).toBe("/empresas/dono.completo/reivindicar");
    expect(await db.empresa.findUnique({ where: { instagramUsername: "dono.completo" } })).toMatchObject({
      telefoneComercial: "558133334444",
      whatsapp: "5581988887777",
      site: "https://padaria.com.br/",
      emailContato: "ola@padaria.com.br",
      emailDoDono: "ana@exemplo.com",
      telefoneDoDono: "5581999990000",
    });
  });

  it("quem indica não grava contatos, mesmo que mande", async () => {
    await criarUsuarioLogado();

    const { destino } = await enviar(contatosCompletos(formulario("indicada.com.contato")));

    expect(destino).toBe("/empresas/indicada.com.contato?aviso=indicada");
    expect(await db.empresa.findUnique({ where: { instagramUsername: "indicada.com.contato" } })).toMatchObject({
      telefoneComercial: null,
      whatsapp: null,
      site: null,
      emailContato: null,
      emailDoDono: null,
      telefoneDoDono: null,
    });
  });
});

describe("foto do Instagram no cadastro", () => {
  it("pede a foto da prévia do @ depois de criar o negócio", async () => {
    await criarUsuarioLogado();

    await enviar(formulario("com.foto"));

    const empresa = await db.empresa.findUniqueOrThrow({ where: { instagramUsername: "com.foto" } });
    expect(fotos.pedidas).toEqual([[empresa.id, "com.foto"]]);
  });
});

describe("cadastro sem Instagram", () => {
  function semInstagram(nome: string) {
    const dados = formulario("");
    dados.set("semInstagram", "sim");
    dados.set("nome", nome);
    return dados;
  }

  it("cria o negócio com o endereço feito do nome e da cidade", async () => {
    await criarUsuarioLogado();

    const { destino } = await enviar(semInstagram("Padaria do Bairro"));

    expect(destino).toBe("/empresas/padaria-do-bairro-recife?aviso=indicada");
    expect(await db.empresa.findUnique({ where: { instagramUsername: "padaria-do-bairro-recife" } })).toMatchObject({
      nome: "Padaria do Bairro",
      cidade: "Recife",
    });
    expect(fotos.pedidas).toEqual([]);
  });

  it("não repete o endereço de outro negócio", async () => {
    await criarUsuarioLogado();

    await enviar(semInstagram("Padaria do Bairro"));
    const { destino } = await enviar(semInstagram("Padaria do Bairro"));

    expect(destino).toBe("/empresas/padaria-do-bairro-recife-2?aviso=indicada");
  });

  it("o dono sem Instagram também informa os contatos", async () => {
    await criarUsuarioLogado();
    const dados = contatosCompletos(semInstagram("Ateliê da Ana"));
    dados.set("souDono", "sim");

    const { destino } = await enviar(dados);

    expect(destino).toBe("/empresas/atelie-da-ana-recife/reivindicar");
  });

  it("sem marcar \"sem Instagram\", o @ continua obrigatório", async () => {
    await criarUsuarioLogado();

    const { estado } = await enviar(formulario(""));

    expect(estado?.erros?.instagram).toMatch(/Digite o @/);
  });
});
