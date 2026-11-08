import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

// As ações rodam fora do Next: o redirect vira um erro com o destino, e a guarda da
// moderação deixa passar só quem o teste escolher, como a de verdade faz com "acao".
const sessao = vi.hoisted(() => ({
  moderador: null as { id: string } | null,
  usuario: null as { id: string; emailConfirmado: boolean } | null,
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirect:${destino}`);
  },
}));
vi.mock("next/server", () => ({ after: vi.fn() }));

// Os documentos da verificação vão para uma pasta de teste, e não para o bucket privado.
const PASTA_DOS_DOCUMENTOS = mkdtempSync(path.join(tmpdir(), "ndb-documentos-"));
process.env.DOCUMENTOS_PASTA = PASTA_DOS_DOCUMENTOS;
const arquivosGuardados = () => readdirSync(PASTA_DOS_DOCUMENTOS);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const documento = (conteudo: Uint8Array = JPEG, nome = "rg.jpg") => new File([conteudo as BlobPart], nome);
vi.mock("@/lib/auth/sessao", () => ({
  exigirModerador: async () => {
    if (!sessao.moderador) throw new Error("redirect:/404");
    return { ...sessao.moderador, nome: "Moderação", email: "mod@exemplo.com", moderador: true, emailConfirmado: true };
  },
  exigirUsuario: async (voltar: string) => {
    if (!sessao.usuario) throw new Error(`redirect:/entrar?voltar=${voltar}`);
    return { ...sessao.usuario, nome: "Conta", email: "conta@exemplo.com", moderador: false };
  },
}));

const { after } = await import("next/server");
const { liberarDonoParaClube, pedirVerificacaoAcao, recusarPedidoDoClube, suspenderDonoDoClube } = await import("@/acoes/clube");
const { apagarDocumentosVencidos, conferirIdentidade, podeCriarOfertas, quemBateComAConta } = await import("@/lib/clube");
const { suspenderPorContatoAlterado } = await import("@/lib/ofertas");

const CNPJ = "11222333000181";

/** A Receita de mentira: responde a ficha do CNPJ pedido, com a situação e os sócios do teste. */
function receitaCom(situacao: string, socios: string[] = ["DORA DONA DA SILVA"]) {
  const fetch = vi.fn(async () =>
    Response.json({
      razao_social: "PADARIA FLOR LTDA",
      nome_fantasia: "PADARIA FLOR",
      descricao_situacao_cadastral: situacao,
      municipio: "RECIFE",
      uf: "PE",
      qsa: socios.map((nome) => ({ nome_socio: nome, qualificacao_socio: "Sócio-Administrador" })),
      ddd_telefone_1: "8133334444",
      email: "CONTATO@PADARIAFLOR.COM.BR",
    }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "RegistroAuditoria", "LiberacaoClube", "EmpresaMembro", "Empresa", "Usuario" CASCADE`);
}

function formulario(campos: Record<string, string | File | File[]>) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) {
    for (const item of Array.isArray(valor) ? valor : [valor]) dados.append(nome, item);
  }
  return dados;
}

/** Para onde a ação mandou a pessoa. */
async function destino(acao: Promise<void>): Promise<string> {
  try {
    await acao;
  } catch (erro) {
    if (erro instanceof Error && erro.message.startsWith("redirect:")) return erro.message.slice("redirect:".length);
    throw erro;
  }
  throw new Error("A ação não redirecionou.");
}

let moderador: { id: string };
let dona: { id: string };
let outra: { id: string };
let empresaId: string;

const liberar = (campos: Record<string, string> = {}) =>
  liberarDonoParaClube(formulario({ empresaId, usuarioId: dona.id, cnpj: "11.222.333/0001-81", ...campos }));
const liberacao = () => db.liberacaoClube.findUnique({ where: { empresaId_usuarioId: { empresaId, usuarioId: dona.id } } });
const auditoria = () => db.registroAuditoria.findMany({ where: { alvoId: empresaId }, orderBy: { criadoEm: "asc" } });

