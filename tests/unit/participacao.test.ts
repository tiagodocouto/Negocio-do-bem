import { describe, expect, it } from "vitest";
import { boaCompanhia, casoDaProcura } from "@/lib/participacao";

const NO_DIRETORIO = { moderacao: "aprovada", oculta: false, donos: 0 };

describe("casoDaProcura", () => {
  it("negócio que ainda não está aqui: indicar ou cadastrar como dono", () => {
    expect(casoDaProcura(null)).toBe("indicar");
  });

  it("no diretório e sem dono: confirmar que é seu", () => {
    expect(casoDaProcura(NO_DIRETORIO)).toBe("confirmar");
  });

  it("no diretório e com dono: pedir revisão", () => {
    expect(casoDaProcura({ ...NO_DIRETORIO, donos: 2 })).toBe("revisao");
  });

  it.each([
    ["tirado do ar sem dono", { ...NO_DIRETORIO, moderacao: "rejeitada" }],
    ["tirado do ar com dono", { ...NO_DIRETORIO, moderacao: "rejeitada", donos: 1 }],
    ["esperando a moderação", { ...NO_DIRETORIO, moderacao: "pendente" }],
    ["oculto pelo dono", { ...NO_DIRETORIO, oculta: true, donos: 1 }],
  ])("fora do diretório (%s): a mesma resposta, sem dizer o motivo", (_, negocio) => {
    expect(casoDaProcura(negocio)).toBe("indisponivel");
  });
});

describe("boaCompanhia", () => {
  it("usa o singular quando é um só", () => {
    expect(boaCompanhia(1, 1)).toBe("Você vai estar em boa companhia: 1 negócio em 1 cidade.");
  });

  it("usa o plural e o separador de milhar", () => {
    expect(boaCompanhia(1234, 5)).toBe("Você vai estar em boa companhia: 1.234 negócios em 5 cidades.");
  });
});
