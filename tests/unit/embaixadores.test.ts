import { describe, expect, it } from "vitest";
import {
  destinoDoEmbaixador,
  embaixadoresDaCidade,
  formatarSeguidores,
  hrefDoEmbaixador,
  lerEmbaixador,
  lugarDoEmbaixador,
  ondeDoEmbaixador,
  tituloComLugar,
  tituloNaCidade,
} from "@/lib/embaixadores";

function formulario(campos: Record<string, string>): FormData {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

const BASICO = { instagram: "@Marina.Lopes", nome: " Marina Lopes ", titulo: "embaixadora", ordem: "2", naInicial: "sim", ativo: "sim" };

describe("formatarSeguidores", () => {
  it("mostra o número inteiro abaixo de 10 mil", () => {
    expect(formatarSeguidores(8940)).toBe("8.940");
    expect(formatarSeguidores(0)).toBe("0");
  });

  it("arredonda para baixo em mil e em milhão, com uma casa abaixo de 100", () => {
    expect(formatarSeguidores(10_000)).toBe("10 mil");
    expect(formatarSeguidores(48_231)).toBe("48,2 mil");
    expect(formatarSeguidores(48_300)).toBe("48,3 mil");
    expect(formatarSeguidores(48_999)).toBe("48,9 mil");
    expect(formatarSeguidores(64_018)).toBe("64 mil");
    expect(formatarSeguidores(131_204)).toBe("131 mil");
    expect(formatarSeguidores(999_999)).toBe("999 mil");
    expect(formatarSeguidores(1_250_000)).toBe("1,2 mi");
    expect(formatarSeguidores(120_000_000)).toBe("120 mi");
  });
});

describe("lugar e título", () => {
  it("diz a cidade ou o estado inteiro", () => {
    expect(lugarDoEmbaixador({ cidade: "Salvador", uf: "BA" })).toBe("Salvador, BA");
    expect(lugarDoEmbaixador({ cidade: null, uf: "BA" })).toBe("Bahia (todo o estado)");
  });

  it("usa como a pessoa quer ser chamada", () => {
    expect(tituloNaCidade({ titulo: "embaixadora", cidade: "Salvador" })).toBe("Embaixadora em Salvador");
    expect(tituloNaCidade({ titulo: "embaixador", cidade: null })).toBe("Embaixador de todo o estado");
    expect(tituloNaCidade({ titulo: "pessoa-embaixadora", cidade: "Recife" })).toBe("Pessoa embaixadora em Recife");
    expect(tituloNaCidade({ titulo: "outro", cidade: "Recife" })).toBe("Embaixadora em Recife");
  });

  it("dá à página do embaixador o rótulo, o link pelo @ e a região dos negócios", () => {
    expect(tituloComLugar({ titulo: "embaixadora", cidade: "Curitiba", uf: "PR" })).toBe("Embaixadora do bem · Curitiba, PR");
    expect(tituloComLugar({ titulo: "embaixador", cidade: null, uf: "PA" })).toBe("Embaixador do bem · Pará (todo o estado)");
    expect(hrefDoEmbaixador("alodiario_literario")).toBe("/embaixadores/alodiario_literario");
    expect(ondeDoEmbaixador({ cidade: "Curitiba", uf: "PR" })).toBe("Curitiba, PR");
    expect(ondeDoEmbaixador({ cidade: null, uf: "PA" })).toBe("Pará (estado)");
  });
});

describe("destinoDoEmbaixador", () => {
  const cidades = [
    { cidade: "Salvador", uf: "BA", total: 23 },
    { cidade: "Feira de Santana", uf: "BA", total: 1 },
    { cidade: "Recife", uf: "PE", total: 14 },
  ];

  it("leva para a página da cidade, com quantos negócios há lá", () => {
    expect(destinoDoEmbaixador({ cidade: "Salvador", uf: "BA" }, cidades)).toEqual({ href: "/cidades/salvador-ba", detalhe: "23 negócios do bem" });
    expect(destinoDoEmbaixador({ cidade: "Feira de Santana", uf: "BA" }, cidades).detalhe).toBe("1 negócio do bem");
  });

  it("quem cobre o estado leva para o diretório filtrado pelo estado", () => {
    expect(destinoDoEmbaixador({ cidade: null, uf: "BA" }, cidades)).toEqual({
      href: "/explorar?onde=Bahia+%28estado%29",
      detalhe: "24 negócios no estado",
    });
  });

  it("sem negócios lá, leva para indicar o primeiro", () => {
    const indicar = { href: "/participar", detalhe: "Indique o primeiro negócio" };
    expect(destinoDoEmbaixador({ cidade: "Lauro de Freitas", uf: "BA" }, cidades)).toEqual(indicar);
    expect(destinoDoEmbaixador({ cidade: "Salvador", uf: "SE" }, cidades)).toEqual(indicar);
    expect(destinoDoEmbaixador({ cidade: null, uf: "SP" }, cidades)).toEqual(indicar);
  });
});

describe("embaixadoresDaCidade", () => {
  it("põe quem cobre a cidade antes de quem cobre o estado, e ignora o resto", () => {
    const lista = [
      { nome: "Estado", cidade: null, uf: "BA" },
      { nome: "Outra cidade", cidade: "Feira de Santana", uf: "BA" },
      { nome: "Cidade", cidade: "Salvador", uf: "BA" },
      { nome: "Outro estado", cidade: null, uf: "PE" },
    ];
    expect(embaixadoresDaCidade(lista, "Salvador", "BA").map((e) => e.nome)).toEqual(["Cidade", "Estado"]);
  });
});

describe("lerEmbaixador", () => {
  it("lê quem cobre uma cidade, com o @ e a cidade como no resto do site", () => {
    const lido = lerEmbaixador(formulario({ ...BASICO, abrangencia: "cidade", municipio: "salvador, ba" }));
    expect(lido).toEqual({
      dados: {
        instagramUsername: "marina.lopes",
        nome: "Marina Lopes",
        titulo: "embaixadora",
        sobre: null,
        cidade: "Salvador",
        uf: "BA",
        seguidoresManual: false,
        seguidores: null,
        ordem: 2,
        naInicial: true,
        ativo: true,
      },
    });
  });

  it("lê quem cobre o estado, sem cidade", () => {
    const lido = lerEmbaixador(formulario({ ...BASICO, abrangencia: "estado", uf: "PE", municipio: "Salvador, BA" }));
    expect(lido).toMatchObject({ dados: { cidade: null, uf: "PE" } });
  });

  it("lê os seguidores digitados à mão, com ponto ou espaço", () => {
    const lido = lerEmbaixador(formulario({ ...BASICO, abrangencia: "estado", uf: "PE", seguidoresManual: "sim", seguidores: "48.231" }));
    expect(lido).toMatchObject({ dados: { seguidoresManual: true, seguidores: 48231 } });
  });

  it("desmarcado, fica fora da página inicial e do site", () => {
    const dados = formulario({ ...BASICO, abrangencia: "estado", uf: "PE" });
    dados.delete("naInicial");
    dados.delete("ativo");
    expect(lerEmbaixador(dados)).toMatchObject({
      dados: { naInicial: false, ativo: false },
    });
  });

  it("devolve todos os erros de uma vez, por campo", () => {
    const lido = lerEmbaixador(
      formulario({ instagram: "não é @", nome: "M", titulo: "rainha", ordem: "-1", abrangencia: "cidade", municipio: "Cidade Inventada, ZZ", seguidoresManual: "sim", seguidores: "" }),
    );
    expect("erros" in lido && Object.keys(lido.erros).sort()).toEqual(["instagram", "municipio", "nome", "ordem", "seguidores", "titulo"]);
  });

  it("lê o Sobre sem espaços sobrando, e vazio fica sem texto", () => {
    const sobre = "  Clássicos e mitologia.\r\n\r\n\r\n\r\nProfessora e pesquisadora.  ";
    expect(lerEmbaixador(formulario({ ...BASICO, abrangencia: "estado", uf: "PR", sobre }))).toMatchObject({
      dados: { sobre: "Clássicos e mitologia.\n\nProfessora e pesquisadora." },
    });
    expect(lerEmbaixador(formulario({ ...BASICO, abrangencia: "estado", uf: "PR", sobre: "  \n " }))).toMatchObject({ dados: { sobre: null } });
    expect(lerEmbaixador(formulario({ ...BASICO, abrangencia: "estado", uf: "PR", sobre: "a".repeat(601) }))).toEqual({
      erros: { sobre: "Use até 600 caracteres." },
    });
  });

  it("quem cobre o estado precisa escolher um estado", () => {
    expect(lerEmbaixador(formulario({ ...BASICO, abrangencia: "estado", uf: "XX" }))).toEqual({ erros: { uf: "Escolha o estado." } });
  });
});
