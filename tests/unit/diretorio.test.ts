import { describe, expect, it } from "vitest";
import {
  categoriaDoSlug,
  hrefCausa,
  hrefCidade,
  hrefDiretorio,
  hrefTipo,
  interpretarLocal,
  lerFiltros,
  mudarFiltro,
  SEM_FILTROS,
  slugCategoria,
  slugCidade,
  sugerirLocais,
  temPaginaDeTipo,
  tituloDoDiretorio,
  tituloDoTipo,
  type CidadeComNegocios,
} from "@/lib/diretorio";

const CIDADES: CidadeComNegocios[] = [
  { cidade: "Recife", uf: "PE", total: 2 },
  { cidade: "Santa Maria", uf: "RN", total: 1 },
  { cidade: "Santa Maria", uf: "RS", total: 1 },
  { cidade: "São Paulo", uf: "SP", total: 3 },
];

function paramsDe(href: string) {
  const params: Record<string, string[]> = {};
  new URL(href, "https://exemplo.com").searchParams.forEach((valor, chave) => {
    (params[chave] ??= []).push(valor);
  });
  return params;
}

describe("lerFiltros", () => {
  it("lê os filtros da URL e descarta o que não existe", () => {
    expect(
      lerFiltros({
        q: " brechó ",
        onde: "Recife, PE",
        tipo: ["moda-e-acessorios", "cafe-e-padaria", "nao-existe"],
        causa: ["sustentavel", "inventada"],
        verificados: "sim",
        ordem: "az",
        vista: "lista",
        pagina: "3",
      }),
    ).toEqual({
      q: "brechó",
      onde: "Recife, PE",
      // Na ordem da lista oficial de categorias.
      tipos: ["Café e padaria", "Moda e acessórios"],
      causas: ["sustentavel"],
      verificados: true,
      ordem: "az",
      vista: "lista",
      pagina: 3,
    });
  });

  it("usa o padrão para valores inválidos", () => {
    expect(lerFiltros({ ordem: "aleatoria", vista: "mosaico", pagina: "-2" })).toEqual(SEM_FILTROS);
    expect(lerFiltros({ pagina: "9999" }).pagina).toBe(500);
  });

  it("não aceita chaves do protótipo como ordem", () => {
    for (const ordem of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(lerFiltros({ ordem }).ordem).toBe("verificados");
    }
  });

  it("entende o ?uf= dos links antigos", () => {
    expect(lerFiltros({ uf: "pe" }).onde).toBe("Pernambuco (estado)");
    expect(lerFiltros({ uf: "XX" }).onde).toBe("");
  });
});

describe("hrefDiretorio", () => {
  it("sem filtros é só /explorar", () => {
    expect(hrefDiretorio()).toBe("/explorar");
    expect(hrefDiretorio(SEM_FILTROS)).toBe("/explorar");
  });

  it("leva para a URL só o que foge do padrão, e volta igual pelo lerFiltros", () => {
    const filtros = { ...SEM_FILTROS, q: "pão", tipos: ["Café e padaria"], causas: ["antirracista"], verificados: true, pagina: 2 };
    const href = hrefDiretorio(filtros);
    expect(href).toBe("/explorar?q=p%C3%A3o&tipo=cafe-e-padaria&causa=antirracista&verificados=sim&pagina=2");
    expect(lerFiltros(paramsDe(href))).toEqual(filtros);
  });

  it("mudar um filtro volta para a primeira página", () => {
    expect(mudarFiltro({ ...SEM_FILTROS, pagina: 4 }, { vista: "lista" })).toBe("/explorar?vista=lista");
  });

  it("gera o slug da categoria sem acentos", () => {
    expect(slugCategoria("Café e padaria")).toBe("cafe-e-padaria");
    expect(slugCategoria("Turismo e hospedagem")).toBe("turismo-e-hospedagem");
  });
});