beforeEach(async () => {
  for (const arquivo of arquivosGuardados()) rmSync(path.join(PASTA_DOS_DOCUMENTOS, arquivo));
  await limparBanco();
  moderador = await db.usuario.create({ data: { nome: "Mona Moderação", email: "mona@exemplo.com", papel: "moderador" } });
  dona = await db.usuario.create({ data: { nome: "Dora Dona", email: "dora@exemplo.com" } });
  outra = await db.usuario.create({ data: { nome: "Olga Outra", email: "olga@exemplo.com" } });
  const empresa = await db.empresa.create({
    data: {
      instagramUsername: "padaria.flor",
      nome: "Padaria Flor",
      resumo: "Um negócio do bem",
      categoria: "Café e padaria",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      status: "verificada",
      membros: { create: { usuarioId: dona.id } },
    },
  });
  empresaId = empresa.id;
  sessao.moderador = moderador;
  sessao.usuario = { id: dona.id, emailConfirmado: true };
  vi.mocked(after).mockClear();
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  rmSync(PASTA_DOS_DOCUMENTOS, { recursive: true, force: true });
  await limparBanco();
  await db.$disconnect();
});

describe("liberar um dono para o clube", () => {
  it("com CNPJ ativo na Receita, libera, guarda o CNPJ sem pontuação e registra na auditoria", async () => {
    receitaCom("ATIVA");

    expect(await destino(liberar())).toBe("/moderacao/negocios/padaria.flor?aviso=clube_liberado#clube");
    expect(await liberacao()).toMatchObject({ cnpj: CNPJ, status: "liberada", motivo: null, decididoPorId: moderador.id });
    expect(await auditoria()).toMatchObject([
      { acao: "clube.liberado", usuarioId: moderador.id, detalhes: "@padaria.flor · Dora Dona · CNPJ 11.222.333/0001-81" },
    ]);
    expect(await podeCriarOfertas(empresaId, dona.id)).toBe(true);
  });

  it("confere a Receita no servidor e recusa CNPJ que não está ativo", async () => {
    receitaCom("BAIXADA");

    expect(await destino(liberar())).toBe("/moderacao/negocios/padaria.flor?aviso=clube_cnpj_inativo#clube");
    expect(await liberacao()).toBeNull();
    expect(await auditoria()).toHaveLength(0);
  });

  it("sem resposta da Receita, não libera", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 502 })));

    expect(await destino(liberar())).toBe("/moderacao/negocios/padaria.flor?aviso=clube_receita_indisponivel#clube");
    expect(await liberacao()).toBeNull();
  });

  it("recusa um CNPJ com os dígitos errados, sem consultar a Receita", async () => {
    const fetch = receitaCom("ATIVA");

    expect(await destino(liberar({ cnpj: "11.222.333/0001-82" }))).toBe(
      "/moderacao/negocios/padaria.flor?aviso=clube_cnpj_invalido#clube",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("só libera quem é dono do negócio", async () => {
    receitaCom("ATIVA");

    expect(await destino(liberar({ usuarioId: outra.id }))).toBe("/moderacao/negocios/padaria.flor?aviso=clube_nao_e_dono#clube");
    expect(await db.liberacaoClube.count()).toBe(0);
  });

  it("quem não é da moderação é recusado sem gravar nada", async () => {
    receitaCom("ATIVA");
    sessao.moderador = null;

    expect(await destino(liberar())).toBe("/404");
    expect(await liberacao()).toBeNull();
  });
});

describe("suspender e liberar de novo", () => {
  it("suspende com o motivo, uma vez só, e a pessoa deixa de poder criar ofertas", async () => {
    receitaCom("ATIVA");
    await destino(liberar());
    const { id } = (await liberacao())!;

    const suspender = () => suspenderDonoDoClube(formulario({ liberacaoId: id, motivo: "Pediu Pix antecipado" }));
    expect(await destino(suspender())).toBe("/moderacao/negocios/padaria.flor?aviso=clube_suspenso#clube");
    expect(await destino(suspender())).toBe("/moderacao/negocios/padaria.flor?aviso=clube_suspenso#clube");

    expect(await liberacao()).toMatchObject({ status: "suspensa", motivo: "Pediu Pix antecipado" });
    expect((await auditoria()).map((registro) => registro.acao)).toEqual(["clube.liberado", "clube.suspenso"]);
    expect(await podeCriarOfertas(empresaId, dona.id)).toBe(false);
  });

  it("liberar de novo apaga o motivo da suspensão", async () => {
    receitaCom("ATIVA");
    await destino(liberar());
    await destino(suspenderDonoDoClube(formulario({ liberacaoId: (await liberacao())!.id, motivo: "Conferência" })));

    await destino(liberar());

    expect(await liberacao()).toMatchObject({ status: "liberada", motivo: null });
    expect(await db.liberacaoClube.count()).toBe(1);
  });

  it("quem deixa de ser dono perde a liberação", async () => {
    receitaCom("ATIVA");
    await destino(liberar());

    await db.empresaMembro.deleteMany({ where: { empresaId, usuarioId: dona.id } });

    expect(await podeCriarOfertas(empresaId, dona.id)).toBe(false);
  });
});

describe("com quem da ficha o nome da conta bate", () => {
  const ficha = (razaoSocial: string, socios: string[] = []) => ({
    razaoSocial,
    socios: socios.map((nome) => ({ nome, qualificacao: null, cpfMascarado: null })),
  });

  it("acha o sócio sem ligar para acento, maiúsculas, ordem nem nomes do meio", () => {
    expect(quemBateComAConta("Dora Dona", ficha("PADARIA FLOR LTDA", ["JOÃO SOUZA", "DORA MARIA DONA DA SILVA"]))).toBe(
      "DORA MARIA DONA DA SILVA",
    );
    expect(quemBateComAConta("José Antônio", ficha("X LTDA", ["ANTONIO JOSE PEREIRA"]))).toBe("ANTONIO JOSE PEREIRA");
  });

  it("no MEI, acha a pessoa na razão social, que traz o CPF", () => {
    expect(quemBateComAConta("Carla Moreira", ficha("CARLA MOREIRA DOS SANTOS 12345678900"))).toBe(
      "CARLA MOREIRA DOS SANTOS 12345678900",
    );
  });

  it("não bate com um nome só, nem com um sobrenome diferente", () => {
    expect(quemBateComAConta("Dora", ficha("X LTDA", ["DORA DONA"]))).toBeNull();
    expect(quemBateComAConta("Dora Souza", ficha("X LTDA", ["DORA DONA"]))).toBeNull();
  });
});


describe("o nome e o CPF informados contra a ficha da Receita", () => {
  const ficha = (razaoSocial: string, socios: { nome: string; cpfMascarado: string | null }[]) => ({
    razaoSocial,
    socios: socios.map((socio) => ({ ...socio, qualificacao: null })),
  });
  const informado = { nomeCompleto: "Dora Dona da Silva", cpfMascarado: "***.982.247-**" };

  it("o CPF bate quando os 6 dígitos do meio são os de um sócio, e o nome, com o mesmo sócio", () => {
    const resultado = conferirIdentidade(ficha("X LTDA", [{ nome: "DORA DONA DA SILVA", cpfMascarado: "***982247**" }]), informado);
    expect(resultado).toEqual({ nomeBate: "DORA DONA DA SILVA", cpfBate: true });
  });

  it("não bate com outro sócio", () => {
    const resultado = conferirIdentidade(ficha("X LTDA", [{ nome: "ISABELA CANTO", cpfMascarado: "***325350**" }]), informado);
    expect(resultado).toEqual({ nomeBate: null, cpfBate: false });
  });

  it("no MEI, o CPF vem na razão social", () => {
    const resultado = conferirIdentidade(ficha("DORA DONA DA SILVA 52998224725", []), informado);
    expect(resultado).toEqual({ nomeBate: "DORA DONA DA SILVA 52998224725", cpfBate: true });
  });

  it("sem CPF informado (pedido antigo), nada bate", () => {
    const resultado = conferirIdentidade(ficha("X LTDA", [{ nome: "DORA DONA", cpfMascarado: "***982247**" }]), { nomeCompleto: null, cpfMascarado: null });
    expect(resultado).toEqual({ nomeBate: null, cpfBate: false });
  });
});

describe("o dono pede a verificação com o CNPJ", () => {
  /** O pedido do dono, pelo formulário do painel do clube. Devolve o erro, ou o destino quando dá certo. */
  async function pedir(cnpj = "11.222.333/0001-81", extras: Record<string, string | File | File[]> = {}): Promise<string> {
    try {
      const campos = {
        empresaId,
        cnpj,
        nomeCompleto: "Dora Dona da Silva",
        cpf: "529.982.247-25",
        consentimento: "sim",
        documentos: [documento()],
        ...extras,
      };
      const estado = await pedirVerificacaoAcao(undefined, formulario(campos));
      return `erro:${estado?.erro}`;
    } catch (erro) {
      if (erro instanceof Error && erro.message.startsWith("redirect:")) return erro.message.slice("redirect:".length);
      throw erro;
    }
  }
  const recusar = (motivo: string) =>
    recusarPedidoDoClube(formulario({ liberacaoId: "", motivo, voltar: "fila" }));

  it("com CNPJ ativo, o pedido entra na fila sem liberar, fica na auditoria e avisa a moderação", async () => {
    receitaCom("ATIVA");

    expect(await pedir()).toBe("/painel/padaria.flor/clube?aviso=clube_pedido_enviado#verificar");
    expect(await liberacao()).toMatchObject({ cnpj: CNPJ, status: "pendente", decididoPorId: null, motivo: null });
    // Só o nome e o CPF mascarado ficam guardados; o CPF inteiro não aparece em lugar nenhum.
    expect(await liberacao()).toMatchObject({ nomeCompleto: "Dora Dona da Silva", cpfMascarado: "***.982.247-**" });
    expect(JSON.stringify([await liberacao(), await auditoria()])).not.toMatch(/52998224725|529\.982\.247-25/);
    expect(await auditoria()).toMatchObject([
      { acao: "clube.pedido", usuarioId: dona.id, detalhes: "@padaria.flor · CNPJ 11.222.333/0001-81" },
    ]);
    expect(await podeCriarOfertas(empresaId, dona.id)).toBe(false);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("exige o nome completo, um CPF válido e a autorização, sem consultar a Receita", async () => {
    const fetch = receitaCom("ATIVA");

    expect(await pedir(undefined, { nomeCompleto: "Dora" })).toBe("erro:Escreva o seu nome completo, como no documento.");
    expect(await pedir(undefined, { cpf: "529.982.247-26" })).toBe("erro:CPF inválido. Confira os números.");
    expect(await pedir(undefined, { cpf: "111.111.111-11" })).toBe("erro:CPF inválido. Confira os números.");
    expect(await pedir(undefined, { consentimento: "" })).toBe(
      "erro:Marque a autorização para a moderação usar o seu nome, o seu CPF e o seu documento na verificação.",
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(await liberacao()).toBeNull();
  });

  it("guarda o documento fora do banco: só a chave fica na liberação, e o arquivo no bucket privado", async () => {
    receitaCom("ATIVA");

    await pedir(undefined, { documentos: [documento(JPEG, "frente.jpg"), documento(JPEG, "verso.jpg")] });

    const { documentoChaves } = (await liberacao())!;
    expect(documentoChaves).toHaveLength(2);
    expect(documentoChaves.every((chave) => /^[0-9a-f]{32}\.jpg$/.test(chave))).toBe(true);
    expect(arquivosGuardados().sort()).toEqual([...documentoChaves].sort());
  });

  it("recusa documento ausente, de tipo errado, grande demais ou em excesso, sem guardar nada", async () => {
    const fetch = receitaCom("ATIVA");
    const texto = new TextEncoder().encode("isto não é uma imagem");
    const grande = new Uint8Array(5 * 1024 * 1024 + 1);
    grande.set(JPEG);

    expect(await pedir(undefined, { documentos: [] })).toBe("erro:Envie a foto do seu RG ou da sua CNH.");
    expect(await pedir(undefined, { documentos: [documento(texto, "rg.txt")] })).toBe("erro:Use uma foto JPG, PNG ou WebP, ou um PDF.");
    expect(await pedir(undefined, { documentos: [documento(grande)] })).toBe("erro:Cada arquivo pode ter até 5 MB.");
    expect(await pedir(undefined, { documentos: [documento(), documento(), documento()] })).toBe(
      "erro:Envie no máximo 2 arquivos: a frente e o verso.",
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(arquivosGuardados()).toEqual([]);
    expect(await liberacao()).toBeNull();
  });

  it("o tipo vem dos bytes, e não do nome: um PDF passa, e um texto chamado .jpg não", async () => {
    receitaCom("ATIVA");
    const pdf = new TextEncoder().encode("%PDF-1.7 conteúdo");

    expect(await pedir(undefined, { documentos: [documento(new TextEncoder().encode("texto"), "rg.jpg")] })).toMatch(/^erro:Use uma foto/);
    expect(await pedir(undefined, { documentos: [documento(pdf, "cnh.pdf")] })).toContain("clube_pedido_enviado");
    expect((await liberacao())!.documentoChaves[0]).toMatch(/\.pdf$/);
  });

  it("um pedido que não entra apaga o documento que já tinha subido", async () => {
    receitaCom("BAIXADA");

    expect(await pedir()).toMatch(/^erro:Este CNPJ não está ativo/);
    expect(arquivosGuardados()).toEqual([]);
  });

  it("liberar apaga o documento do bucket e limpa as chaves", async () => {
    receitaCom("ATIVA");
    await pedir();
    expect(arquivosGuardados()).toHaveLength(1);

    await liberarDonoParaClube(formulario({ empresaId, usuarioId: dona.id, cnpj: CNPJ })).catch(() => undefined);

    expect(arquivosGuardados()).toEqual([]);
    expect((await liberacao())!.documentoChaves).toEqual([]);
  });

  it("recusar apaga o documento; recusar de novo não faz nada", async () => {
    receitaCom("ATIVA");
    await pedir();
    const { id } = (await liberacao())!;

    await recusarPedidoDoClube(formulario({ liberacaoId: id, motivo: "Não bate" })).catch(() => undefined);

    expect(arquivosGuardados()).toEqual([]);
    expect((await liberacao())!.documentoChaves).toEqual([]);
  });

  it("os documentos de um pedido parado há mais de 30 dias saem quando a fila abre", async () => {
    receitaCom("ATIVA");
    await pedir();
    const velho = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await db.liberacaoClube.updateMany({ where: { usuarioId: dona.id }, data: { decididoEm: velho } });

    expect(await apagarDocumentosVencidos()).toBe(1);
    expect(arquivosGuardados()).toEqual([]);
    expect((await liberacao())!).toMatchObject({ status: "pendente", documentoChaves: [] });
    expect(await apagarDocumentosVencidos()).toBe(0);
  });

  it("um pedido de 29 dias mantém o documento", async () => {
    receitaCom("ATIVA");
    await pedir();
    await db.liberacaoClube.updateMany({ where: { usuarioId: dona.id }, data: { decididoEm: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000) } });

    expect(await apagarDocumentosVencidos()).toBe(0);
    expect(arquivosGuardados()).toHaveLength(1);
  });

  it("recusa um CNPJ com os dígitos errados, sem consultar a Receita", async () => {
    const fetch = receitaCom("ATIVA");

    expect(await pedir("11.222.333/0001-82")).toBe("erro:CNPJ inválido. Confira os números.");
    expect(fetch).not.toHaveBeenCalled();
    expect(await liberacao()).toBeNull();
  });

  it("um CNPJ que a Receita diz não estar ativo nem entra na fila", async () => {
    receitaCom("BAIXADA");

    expect(await pedir()).toBe("erro:Este CNPJ não está ativo na Receita. Só entram no clube negócios com CNPJ ativo.");
    expect(await liberacao()).toBeNull();
    expect(after).not.toHaveBeenCalled();
  });

  it("um CNPJ que a Receita não tem é recusado na hora", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("não encontrado", { status: 404 })));

    expect(await pedir()).toBe("erro:Não achamos este CNPJ na Receita. Confira os números.");
    expect(await liberacao()).toBeNull();
  });

  it("sem resposta da Receita, o pedido entra assim mesmo: a moderação consulta antes de liberar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 502 })));

    expect(await pedir()).toBe("/painel/padaria.flor/clube?aviso=clube_pedido_enviado#verificar");
    expect(await liberacao()).toMatchObject({ status: "pendente" });
  });

  it("só um dono do negócio pede, e com o e-mail confirmado", async () => {
    receitaCom("ATIVA");
    sessao.usuario = { id: outra.id, emailConfirmado: true };
    expect(await pedir()).toBe("erro:Só um dono do negócio pode pedir a verificação.");

    sessao.usuario = { id: dona.id, emailConfirmado: false };
    expect(await pedir()).toMatch(/^erro:Antes, confirme o seu e-mail/);
    expect(await db.liberacaoClube.count()).toBe(0);
  });

  it("não pede de novo com um pedido em análise, nem depois de liberado", async () => {
    receitaCom("ATIVA");
    await pedir();
    expect(await pedir()).toBe("erro:Você já tem um pedido em análise.");

    await destino(liberar());
    expect(await pedir()).toBe("erro:Você já está liberado no clube.");
    expect((await auditoria()).map((registro) => registro.acao)).toEqual(["clube.pedido", "clube.liberado"]);
  });

  it("a moderação libera pela fila, e volta para a fila", async () => {
    receitaCom("ATIVA");
    await pedir();

    expect(await destino(liberar({ voltar: "fila" }))).toBe("/moderacao?aba=clube&aviso=clube_liberado#pedidos");
    expect(await liberacao()).toMatchObject({ status: "liberada", motivo: null, decididoPorId: moderador.id });
    expect(await podeCriarOfertas(empresaId, dona.id)).toBe(true);
  });

  it("a moderação recusa com o motivo, uma vez só; o dono pede de novo e a moderação vê o motivo de antes", async () => {
    receitaCom("ATIVA");
    await pedir();
    const { id } = (await liberacao())!;
    const recusarEste = (motivo: string) => recusarPedidoDoClube(formulario({ liberacaoId: id, motivo, voltar: "fila" }));

    expect(await destino(recusarEste("O nome não bate com os sócios"))).toBe("/moderacao?aba=clube&aviso=clube_recusado#pedidos");
    expect(await destino(recusarEste("Outro motivo"))).toBe("/moderacao?aba=clube&aviso=clube_ja_decidido#pedidos");
    expect(await liberacao()).toMatchObject({ status: "recusada", motivo: "O nome não bate com os sócios", decididoPorId: moderador.id });

    expect(await pedir()).toBe("/painel/padaria.flor/clube?aviso=clube_pedido_enviado#verificar");
    expect(await liberacao()).toMatchObject({ status: "pendente", motivo: "O nome não bate com os sócios", decididoPorId: null });
    expect((await auditoria()).map((registro) => registro.acao)).toEqual(["clube.pedido", "clube.recusado", "clube.pedido"]);
    expect(await db.liberacaoClube.count()).toBe(1);
  });

  it("recusar um pedido que não existe volta para a fila", async () => {
    expect(await destino(recusar("Sem pedido"))).toBe("/moderacao?aba=clube");
  });

  it("só a moderação recusa", async () => {
    receitaCom("ATIVA");
    await pedir();
    sessao.moderador = null;

    expect(await destino(recusarPedidoDoClube(formulario({ liberacaoId: (await liberacao())!.id, motivo: "x" })))).toBe("/404");
    expect(await liberacao()).toMatchObject({ status: "pendente" });
  });

  it("quem foi suspenso pode pedir de novo, e continua sem criar ofertas até ser liberado", async () => {
    receitaCom("ATIVA");
    await destino(liberar());
    await destino(suspenderDonoDoClube(formulario({ liberacaoId: (await liberacao())!.id, motivo: "Contato trocado" })));

    expect(await pedir()).toBe("/painel/padaria.flor/clube?aviso=clube_pedido_enviado#verificar");
    expect(await liberacao()).toMatchObject({ status: "pendente", motivo: "Contato trocado" });
    expect(await podeCriarOfertas(empresaId, dona.id)).toBe(false);
  });

  it("trocar o contato do perfil não mexe num pedido em análise", async () => {
    receitaCom("ATIVA");
    await pedir();

    await db.$transaction((tx) => suspenderPorContatoAlterado(tx, { id: empresaId, instagramUsername: "padaria.flor" }));

    expect(await liberacao()).toMatchObject({ status: "pendente" });
  });
});
