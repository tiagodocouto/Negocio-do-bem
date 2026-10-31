import { afterEach, describe, expect, it } from "vitest";
import { ehModerador } from "@/lib/auth/sessao";
import { agruparPorSemana, comAviso, DIA, destinoNaModeracao, hrefModeracao, lerFiltros } from "@/lib/moderacao/filtros";

describe("ehModerador", () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("só o papel no banco dá moderação", () => {
    expect(ehModerador({ papel: "moderador" })).toBe(true);
    expect(ehModerador({ papel: "membro" })).toBe(false);
  });

  it("o e-mail não dá moderação, nem quando está em ADMIN_EMAILS", () => {
    // O cadastro não confirma o e-mail: qualquer pessoa pode criar uma conta com ele.
    process.env.ADMIN_EMAILS = "admin@exemplo.com";
    const conta = { papel: "membro", email: "admin@exemplo.com" };
    expect(ehModerador(conta)).toBe(false);
  });
});

describe("lerFiltros do painel", () => {
  it("sem nada na URL, abre a visão geral sem filtros", () => {
    expect(lerFiltros({})).toEqual({
      aba: "visao-geral",
      q: "",
      pagina: 1,
      negocios: "todos",
      contas: "todas",
      depoimentos: "todos",
      acao: "",
      pessoa: "",
      alvo: null,
    });
  });

  it("aceita só abas e situações conhecidas, sem chaves do protótipo", () => {
    expect(lerFiltros({ aba: "constructor" }).aba).toBe("visao-geral");
    expect(lerFiltros({ aba: "contas", situacao: "sem-atividade" }).contas).toBe("sem-atividade");
    expect(lerFiltros({ aba: "negocios", situacao: "toString" }).negocios).toBe("todos");
    expect(lerFiltros({ aba: "negocios", situacao: "sem-foto" }).negocios).toBe("sem-foto");
  });

  it("limita a página e a busca", () => {
    expect(lerFiltros({ pagina: "0" }).pagina).toBe(1);
    expect(lerFiltros({ pagina: "abc" }).pagina).toBe(1);
    expect(lerFiltros({ pagina: "99999" }).pagina).toBe(1000);
    expect(lerFiltros({ q: ` ${"a".repeat(150)} ` }).q).toHaveLength(100);
  });

  it("filtros da auditoria só passam no formato certo", () => {
    expect(lerFiltros({ acao: "empresa.aprovada" }).acao).toBe("empresa.aprovada");
    expect(lerFiltros({ acao: "drop table" }).acao).toBe("");
    expect(lerFiltros({ pessoa: "sistema" }).pessoa).toBe("sistema");
    expect(lerFiltros({ pessoa: "cm1abc23" }).pessoa).toBe("cm1abc23");
    expect(lerFiltros({ pessoa: "../admin" }).pessoa).toBe("");
    expect(lerFiltros({ alvo: "empresa:cm1abc23" }).alvo).toEqual({ tipo: "empresa", id: "cm1abc23" });
    expect(lerFiltros({ alvo: "sessao:cm1abc23" }).alvo).toBeNull();
    expect(lerFiltros({ alvo: "empresa:" }).alvo).toBeNull();
  });
});

describe("hrefModeracao", () => {
  it("deixa fora da URL o que é padrão", () => {
    expect(hrefModeracao("visao-geral")).toBe("/moderacao");
    expect(hrefModeracao("contas", { q: "", situacao: "todas", pagina: 1 })).toBe("/moderacao?aba=contas");
    expect(hrefModeracao("negocios", { q: "café", situacao: "sem-foto", pagina: 2 })).toBe(
      "/moderacao?aba=negocios&q=caf%C3%A9&situacao=sem-foto&pagina=2",
    );
  });
});

describe("destinoNaModeracao", () => {
  it("aceita só caminhos da moderação", () => {
    expect(destinoNaModeracao("/moderacao?aba=negocios&situacao=sem-dono")).toBe("/moderacao?aba=negocios&situacao=sem-dono");
    expect(destinoNaModeracao("/moderacao")).toBe("/moderacao");
    expect(destinoNaModeracao("/moderacao/contas/abc")).toBe("/moderacao/contas/abc");
    expect(destinoNaModeracao("/moderacaox")).toBeNull();
    expect(destinoNaModeracao("/painel")).toBeNull();
    expect(destinoNaModeracao("//exemplo.com/moderacao")).toBeNull();
    expect(destinoNaModeracao("/moderacao//exemplo.com")).toBeNull();
    expect(destinoNaModeracao("/moderacao\\exemplo")).toBeNull();
    expect(destinoNaModeracao("https://exemplo.com/moderacao")).toBeNull();
    expect(destinoNaModeracao(null)).toBeNull();
  });
});

describe("comAviso", () => {
  it("acrescenta o aviso e troca um aviso anterior", () => {
    expect(comAviso("/moderacao?aba=negocios", "feito")).toBe("/moderacao?aba=negocios&aviso=feito");
    expect(comAviso("/moderacao?aviso=salvo&aba=negocios", "feito")).toBe("/moderacao?aviso=feito&aba=negocios");
    expect(comAviso("/moderacao", "feito")).toBe("/moderacao?aviso=feito");
  });
});

describe("agruparPorSemana", () => {
  const agora = new Date("2026-10-29T12:00:00Z");
  const atras = (dias: number) => new Date(agora.getTime() - dias * DIA);

  it("conta cada data na semana certa, da mais antiga para a mais recente", () => {
    const semanas = agruparPorSemana([atras(0), atras(1), atras(6.9), atras(7), atras(20), atras(21)], agora, 4);
    expect(semanas.map((s) => s.total)).toEqual([1, 1, 1, 3]);
    expect(semanas.at(-1)!.fim).toEqual(agora);
    expect(semanas.at(-1)!.inicio).toEqual(atras(7));
    expect(semanas[0]!.inicio).toEqual(atras(28));
  });

  it("ignora o que é mais antigo que o período e põe datas no futuro na última semana", () => {
    const semanas = agruparPorSemana([atras(28), atras(100), new Date(agora.getTime() + DIA)], agora, 4);
    expect(semanas.map((s) => s.total)).toEqual([0, 0, 0, 1]);
  });
});