describe("interpretarLocal", () => {
  it("entende um estado pela sigla ou pelo nome", () => {
    const pernambuco = { uf: "PE", rotulo: "Pernambuco" };
    expect(interpretarLocal("pe", CIDADES)).toEqual(pernambuco);
    expect(interpretarLocal("Pernambuco", CIDADES)).toEqual(pernambuco);
    expect(interpretarLocal("Pernambuco (estado)", CIDADES)).toEqual(pernambuco);
  });

  it("um nome de estado e de cidade vale como estado; com a UF, vale a cidade", () => {
    expect(interpretarLocal("sao paulo", CIDADES)).toEqual({ uf: "SP", rotulo: "São Paulo" });
    expect(interpretarLocal("São Paulo, SP", CIDADES)).toEqual({ cidade: "São Paulo", uf: "SP", rotulo: "São Paulo, SP" });
  });

  it("um nome de cidade que termina com uma sigla de UF vale como cidade", () => {
    const cidades = [...CIDADES, { cidade: "Sento Sé", uf: "BA", total: 1 }];
    const sentoSe = { cidade: "Sento Sé", uf: "BA", rotulo: "Sento Sé, BA" };
    expect(interpretarLocal("Sento Sé", cidades)).toEqual(sentoSe);
    expect(interpretarLocal("sento se", cidades)).toEqual(sentoSe);
    expect(interpretarLocal("Sento Sé, BA", cidades)).toEqual(sentoSe);
  });

  it("acha a cidade só pelo nome, com o nome escrito como no cadastro", () => {
    expect(interpretarLocal("RECIFE", CIDADES)).toEqual({ cidade: "Recife", uf: "PE", rotulo: "Recife, PE" });
  });

  it("um nome de cidade em vários estados vale para todos eles", () => {
    expect(interpretarLocal("santa maria", CIDADES)).toEqual({ cidade: "Santa Maria", rotulo: "Santa Maria" });
  });

  it("um lugar sem negócios volta como foi escrito", () => {
    expect(interpretarLocal("Olinda, PE", CIDADES)).toEqual({ cidade: "Olinda", uf: "PE", rotulo: "Olinda, PE" });
    expect(interpretarLocal("Lugar Nenhum", CIDADES)).toEqual({ cidade: "Lugar Nenhum", rotulo: "Lugar Nenhum" });
    expect(interpretarLocal("  ", CIDADES)).toBeNull();
  });
});

describe("sugerirLocais", () => {
  it("sem texto, mostra todo o Brasil e as cidades com mais negócios", () => {
    const sugestoes = sugerirLocais("", CIDADES);
    expect(sugestoes[0]).toEqual({ valor: "", nome: "Todo o Brasil", detalhe: "", total: 7, tipo: "brasil" });
    expect(sugestoes.slice(1).map((s) => s.valor)).toEqual(["São Paulo, SP", "Recife, PE", "Santa Maria, RN", "Santa Maria, RS"]);
  });

  it("com texto, mostra estados e cidades, a cidade antes do estado de mesmo nome", () => {
    const sugestoes = sugerirLocais("sao p", CIDADES);
    expect(sugestoes.map((s) => s.valor)).toEqual(["São Paulo, SP", "São Paulo (estado)"]);
    expect(sugestoes[1]).toMatchObject({ detalhe: "todo o estado", total: 3 });
  });

  it("acha o estado pela sigla", () => {
    expect(sugerirLocais("rs", CIDADES)[0]).toMatchObject({ valor: "Rio Grande do Sul (estado)", total: 1 });
  });
});

describe("tituloDoDiretorio", () => {
  it("descreve a busca", () => {
    expect(tituloDoDiretorio(SEM_FILTROS, null)).toBe("Todos os negócios");
    expect(tituloDoDiretorio({ ...SEM_FILTROS, tipos: ["Pet"] }, { cidade: "Recife", uf: "PE", rotulo: "Recife, PE" })).toBe("Pet em Recife");
    expect(tituloDoDiretorio({ ...SEM_FILTROS, q: "brechó" }, { uf: "PE", rotulo: "Pernambuco" })).toBe("Resultados para “brechó” em Pernambuco");
    expect(tituloDoDiretorio({ ...SEM_FILTROS, causas: ["acessivel"] }, null)).toBe("Acessível");
    expect(tituloDoDiretorio({ ...SEM_FILTROS, tipos: ["Pet", "Saúde"] }, null)).toBe("Negócios do bem");
  });
});

describe("páginas de cidade, causa e tipo", () => {
  it("dá o mesmo endereço para grafias diferentes da mesma cidade", () => {
    expect(slugCidade("São Paulo", "SP")).toBe("sao-paulo-sp");
    expect(slugCidade("Sao Paulo", "sp")).toBe("sao-paulo-sp");
    expect(hrefCidade("Santa Bárbara d'Oeste", "SP")).toBe("/cidades/santa-barbara-d-oeste-sp");
    // A UF separa cidades com o mesmo nome.
    expect(slugCidade("Santa Maria", "RS")).not.toBe(slugCidade("Santa Maria", "RN"));
  });

  it("monta os endereços de causa e tipo", () => {
    expect(hrefCausa("opcoes-veganas")).toBe("/causas/opcoes-veganas");
    expect(hrefTipo("Café e padaria")).toBe("/tipos/cafe-e-padaria");
    expect(tituloDoTipo("Café e padaria")).toBe("Negócios de café e padaria");
  });

  it("não tem página para \"Outros\" nem para tipos que não existem", () => {
    expect(categoriaDoSlug("cafe-e-padaria")).toBe("Café e padaria");
    expect(categoriaDoSlug("outros")).toBeUndefined();
    expect(categoriaDoSlug("constructor")).toBeUndefined();
    expect(temPaginaDeTipo("Outros")).toBe(false);
    expect(temPaginaDeTipo("Categoria antiga")).toBe(false);
  });
});
