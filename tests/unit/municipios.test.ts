import { describe, expect, it } from "vitest";
import { campoMunicipio } from "@/lib/formulario";
import { conferirMunicipio, interpretarMunicipio, nomeOficial, sugerirMunicipios } from "@/lib/municipios";

describe("interpretarMunicipio", () => {
  it("acha a cidade sem diferenciar acentos e maiúsculas", () => {
    expect(interpretarMunicipio("sao joao del rei")).toEqual([{ nome: "São João del Rei", uf: "MG" }]);
    expect(interpretarMunicipio("  FLORIANOPOLIS ")).toEqual([{ nome: "Florianópolis", uf: "SC" }]);
  });

  it("aceita a UF depois do nome, como o campo preenche ou digitada à mão", () => {
    const recife = [{ nome: "Recife", uf: "PE" }];
    expect(interpretarMunicipio("Recife, PE")).toEqual(recife);
    expect(interpretarMunicipio("recife/pe")).toEqual(recife);
    expect(interpretarMunicipio("Recife - PE")).toEqual(recife);
    expect(interpretarMunicipio("recife pe")).toEqual(recife);
  });

  it("devolve todas as cidades com o mesmo nome quando falta a UF", () => {
    expect(interpretarMunicipio("Santa Maria").map((m) => m.uf).sort()).toEqual(["RN", "RS"]);
    expect(interpretarMunicipio("Santa Maria, RS")).toEqual([{ nome: "Santa Maria", uf: "RS" }]);
  });

  it("não confunde o fim do nome com uma UF", () => {
    // "Sé" também é a sigla de Sergipe, mas Sento Sé fica na Bahia.
    expect(interpretarMunicipio("Sento Sé")).toEqual([{ nome: "Sento Sé", uf: "BA" }]);
    expect(interpretarMunicipio("Ji-Paraná")).toEqual([{ nome: "Ji-Paraná", uf: "RO" }]);
  });

  it("não acha cidade escrita errado ou na UF errada", () => {
    expect(interpretarMunicipio("Belo Horizone")).toEqual([]);
    expect(interpretarMunicipio("Recife, SP")).toEqual([]);
  });
});

describe("sugerirMunicipios", () => {
  it("mostra primeiro os nomes que começam com o texto", () => {
    const sugestoes = sugerirMunicipios("campinas");
    expect(sugestoes[0]).toMatchObject({ nome: "Campinas", uf: "SP" });
    expect(sugestoes.slice(1).every((s) => s.nome.startsWith("Campinas "))).toBe(true);
  });

  it("marca o trecho encontrado no nome com acento", () => {
    const [sao] = sugerirMunicipios("sao paulo");
    expect(sao).toMatchObject({ nome: "São Paulo", uf: "SP" });
    expect(sao!.nome.slice(sao!.inicio, sao!.fim)).toBe("São Paulo");
  });

  it("acha pelo começo de uma palavra do meio", () => {
    expect(sugerirMunicipios("del rei").map((s) => s.nome)).toContain("São João del Rei");
  });

  it("mostra a mesma cidade em estados diferentes", () => {
    const ufs = sugerirMunicipios("bom jesus").filter((s) => s.nome === "Bom Jesus").map((s) => s.uf);
    expect(ufs.length).toBeGreaterThan(1);
  });

  it("filtra pela UF quando o texto já tem a cidade escolhida", () => {
    expect(sugerirMunicipios("Santa Maria, RN")).toEqual([{ nome: "Santa Maria", uf: "RN", inicio: 0, fim: 11 }]);
  });

  it("espera pelo menos duas letras e respeita o limite", () => {
    expect(sugerirMunicipios("s")).toEqual([]);
    expect(sugerirMunicipios("sa", 5)).toHaveLength(5);
  });
});

describe("conferirMunicipio e campoMunicipio", () => {
  it("devolve o nome oficial da cidade", () => {
    expect(conferirMunicipio("sao paulo, sp")).toEqual({ municipio: { nome: "São Paulo", uf: "SP" } });
    expect(campoMunicipio.parse("niteroi")).toEqual({ nome: "Niterói", uf: "RJ" });
  });

  it("explica o que fazer quando a cidade está vazia, é ambígua ou não existe", () => {
    expect(conferirMunicipio("")).toEqual({ erro: "Em que cidade fica? Digite e escolha na lista." });
    expect(conferirMunicipio("Bom Jesus")).toEqual({
      erro: "Existe mais de uma cidade chamada Bom Jesus. Escolha na lista a do estado certo.",
    });
    expect(conferirMunicipio("Sao Paolo")).toEqual({ erro: "Escolha a cidade na lista. Se ela não aparecer, confira a grafia." });
    expect(campoMunicipio.safeParse("Sao Paolo").success).toBe(false);
  });
});

describe("nomeOficial", () => {
  it("devolve o nome da lista para uma cidade gravada com outra grafia", () => {
    expect(nomeOficial("Florianopolis", "SC")).toBe("Florianópolis");
    expect(nomeOficial(" SAO  PAULO ", "SP")).toBe("São Paulo");
    expect(nomeOficial("Recife", "PE")).toBe("Recife");
  });

  it("não diferencia hífen e apóstrofo, e aceita a UF da cidade no fim", () => {
    expect(nomeOficial("São João del-Rei", "MG")).toBe("São João del Rei");
    expect(nomeOficial("Santa Bárbara d’Oeste", "SP")).toBe("Santa Bárbara d'Oeste");
    expect(nomeOficial("Tubarão-SC", "SC")).toBe("Tubarão");
    expect(nomeOficial("Salto/SP", "SP")).toBe("Salto");
    // A UF no fim só sai quando é a da própria cidade.
    expect(nomeOficial("Salto-RJ", "SP")).toBeNull();
  });

  it("é null fora da lista ou na UF errada", () => {
    expect(nomeOficial("Sampa", "SP")).toBeNull();
    expect(nomeOficial("Recife", "SP")).toBeNull();
  });
});
