import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  descreverFiltroDaAuditoria,
  fichaDaConta,
  listarAuditoria,
  listarContas,
  listarDepoimentos,
  listarNegocios,
} from "@/lib/moderacao/consultas";
import { decidirDenunciaDoDepoimento, moderarNegocio } from "@/lib/moderacao/decisoes";
import { DIA, type SituacaoNegocio } from "@/lib/moderacao/filtros";
import { atividadeSemanal, distribuicaoDoDiretorio, resumoDoPainel, saudeDosDados } from "@/lib/moderacao/indicadores";
import { textoDeBusca } from "@/lib/texto";

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

const agora = new Date();
const atras = (dias: number) => new Date(agora.getTime() - dias * DIA);

async function criarConta(nome: string, email: string, extra: { papel?: string; criadoEm?: Date } = {}) {
  return db.usuario.create({ data: { nome, email, senhaHash: "scrypt$segredo", ...extra } });
}

async function criarEmpresa(
  username: string,
  dados: Partial<{
    nome: string;
    cidade: string;
    uf: string;
    categoria: string;
    moderacao: string;
    oculta: boolean;
    status: string;
    fotoUrl: string;
    site: string;
    historia: string;
    indicadaPorId: string;
    causas: string[];
    criadoEm: Date;
  }> = {},
) {
  const { causas = [], ...resto } = dados;
  const campos = { nome: `Negócio ${username}`, resumo: "Um negócio do bem", categoria: "Serviços", cidade: "Recife", uf: "PE", ...resto };
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

// Uma moderadora, uma dona, uma pessoa que só escreve depoimentos e uma conta parada.
let moderadora: { id: string };
let dona: { id: string };
let leitor: { id: string };
let parada: { id: string };
let padaria: { id: string };
let livraria: { id: string };

beforeEach(async () => {
  await limparBanco();
  moderadora = await criarConta("Marta Moderadora", "marta@exemplo.com", { papel: "moderador", criadoEm: atras(60) });
  dona = await criarConta("Dalva Dona", "dalva@exemplo.com", { criadoEm: atras(30) });
  leitor = await criarConta("Lauro Leitor", "lauro@exemplo.com", { criadoEm: atras(2) });
  parada = await criarConta("Paula Parada", "paula@exemplo.com", { criadoEm: atras(1) });

  padaria = await criarEmpresa("padaria.flor", {
    nome: "Padaria Flor",
    categoria: "Café e padaria",
    status: "verificada",
    fotoUrl: "/enviados/perfis/flor.webp",
    site: "https://padariaflor.com.br",
    historia: "Começou na cozinha de casa.",
    indicadaPorId: dona.id,
    causas: ["liderado-por-mulheres", "sustentavel"],
    criadoEm: atras(3),
  });
  await db.empresaMembro.create({ data: { empresaId: padaria.id, usuarioId: dona.id } });
  livraria = await criarEmpresa("livraria.raiz", {
    nome: "Livraria Raiz",
    cidade: "Sao Paulo",
    uf: "SP",
    indicadaPorId: leitor.id,
    causas: ["sustentavel"],
    criadoEm: atras(10),
  });
  await criarEmpresa("escondido", { nome: "Escondido", cidade: "Cidade Inventada", oculta: true, criadoEm: atras(40) });
  await criarEmpresa("tirado", { nome: "Tirado do ar", moderacao: "rejeitada", criadoEm: atras(40) });

  await db.depoimento.create({ data: { empresaId: padaria.id, autorId: leitor.id, texto: "Pão quentinho e gente boa.", resposta: "Obrigada!" } });
  await db.depoimento.create({
    data: {
      empresaId: livraria.id,
      autorId: leitor.id,
      texto: "Atendimento grosseiro, nunca mais.",
      denunciado: true,
      motivoDenuncia: "Ofensivo",
      denunciadoPorId: dona.id,
    },
  });
  await db.depoimento.create({ data: { empresaId: livraria.id, autorId: dona.id, texto: "Texto removido pela moderação.", status: "removido" } });

  await db.reivindicacao.create({
    data: { empresaId: livraria.id, usuarioId: leitor.id, metodo: "documento", status: "pendente", expiraEm: atras(1) },
  });
  await db.reivindicacao.create({
    data: {
      empresaId: padaria.id,
      usuarioId: dona.id,
      metodo: "documento",
      status: "aprovada",
      expiraEm: atras(-30),
      revisadoPorId: moderadora.id,
      revisadoEm: atras(3),
    },
  });

  await db.sessao.create({ data: { id: "sessao-aberta", usuarioId: dona.id, expiraEm: atras(-10) } });
  await db.sessao.create({ data: { id: "sessao-vencida", usuarioId: leitor.id, expiraEm: atras(1) } });

  // Datas explícitas: registros criados no mesmo milissegundo empatariam na ordem.
  const registrar = (dias: number, dados: { usuarioId: string | null; acao: string; alvoTipo: string; alvoId: string; detalhes?: string }) =>
    db.registroAuditoria.create({ data: { ...dados, criadoEm: atras(dias) } });
  await registrar(4, { usuarioId: moderadora.id, acao: "empresa.rejeitada", alvoTipo: "empresa", alvoId: livraria.id, detalhes: "@livraria.raiz" });
  await registrar(3, { usuarioId: moderadora.id, acao: "empresa.aprovada", alvoTipo: "empresa", alvoId: livraria.id, detalhes: "@livraria.raiz" });
  await registrar(2, { usuarioId: null, acao: "usuario.moderacao_dada", alvoTipo: "usuario", alvoId: moderadora.id });
  await registrar(1, { usuarioId: dona.id, acao: "empresa.editada", alvoTipo: "empresa", alvoId: "apagada123" });
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("resumoDoPainel", () => {
  it("conta negócios, contas, depoimentos e pedidos em todas as situações", async () => {
    expect(await resumoDoPainel(agora)).toEqual({
      negocios: { total: 4, noDiretorio: 2, verificados: 1, foraDoAr: 1, ocultos: 1, pendentes: 0, semDono: 3, novos: 1 },
      contas: { total: 4, moderacao: 1, donos: 1, novas: 2, comSessao: 1, semAtividade: 2 },
      depoimentos: { publicados: 2, removidos: 1, denunciados: 1, respondidos: 1, novos: 3 },
      reivindicacoes: { total: 2, pendentes: 1, aprovadas: 1, recusadas: 0 },
    });
  });
});

describe("atividadeSemanal", () => {
  it("põe cada cadastro na semana em que entrou", async () => {
    const atividade = await atividadeSemanal(agora, 4);
    expect(atividade.negocios.map((s) => s.total)).toEqual([0, 0, 1, 1]);
    expect(atividade.contas.map((s) => s.total)).toEqual([0, 0, 0, 2]);
    expect(atividade.depoimentos.at(-1)!.total).toBe(3);
  });
});

describe("distribuicaoDoDiretorio", () => {
  it("conta só o que está no diretório, do maior para o menor", async () => {
    expect(await distribuicaoDoDiretorio()).toEqual({
      porUf: [
        { chave: "PE", total: 1 },
        { chave: "SP", total: 1 },
      ],
      porCategoria: [
        { chave: "Café e padaria", total: 1 },
        { chave: "Serviços", total: 1 },
      ],
      porCausa: [
        { chave: "sustentavel", total: 2 },
        { chave: "liderado-por-mulheres", total: 1 },
      ],
    });
  });
});

describe("saudeDosDados", () => {
  it("aponta o que está incompleto e as cidades fora da lista do IBGE", async () => {
    expect(await saudeDosDados(agora)).toEqual({
      semFoto: 1,
      semContato: 1,
      semHistoria: 1,
      cidadesForaDaLista: [
        { cidade: "Cidade Inventada", uf: "PE", total: 1, oficial: null },
        { cidade: "Sao Paulo", uf: "SP", total: 1, oficial: "São Paulo" },
      ],
      pedidosVencidos: 1,
      sessoesVencidas: 1,
    });
  });
});

describe("listarContas", () => {
  const todas = { q: "", situacao: "todas" as const, pagina: 1 };

  it("traz as contas mais novas primeiro, com o que cada uma fez e sem o hash da senha", async () => {
    const r = await listarContas(todas, agora);
    expect(r.total).toBe(4);
    expect(r.itens.map((c) => c.nome)).toEqual(["Paula Parada", "Lauro Leitor", "Dalva Dona", "Marta Moderadora"]);
    const dalva = r.itens.find((c) => c.id === dona.id)!;
    expect(dalva._count).toEqual({ empresas: 1, indicacoes: 1, depoimentos: 1, reivindicacoes: 1 });
    expect(dalva.sessoes).toHaveLength(1);
    expect(r.itens.find((c) => c.id === leitor.id)!.sessoes).toHaveLength(0);
    expect(dalva).not.toHaveProperty("senhaHash");
  });

  it("busca no nome e no e-mail, sem diferenciar maiúsculas", async () => {
    expect((await listarContas({ ...todas, q: "DALVA" }, agora)).itens.map((c) => c.id)).toEqual([dona.id]);
    expect((await listarContas({ ...todas, q: "lauro@" }, agora)).itens.map((c) => c.id)).toEqual([leitor.id]);
    expect((await listarContas({ ...todas, q: "marta exemplo" }, agora)).itens.map((c) => c.id)).toEqual([moderadora.id]);
  });

  it("filtra por moderação, donos, novas e sem atividade", async () => {
    const ids = async (situacao: "moderacao" | "donos" | "novas" | "sem-atividade") =>
      (await listarContas({ ...todas, situacao }, agora)).itens.map((c) => c.id);
    expect(await ids("moderacao")).toEqual([moderadora.id]);
    expect(await ids("donos")).toEqual([dona.id]);
    expect(await ids("novas")).toEqual([parada.id, leitor.id]);
    // A moderadora não indicou nem escreveu nada: decidir pedidos não conta como atividade no site.
    expect(await ids("sem-atividade")).toEqual([parada.id, moderadora.id]);
  });
});

describe("fichaDaConta", () => {
  it("junta tudo o que a conta fez e o que a auditoria guardou sobre ela", async () => {
    const ficha = (await fichaDaConta(dona.id))!;
    expect(ficha).not.toHaveProperty("senhaHash");
    expect(ficha.empresas.map((e) => e.empresa.instagramUsername)).toEqual(["padaria.flor"]);
    expect(ficha.indicacoes.map((e) => e.instagramUsername)).toEqual(["padaria.flor"]);
    expect(ficha.depoimentos.map((d) => d.status)).toEqual(["removido"]);
    expect(ficha.denuncias.map((d) => d.autor.id)).toEqual([leitor.id]);
    expect(ficha.reivindicacoes[0]).toMatchObject({ status: "aprovada", revisadoPor: { id: moderadora.id } });
    expect(ficha.auditoria.map((r) => r.acao)).toEqual(["empresa.editada"]);
    // O negócio do registro foi apagado: o registro fica, sem link.
    expect(ficha.auditoria[0]!.alvo).toBeNull();

    const marta = (await fichaDaConta(moderadora.id))!;
    expect(marta._count.revisoes).toBe(1);
    expect(marta.auditoria.map((r) => r.acao)).toEqual(["usuario.moderacao_dada", "empresa.aprovada", "empresa.rejeitada"]);
  });

  it("devolve null para uma conta que não existe", async () => {
    expect(await fichaDaConta("naoexiste")).toBeNull();
  });
});

describe("listarNegocios", () => {
  const todos = { q: "", situacao: "todos" as const, pagina: 1 };
  const usernames = async (filtros: { q?: string; situacao?: SituacaoNegocio }) =>
    (await listarNegocios({ ...todos, ...filtros })).itens.map((e) => e.instagramUsername).sort();

  it("mostra todos os negócios, em qualquer situação", async () => {
    expect(await usernames({})).toEqual(["escondido", "livraria.raiz", "padaria.flor", "tirado"]);
  });

  it("filtra pela situação", async () => {
    expect(await usernames({ situacao: "diretorio" })).toEqual(["livraria.raiz", "padaria.flor"]);
    expect(await usernames({ situacao: "fora-do-ar" })).toEqual(["tirado"]);
    expect(await usernames({ situacao: "ocultos" })).toEqual(["escondido"]);
    expect(await usernames({ situacao: "sem-dono" })).toEqual(["escondido", "livraria.raiz", "tirado"]);
    expect(await usernames({ situacao: "verificados" })).toEqual(["padaria.flor"]);
    // Sem foto, sem contato e sem história olham só o diretório.
    expect(await usernames({ situacao: "sem-foto" })).toEqual(["livraria.raiz"]);
    expect(await usernames({ situacao: "sem-contato" })).toEqual(["livraria.raiz"]);
    expect(await usernames({ situacao: "sem-historia" })).toEqual(["livraria.raiz"]);
  });

  it("busca sem acento e aceita o @ colado do Instagram", async () => {
    expect(await usernames({ q: "@padaria.flor" })).toEqual(["padaria.flor"]);
    expect(await usernames({ q: "sao paulo" })).toEqual(["livraria.raiz"]);
  });

  it("traz os donos e quem indicou", async () => {
    const [flor] = (await listarNegocios({ ...todos, q: "padaria" })).itens;
    expect(flor!.membros.map((m) => m.usuario.id)).toEqual([dona.id]);
    expect(flor!.indicadaPor?.id).toBe(dona.id);
    expect(flor!._count.depoimentos).toBe(1);
  });
});

describe("listarDepoimentos", () => {
  const todos = { q: "", situacao: "todos" as const, pagina: 1 };

  it("filtra pela situação", async () => {
    const textos = async (situacao: Parameters<typeof listarDepoimentos>[0]["situacao"]) =>
      (await listarDepoimentos({ ...todos, situacao })).itens.map((d) => d.texto);
    expect(await textos("todos")).toHaveLength(3);
    expect(await textos("denunciados")).toEqual(["Atendimento grosseiro, nunca mais."]);
    expect(await textos("removidos")).toEqual(["Texto removido pela moderação."]);
    expect(await textos("sem-resposta")).toEqual(["Atendimento grosseiro, nunca mais."]);
  });

  it("busca no texto, no autor e no negócio", async () => {
    const total = async (q: string) => (await listarDepoimentos({ ...todos, q })).total;
    expect(await total("QUENTINHO")).toBe(1);
    expect(await total("lauro")).toBe(2);
    expect(await total("livraria")).toBe(2);
  });
});

describe("listarAuditoria", () => {
  const sem = { acao: "", pessoa: "", alvo: null, pagina: 1 };

  it("traz o mais novo primeiro, com um link para cada alvo que ainda existe", async () => {
    const r = await listarAuditoria(sem);
    expect(r.total).toBe(4);
    expect(r.itens.map((i) => i.acao)).toEqual(["empresa.editada", "usuario.moderacao_dada", "empresa.aprovada", "empresa.rejeitada"]);
    expect(r.itens[1]!.alvo).toEqual({ rotulo: "Marta Moderadora", href: `/moderacao/contas/${moderadora.id}` });
    expect(r.itens[2]!.alvo).toEqual({ rotulo: "Livraria Raiz", href: "/moderacao/negocios/livraria.raiz" });
    expect(r.acoes).toEqual([
      { acao: "empresa.aprovada", total: 1 },
      { acao: "empresa.editada", total: 1 },
      { acao: "empresa.rejeitada", total: 1 },
      { acao: "usuario.moderacao_dada", total: 1 },
    ]);
  });

  it("filtra por ação, por quem fez, pelo sistema e pelo alvo", async () => {
    const acoes = async (filtros: Partial<Parameters<typeof listarAuditoria>[0]>) =>
      (await listarAuditoria({ ...sem, ...filtros })).itens.map((i) => i.acao);
    expect(await acoes({ acao: "empresa.aprovada" })).toEqual(["empresa.aprovada"]);
    expect(await acoes({ pessoa: moderadora.id })).toEqual(["empresa.aprovada", "empresa.rejeitada"]);
    expect(await acoes({ pessoa: "sistema" })).toEqual(["usuario.moderacao_dada"]);
    expect(await acoes({ alvo: { tipo: "empresa", id: livraria.id } })).toEqual(["empresa.aprovada", "empresa.rejeitada"]);
  });

  it("descreve os filtros com o nome da pessoa e do alvo", async () => {
    expect(await descreverFiltroDaAuditoria({ pessoa: moderadora.id, alvo: { tipo: "empresa", id: padaria.id } })).toEqual({
      pessoa: "Marta Moderadora",
      alvo: "Padaria Flor",
    });
    expect(await descreverFiltroDaAuditoria({ pessoa: "sistema", alvo: null })).toEqual({ pessoa: "Sistema", alvo: null });
  });
});

describe("decisões simultâneas da moderação", () => {
  const registrosNovos = (desde: Date) => db.registroAuditoria.findMany({ where: { criadoEm: { gte: desde } } });

  it("publicar e não publicar a mesma indicação: só uma decisão vale", async () => {
    const indicacao = await criarEmpresa("indicada.nova", { moderacao: "pendente" });
    const desde = new Date();

    const resultados = await Promise.all([
      moderarNegocio({ empresaId: indicacao.id, de: "pendente", decisao: "aprovada", moderadorId: moderadora.id }),
      moderarNegocio({ empresaId: indicacao.id, de: "pendente", decisao: "rejeitada", moderadorId: dona.id }),
    ]);

    expect(resultados.filter(Boolean)).toHaveLength(1);
    const final = await db.empresa.findUniqueOrThrow({ where: { id: indicacao.id } });
    const registros = await registrosNovos(desde);
    expect(registros).toHaveLength(1);
    expect(registros[0]!.acao).toBe(final.moderacao === "aprovada" ? "empresa.aprovada" : "empresa.rejeitada");
  });

  it("tirar do ar duas vezes: só um registro na auditoria", async () => {
    const desde = new Date();

    const resultados = await Promise.all(
      [moderadora, dona].map((m) => moderarNegocio({ empresaId: padaria.id, de: "aprovada", decisao: "rejeitada", moderadorId: m.id })),
    );

    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: padaria.id } })).moderacao).toBe("rejeitada");
    expect(await registrosNovos(desde)).toHaveLength(1);
  });

  it("desfaz decisões condicionais quando a auditoria falha", async () => {
    const denunciado = await db.depoimento.findFirstOrThrow({ where: { denunciado: true, status: "publicado" } });
    await db.$executeRawUnsafe('ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "falha_auditoria_condicional_teste" CHECK (false) NOT VALID');
    try {
      await expect(moderarNegocio({ empresaId: padaria.id, de: "aprovada", decisao: "rejeitada", moderadorId: moderadora.id })).rejects.toThrow();
      await expect(decidirDenunciaDoDepoimento({ depoimentoId: denunciado.id, remover: true, moderadorId: moderadora.id })).rejects.toThrow();
      expect((await db.empresa.findUniqueOrThrow({ where: { id: padaria.id } })).moderacao).toBe("aprovada");
      expect(await db.depoimento.findUniqueOrThrow({ where: { id: denunciado.id } })).toMatchObject({
        denunciado: true,
        status: "publicado",
      });
    } finally {
      await db.$executeRawUnsafe('ALTER TABLE "RegistroAuditoria" DROP CONSTRAINT "falha_auditoria_condicional_teste"');
    }
  });

  it("não aplica a decisão quando o negócio já mudou de situação", async () => {
    expect(await moderarNegocio({ empresaId: padaria.id, de: "pendente", decisao: "rejeitada", moderadorId: moderadora.id })).toBe(false);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: padaria.id } })).moderacao).toBe("aprovada");
  });

  it("remover e manter o mesmo depoimento denunciado: só uma decisão vale", async () => {
    const denunciado = await db.depoimento.findFirstOrThrow({ where: { denunciado: true } });
    const desde = new Date();

    const resultados = await Promise.all([
      decidirDenunciaDoDepoimento({ depoimentoId: denunciado.id, remover: true, moderadorId: moderadora.id }),
      decidirDenunciaDoDepoimento({ depoimentoId: denunciado.id, remover: false, moderadorId: dona.id }),
    ]);

    expect(resultados.filter(Boolean)).toHaveLength(1);
    const final = await db.depoimento.findUniqueOrThrow({ where: { id: denunciado.id } });
    const registros = await registrosNovos(desde);
    expect(final.denunciado).toBe(false);
    expect(registros).toHaveLength(1);
    if (registros[0]!.acao === "depoimento.removido") {
      expect(final.status).toBe("removido");
      expect(final.motivoDenuncia).toBe("Ofensivo");
    } else {
      expect(final.status).toBe("publicado");
      expect(final.motivoDenuncia).toBeNull();
    }
  });
});
