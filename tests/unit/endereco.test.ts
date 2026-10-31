import { describe, expect, it } from "vitest";
import { ehEnderecoSemInstagram, enderecoLivre, enderecoSemInstagram, rotuloDoInstagram, temInstagram } from "@/lib/endereco";
import { normalizarEndereco, normalizarUsername } from "@/lib/instagram";

describe("enderecoSemInstagram", () => {
  it("junta o nome e a cidade, sem acento e com hífen", () => {
    expect(enderecoSemInstagram("Padaria do Bairro", "Recife")).toBe("padaria-do-bairro-recife");
    expect(enderecoSemInstagram("Açaí & Cia.", "São José dos Campos")).toBe("acai-cia-sao-jose-dos-campos");
  });

  it("sempre tem hífen, mesmo com o nome de uma palavra só", () => {
    expect(enderecoSemInstagram("Padoca", "Recife")).toBe("padoca-recife");
    expect(enderecoSemInstagram("!!!", "Recife")).toBe("negocio-recife");
  });

  it("nunca vale como @ do Instagram, então não se confunde com um", () => {
    const endereco = enderecoSemInstagram("Padoca", "Recife");
    expect(normalizarUsername(endereco)).toBeNull();
    expect(temInstagram(endereco)).toBe(false);
  });

  it("corta nomes compridos sem deixar hífen sobrando", () => {
    const endereco = enderecoSemInstagram("Associação dos Produtores Orgânicos e Agroecológicos do Vale", "Recife");
    expect(endereco.length).toBeLessThanOrEqual(80);
    expect(endereco).not.toMatch(/--/);
    expect(ehEnderecoSemInstagram(endereco)).toBe(true);
  });
});

describe("enderecoLivre", () => {
  it("usa o próprio endereço quando está livre", () => {
    expect(enderecoLivre("padoca-recife", ["outra-recife"])).toBe("padoca-recife");
  });

  it("acrescenta -2, -3… quando outro negócio já usa", () => {
    expect(enderecoLivre("padoca-recife", ["padoca-recife"])).toBe("padoca-recife-2");
    expect(enderecoLivre("padoca-recife", ["padoca-recife", "padoca-recife-2"])).toBe("padoca-recife-3");
  });
});

describe("normalizarEndereco", () => {
  it("aceita o @ do Instagram, como antes", () => {
    expect(normalizarEndereco("Padaria.Flor")).toBe("padaria.flor");
  });

  it("aceita o endereço de um negócio sem Instagram", () => {
    expect(normalizarEndereco("padoca-recife")).toBe("padoca-recife");
  });

  it("recusa o que não é nenhum dos dois", () => {
    expect(normalizarEndereco("Padoca-Recife")).toBeNull();
    expect(normalizarEndereco("padoca--recife")).toBeNull();
    expect(normalizarEndereco("-padoca")).toBeNull();
    expect(normalizarEndereco("../padoca")).toBeNull();
  });
});

describe("rotuloDoInstagram", () => {
  it("mostra o @ ou avisa que o negócio não tem Instagram", () => {
    expect(rotuloDoInstagram("padaria.flor")).toBe("@padaria.flor");
    expect(rotuloDoInstagram("padoca-recife")).toBe("sem Instagram");
  });
});
