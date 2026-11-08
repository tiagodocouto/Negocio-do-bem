import { describe, expect, it } from "vitest";
import { cpfValido, limparCpf, mascararCpf, miolo } from "@/lib/cpf";

describe("CPF", () => {
  it("valida os dígitos verificadores, com ou sem pontuação", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("529.982.247-26")).toBe(false);
    expect(cpfValido("123")).toBe(false);
  });

  it("recusa os números repetidos, que passam na conta", () => {
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
  });

  it("mascara deixando só os 6 dígitos do meio, como a Receita mostra dos sócios", () => {
    expect(mascararCpf("529.982.247-25")).toBe("***.982.247-**");
    expect(limparCpf("***.982.247-**")).toBe("982247");
  });

  it("lê os 6 dígitos do meio dos dois formatos", () => {
    expect(miolo("***.982.247-**")).toBe("982247");
    expect(miolo("***982247**")).toBe("982247");
    expect(miolo("52998224725")).toBeNull();
    expect(miolo(null)).toBeNull();
  });
});
