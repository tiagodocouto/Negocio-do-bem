import { describe, expect, it } from "vitest";
import { lerPreenchimento, semContatosDeTerceiros } from "@/lib/indicacao";
import { lerRascunho } from "@/lib/rascunho-do-cadastro";

describe("lerPreenchimento", () => {
  it("abre com o @ e com \"Este negócio é meu\" marcado", () => {
    expect(lerPreenchimento({ instagram: "padaria.flor", dono: "sim" })).toEqual({ instagram: "padaria.flor", souDono: true });
  });

  it("normaliza o @ como o resto do site", () => {
    expect(lerPreenchimento({ instagram: "@Padaria.Flor" }).instagram).toBe("padaria.flor");
    expect(lerPreenchimento({ instagram: "https://www.instagram.com/padaria.flor/" }).instagram).toBe("padaria.flor");
  });

  it("deixa vazio o @ que não é válido e só marca com dono=sim", () => {
    expect(lerPreenchimento({ instagram: "não é um @", dono: "talvez" })).toEqual({ instagram: "", souDono: false });
  });

  it("sem nada na URL, o formulário abre como antes", () => {
    expect(lerPreenchimento({})).toEqual({ instagram: "", souDono: false });
  });

  it("com o parâmetro repetido, vale o primeiro", () => {
    expect(lerPreenchimento({ instagram: ["um.negocio", "outro"], dono: ["sim", "nao"] })).toEqual({
      instagram: "um.negocio",
      souDono: true,
    });
  });
});

describe("lerRascunho", () => {
  it("guarda só os campos conhecidos, em texto e no tamanho de cada um", () => {
    expect(
      lerRascunho({
        instagram: "padaria.flor",
        nome: "x".repeat(200),
        souDono: "sim",
        causas: ["sustentavel", "<script>", 3],
        senha: "não guarda",
        resumo: 42,
      }),
    ).toEqual({ instagram: "padaria.flor", nome: "x".repeat(80), souDono: "sim", causas: ["sustentavel"] });
  });

  it("sem nenhum campo, não há rascunho", () => {
    expect(lerRascunho({})).toBeNull();
    expect(lerRascunho({ nome: "   " })).toBeNull();
    expect(lerRascunho(null)).toBeNull();
    expect(lerRascunho("texto")).toBeNull();
    expect(lerRascunho(["nome"])).toBeNull();
  });
});

describe("semContatosDeTerceiros", () => {
  const campos = {
    nome: "Padaria",
    site: "https://padaria.com.br",
    whatsapp: "5581999990000",
    emailContato: "ola@padaria.com.br",
    telefoneComercial: "558133334444",
    emailDoDono: "ana@exemplo.com",
    telefoneDoDono: "5581988887777",
  };

  it("quem indica não publica contatos nem deixa contato de dono", () => {
    expect(semContatosDeTerceiros(campos, false)).toEqual({
      nome: "Padaria",
      site: null,
      whatsapp: null,
      emailContato: null,
      telefoneComercial: null,
      emailDoDono: null,
      telefoneDoDono: null,
    });
  });

  it("o dono publica os contatos que informou", () => {
    expect(semContatosDeTerceiros(campos, true)).toEqual(campos);
  });
});
