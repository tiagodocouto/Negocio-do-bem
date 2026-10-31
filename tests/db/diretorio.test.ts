import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buscarDiretorio, cidadeDoSlug, cidadesCom, listarParaSitemap, resumoDoDiretorio } from "@/lib/consultas";
import { db } from "@/lib/db";
import { SEM_FILTROS, type FiltrosDiretorio } from "@/lib/diretorio";
import { textoDeBusca } from "@/lib/texto";

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

async function criarEmpresa(
  username: string,
  dados: { nome: string; categoria: string; cidade: string; uf: string; causas?: string[]; status?: string; moderacao?: string; oculta?: boolean },
) {
  const { causas = [], ...resto } = dados;
  const campos = { resumo: "Um negócio do bem", ...resto };
  return db.empresa.create({
    data: {
      instagramUsername: username,
      moderacao: "aprovada",
      ...campos,
      busca: textoDeBusca({ ...campos, instagramUsername: username }),
      causas: { create: causas.map((causa) => ({ causa })) },
    },
  });
}

const filtros = (mudanca: Partial<FiltrosDiretorio>): FiltrosDiretorio => ({ ...SEM_FILTROS, ...mudanca });

beforeEach(async () => {
  await limparBanco();
  await criarEmpresa("padaria.florescer", {
    nome: "Padaria Florescer",
    categoria: "Café e padaria",
    cidade: "Recife",
    uf: "PE",
    status: "verificada",
    causas: ["liderado-por-mulheres", "sustentavel"],
  });
  await criarEmpresa("cafe.arcoiris", { nome: "Café Arco-Íris", categoria: "Café e padaria", cidade: "São Paulo", uf: "SP", causas: ["sustentavel"] });
  await criarEmpresa("atelie.raiz", {
    nome: "Ateliê Raiz Preta",
    categoria: "Moda e acessórios",
    cidade: "Recife",
    uf: "PE",
    status: "verificada",
    causas: ["antirracista"],
  });
  // Fora do diretório: escondido pelo dono e tirado do ar pela moderação.
  await criarEmpresa("escondido", { nome: "Escondido", categoria: "Pet", cidade: "Recife", uf: "PE", oculta: true });
  await criarEmpresa("tirado", { nome: "Tirado do ar", categoria: "Pet", cidade: "Olinda", uf: "PE", moderacao: "rejeitada" });
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("resumoDoDiretorio", () => {
  it("conta só os negócios que aparecem no diretório", async () => {
    expect(await resumoDoDiretorio()).toEqual({
      total: 3,
      verificados: 2,
      cidades: 2,
      estados: 2,
      porCategoria: { "Café e padaria": 2, "Moda e acessórios": 1 },
    });
  });
});

describe("buscarDiretorio", () => {
  it("sem filtros, traz todos, os verificados primeiro, e as cidades para o Onde?", async () => {
    const r = await buscarDiretorio(SEM_FILTROS);
    expect(r.total).toBe(3);
    expect(r.itens.at(-1)!.instagramUsername).toBe("cafe.arcoiris");
    expect(r.cidades).toEqual([
      { cidade: "Recife", uf: "PE", total: 2 },
      { cidade: "São Paulo", uf: "SP", total: 1 },
    ]);
  });

  it("filtra por tipo e conta os outros tipos como se aquele filtro não existisse", async () => {
    const r = await buscarDiretorio(filtros({ tipos: ["Café e padaria"] }));
    expect(r.total).toBe(2);
    expect(r.porCategoria).toEqual({ "Café e padaria": 2, "Moda e acessórios": 1 });
    // Entre os 2 resultados: quantos sobram ao marcar cada causa.
    expect(r.porCausa).toEqual({ sustentavel: 2, "liderado-por-mulheres": 1 });
  });

  it("filtra pelo Onde?: cidade com UF, estado ou cidade sem negócios", async () => {
    expect((await buscarDiretorio(filtros({ onde: "Recife, PE" }))).total).toBe(2);
    expect((await buscarDiretorio(filtros({ onde: "sp" }))).total).toBe(1);
    const semNinguem = await buscarDiretorio(filtros({ onde: "Olinda, PE" }));
    expect(semNinguem.total).toBe(0);
    expect(semNinguem.local).toEqual({ cidade: "Olinda", uf: "PE", rotulo: "Olinda, PE" });
  });

  it("junta a mesma cidade escrita de jeitos diferentes, na lista e no filtro", async () => {
    // Cadastros de antes da lista do IBGE gravaram a cidade como foi digitada.
    await criarEmpresa("brecho.sp", { nome: "Brechó Sem Acento", categoria: "Moda e acessórios", cidade: "Sao Paulo", uf: "SP" });
    await criarEmpresa("pet.sp", { nome: "Pet Maiúsculo", categoria: "Pet", cidade: "SÃO PAULO ", uf: "SP" });
    await criarEmpresa("bistro.floripa", { nome: "Bistrô Floripa", categoria: "Restaurante e bar", cidade: "Florianopolis", uf: "SC" });

    const r = await buscarDiretorio(filtros({ onde: "São Paulo, SP" }));
    expect(r.cidades).toEqual([
      { cidade: "Florianópolis", uf: "SC", total: 1 },
      { cidade: "Recife", uf: "PE", total: 2 },
      { cidade: "São Paulo", uf: "SP", total: 3 },
    ]);
    expect(r.local).toEqual({ cidade: "São Paulo", uf: "SP", rotulo: "São Paulo, SP" });
    expect(r.total).toBe(3);
    expect(r.porCategoria).toEqual({ "Café e padaria": 1, "Moda e acessórios": 1, Pet: 1 });
    expect((await buscarDiretorio(filtros({ onde: "sao paulo sp" }))).total).toBe(3);

    // Só com a grafia sem acento no banco: a lista mostra o nome oficial e o filtro acha.
    const floripa = await buscarDiretorio(filtros({ onde: "Florianópolis, SC" }));
    expect(floripa.itens.map((e) => e.instagramUsername)).toEqual(["bistro.floripa"]);
    expect((await buscarDiretorio(filtros({ onde: "florianopolis" }))).total).toBe(1);
    expect((await resumoDoDiretorio()).cidades).toBe(3);
  });

  it("junta também a cidade com hífen ou com a UF grudada no nome", async () => {
    await criarEmpresa("loja.tubarao", { nome: "Loja Tubarão", categoria: "Pet", cidade: "Tubarão", uf: "SC" });
    await criarEmpresa("bar.tubarao", { nome: "Bar Tubarão", categoria: "Restaurante e bar", cidade: "Tubarão-SC", uf: "SC" });
    await criarEmpresa("cafe.sjdr", { nome: "Café do Rei", categoria: "Café e padaria", cidade: "São João del-Rei", uf: "MG" });

    const r = await buscarDiretorio(filtros({ onde: "Tubarão, SC" }));
    expect(r.cidades.filter((c) => c.uf !== "PE" && c.uf !== "SP")).toEqual([
      { cidade: "São João del Rei", uf: "MG", total: 1 },
      { cidade: "Tubarão", uf: "SC", total: 2 },
    ]);
    expect(r.total).toBe(2);
    expect((await buscarDiretorio(filtros({ onde: "sao joao del rei, mg" }))).total).toBe(1);
  });

  it("combina causas (todas precisam valer), verificados e texto", async () => {
    expect((await buscarDiretorio(filtros({ causas: ["sustentavel", "liderado-por-mulheres"] }))).total).toBe(1);
    const verificados = await buscarDiretorio(filtros({ verificados: true, tipos: ["Café e padaria"] }));
    expect(verificados.total).toBe(1);
    // O número ao lado de "Só verificados" ignora esse próprio filtro.
    expect(verificados.verificados).toBe(1);
    expect((await buscarDiretorio(filtros({ q: "atelie" }))).itens.map((e) => e.instagramUsername)).toEqual(["atelie.raiz"]);
  });

  it("ordena por nome", async () => {
    const r = await buscarDiretorio(filtros({ ordem: "az" }));
    expect(r.itens.map((e) => e.nome)).toEqual(["Ateliê Raiz Preta", "Café Arco-Íris", "Padaria Florescer"]);
  });
});

describe("listarParaSitemap", () => {
  it("lista só os negócios do diretório, do atualizado mais recentemente ao mais antigo", async () => {
    await db.empresa.update({ where: { instagramUsername: "cafe.arcoiris" }, data: { resumo: "Atualizado agora" } });
    const negocios = await listarParaSitemap();
    expect(negocios.map((n) => n.instagramUsername)).toEqual(["cafe.arcoiris", "atelie.raiz", "padaria.florescer"]);
  });
});

describe("páginas de cidade, causa e tipo", () => {
  it("acha a cidade pelo endereço só se ela tem negócios no diretório", async () => {
    expect(await cidadeDoSlug("recife-pe")).toMatchObject({ cidade: "Recife", uf: "PE", total: 2 });
    // Olinda só tem um negócio tirado do ar.
    expect(await cidadeDoSlug("olinda-pe")).toBeUndefined();
    expect(await cidadeDoSlug("recife-sp")).toBeUndefined();
  });

  it("lista as cidades de uma causa e de um tipo, das que têm mais negócios para as que têm menos", async () => {
    expect(await cidadesCom("causa", "sustentavel")).toEqual([
      { cidade: "Recife", uf: "PE", total: 1 },
      { cidade: "São Paulo", uf: "SP", total: 1 },
    ]);
    expect(await cidadesCom("categoria", "Moda e acessórios")).toEqual([{ cidade: "Recife", uf: "PE", total: 1 }]);
    // Os negócios fora do diretório não contam.
    expect(await cidadesCom("categoria", "Pet")).toEqual([]);
  });

  it("junta as grafias da mesma cidade, com o nome oficial", async () => {
    await criarEmpresa("brecho.vila", { nome: "Brechó da Vila", categoria: "Moda e acessórios", cidade: "Sao Paulo", uf: "SP" });
    await criarEmpresa("loja.centro", { nome: "Loja do Centro", categoria: "Moda e acessórios", cidade: "Sao Paulo", uf: "SP" });
    await criarEmpresa("atelie.sul", { nome: "Ateliê Sul", categoria: "Moda e acessórios", cidade: "São Paulo", uf: "SP" });
    // Cadastro antigo, com a UF grudada no nome.
    await criarEmpresa("loja.tubarao", { nome: "Loja de Tubarão", categoria: "Moda e acessórios", cidade: "Tubarao-SC", uf: "SC" });
    expect(await cidadesCom("categoria", "Moda e acessórios")).toEqual([
      { cidade: "São Paulo", uf: "SP", total: 3 },
      { cidade: "Recife", uf: "PE", total: 1 },
      { cidade: "Tubarão", uf: "SC", total: 1 },
    ]);
    expect(await cidadeDoSlug("tubarao-sc")).toMatchObject({ cidade: "Tubarão", total: 1 });
  });
});
