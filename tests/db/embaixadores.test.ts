import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apagarFoto } from "@/lib/armazenamento";
import { db } from "@/lib/db";
import { atualizarPeloInstagram, atualizarSeguidoresDoDia, embaixadorDoEndereco, embaixadoresNoSite } from "@/lib/embaixadores";
import { esquecerPrevias } from "@/lib/previa-instagram";

const AGORA = new Date("2026-11-02T12:00:00Z");
const ONTEM = new Date("2026-11-01T11:00:00Z");
const HOJE_CEDO = new Date("2026-11-02T07:00:00Z");
const FOTO = "https://scontent.cdninstagram.com/v/foto.webp";
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "RegistroAuditoria", "Embaixador", "Empresa" CASCADE`);
}

function criarEmbaixador(username: string, extra: Partial<Parameters<typeof db.embaixador.create>[0]["data"]> = {}) {
  return db.embaixador.create({ data: { instagramUsername: username, nome: `Pessoa ${username}`, cidade: "Recife", uf: "PE", ...extra } });
}

/** A Meta de mentira: responde os seguidores de cada @, a foto e a bio. Sem o @ na lista, a conta "é pessoal". */
function metaCom(seguidores: Record<string, number>, foto = false, bio?: string) {
  const fetch = vi.fn(async (url: URL | string) => {
    const endereco = String(url);
    if (!endereco.startsWith("https://graph.facebook.com/")) {
      return new Response(WEBP, { status: 200, headers: { "content-type": "image/webp" } });
    }
    const username = /username\(([^)]+)\)/.exec(decodeURIComponent(new URL(endereco).searchParams.get("fields") ?? ""))?.[1] ?? "";
    if (!(username in seguidores)) return Response.json({ error: { code: 110 } }, { status: 400 });
    return Response.json({
      business_discovery: { name: username, followers_count: seguidores[username], ...(foto && { profile_picture_url: FOTO }), ...(bio && { biography: bio }) },
    });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(async () => {
  await limparBanco();
  esquecerPrevias();
  vi.stubEnv("META_ACCESS_TOKEN", "token-de-teste");
  vi.stubEnv("META_IG_USER_ID", "17841400000000000");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  // Sem domínio R2 configurado, as fotos gravadas nos testes vão para public/enviados: apaga depois.
  const comFoto = await db.embaixador.findMany({ where: { fotoUrl: { startsWith: "/enviados/perfis/" } }, select: { fotoUrl: true } });
  await Promise.all(comFoto.filter((e) => /^\/enviados\/perfis\/[0-9a-f]{24}\.webp$/.test(e.fotoUrl ?? "")).map((e) => apagarFoto(e.fotoUrl)));
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("consulta diária ao Instagram", () => {
  it("atualiza os seguidores de quem não foi consultado nas últimas 24 horas", async () => {
    const nunca = await criarEmbaixador("nunca.consultada");
    const ontem = await criarEmbaixador("consultada.ontem", { consultadoEm: ONTEM, seguidores: 100, seguidoresEm: ONTEM });
    const hoje = await criarEmbaixador("consultada.hoje", { consultadoEm: HOJE_CEDO, seguidores: 100, seguidoresEm: HOJE_CEDO });
    metaCom({ "nunca.consultada": 48231, "consultada.ontem": 900, "consultada.hoje": 5 });

    expect(await atualizarSeguidoresDoDia(AGORA)).toBe(2);

    expect(await db.embaixador.findUniqueOrThrow({ where: { id: nunca.id } })).toMatchObject({ seguidores: 48231, seguidoresEm: AGORA, consultadoEm: AGORA });
    expect(await db.embaixador.findUniqueOrThrow({ where: { id: ontem.id } })).toMatchObject({ seguidores: 900 });
    expect(await db.embaixador.findUniqueOrThrow({ where: { id: hoje.id } })).toMatchObject({ seguidores: 100, consultadoEm: HOJE_CEDO });
  });

  it("não consulta quem está fora do site nem quem tem o número digitado à mão", async () => {
    await criarEmbaixador("fora.do.site", { ativo: false });
    await criarEmbaixador("numero.a.mao", { seguidoresManual: true, seguidores: 7000 });
    const fetch = metaCom({ "fora.do.site": 1, "numero.a.mao": 1 });

    expect(await atualizarSeguidoresDoDia(AGORA)).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("conta pessoal: marca a consulta e só tenta de novo no dia seguinte", async () => {
    const pessoal = await criarEmbaixador("conta.pessoal");
    const fetch = metaCom({});

    expect(await atualizarSeguidoresDoDia(AGORA)).toBe(0);
    expect(await atualizarSeguidoresDoDia(new Date(AGORA.getTime() + 60_000))).toBe(0);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await db.embaixador.findUniqueOrThrow({ where: { id: pessoal.id } })).toMatchObject({ seguidores: null, consultadoEm: AGORA });
  });

  it("duas visitas ao mesmo tempo consultam cada @ uma vez só", async () => {
    await criarEmbaixador("visitada.ao.mesmo.tempo");
    const fetch = metaCom({ "visitada.ao.mesmo.tempo": 10 });

    await Promise.all([atualizarSeguidoresDoDia(AGORA), atualizarSeguidoresDoDia(AGORA)]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("sem as variáveis da Meta, não faz nada", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "");
    const embaixador = await criarEmbaixador("sem.meta");

    expect(await atualizarSeguidoresDoDia(AGORA)).toBe(0);
    expect(await db.embaixador.findUniqueOrThrow({ where: { id: embaixador.id } })).toMatchObject({ consultadoEm: null });
  });
});

describe("atualizarPeloInstagram", () => {
  it("coloca a foto do Instagram em quem está sem, e registra como sistema", async () => {
    const embaixador = await criarEmbaixador("sem.foto");
    metaCom({ "sem.foto": 10 }, true);

    expect(await atualizarPeloInstagram(embaixador.id, AGORA)).toBe("atualizado");

    const gravado = await db.embaixador.findUniqueOrThrow({ where: { id: embaixador.id } });
    expect(gravado.fotoUrl).toMatch(/^\/enviados\/perfis\/[0-9a-f]{24}\.webp$/);
    expect(await db.registroAuditoria.findFirst({ where: { alvoId: embaixador.id } })).toMatchObject({
      usuarioId: null,
      acao: "embaixador.foto_do_instagram",
      alvoTipo: "embaixador",
    });
  });

  it("nunca troca a foto enviada pela moderação nem o número digitado à mão", async () => {
    const embaixador = await criarEmbaixador("com.foto", { fotoUrl: "/enviados/perfis/da-moderacao.webp", seguidoresManual: true, seguidores: 7000 });
    metaCom({ "com.foto": 10 }, true);

    expect(await atualizarPeloInstagram(embaixador.id, AGORA)).toBe("atualizado");

    expect(await db.embaixador.findUniqueOrThrow({ where: { id: embaixador.id } })).toMatchObject({
      fotoUrl: "/enviados/perfis/da-moderacao.webp",
      seguidores: 7000,
      consultadoEm: AGORA,
    });
  });

  it("a pedido da moderação, a bio entra no Sobre vazio, e nunca no lugar do texto dela", async () => {
    const vazio = await criarEmbaixador("sem.sobre");
    const escrito = await criarEmbaixador("com.sobre", { sobre: "Texto da moderação." });
    metaCom({ "sem.sobre": 10, "com.sobre": 10 }, false, "Clássicos e mitologia.");

    await atualizarPeloInstagram(vazio.id, AGORA, { comBio: true });
    await atualizarPeloInstagram(escrito.id, AGORA, { comBio: true });

    expect((await db.embaixador.findUniqueOrThrow({ where: { id: vazio.id } })).sobre).toBe("Clássicos e mitologia.");
    expect((await db.embaixador.findUniqueOrThrow({ where: { id: escrito.id } })).sobre).toBe("Texto da moderação.");
  });

  it("a consulta do dia não mexe no Sobre", async () => {
    const embaixador = await criarEmbaixador("do.dia");
    metaCom({ "do.dia": 10 }, false, "Bio do Instagram.");

    expect(await atualizarSeguidoresDoDia(AGORA)).toBe(1);

    expect(await db.embaixador.findUniqueOrThrow({ where: { id: embaixador.id } })).toMatchObject({ seguidores: 10, sobre: null });
  });
});

describe("embaixadoresNoSite", () => {
  it("mostra só quem está no site, na ordem da moderação e depois pelo nome", async () => {
    await criarEmbaixador("terceira", { nome: "Carla", ordem: 2 });
    await criarEmbaixador("segunda", { nome: "Bruna", ordem: 1 });
    await criarEmbaixador("primeira", { nome: "Ana", ordem: 1 });
    await criarEmbaixador("escondida", { nome: "Aaron", ordem: 0, ativo: false });

    expect((await embaixadoresNoSite()).map((e) => e.instagramUsername)).toEqual(["primeira", "segunda", "terceira"]);
  });

  it("formata os seguidores e não mostra foto de fora do site", async () => {
    await criarEmbaixador("formatada", { seguidores: 48231, fotoUrl: "https://exemplo.com/foto.jpg" });

    const [embaixador] = await embaixadoresNoSite();

    expect(embaixador).toMatchObject({ seguidores: "48,2 mil", numeroDeSeguidores: 48231, fotoUrl: null, lugar: "Recife, PE" });
    expect(embaixador?.destino).toEqual({ href: "/participar", detalhe: "Indique o primeiro negócio" });
    expect(embaixador?.href).toBe("/embaixadores/formatada");
  });
});

describe("embaixadorDoEndereco", () => {
  it("acha a página pelo @, com maiúsculas ou \"@\", só de quem está no site", async () => {
    await criarEmbaixador("alodiario_literario", { sobre: "Clássicos e mitologia." });
    await criarEmbaixador("fora.do.site", { ativo: false });

    expect(await embaixadorDoEndereco("alodiario_literario")).toMatchObject({ instagramUsername: "alodiario_literario", sobre: "Clássicos e mitologia." });
    expect(await embaixadorDoEndereco("@Alodiario_Literario")).toMatchObject({ instagramUsername: "alodiario_literario" });
    expect(await embaixadorDoEndereco("fora.do.site")).toBeNull();
    expect(await embaixadorDoEndereco("ninguem")).toBeNull();
    expect(await embaixadorDoEndereco("não é @")).toBeNull();
  });
});
