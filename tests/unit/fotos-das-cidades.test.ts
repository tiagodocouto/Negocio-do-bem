import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { slugCidade } from "@/lib/diretorio";
import dados from "@/lib/fotos-das-cidades.json";
import { fotoDaCidade, licencaAceita, paginaNoCommons, type FotoGravada } from "@/lib/fotos-das-cidades";
import { nomeOficial } from "@/lib/municipios";

const LISTA = Object.entries(dados as Record<string, FotoGravada>);

describe("licencaAceita", () => {
  it("aceita domínio público, CC0, CC BY e CC BY-SA", () => {
    for (const licenca of ["Public domain", "CC0", "CC BY 2.0", "CC BY-SA 3.0", "CC BY-SA 4.0", "CC BY-SA 3.0 br"]) {
      expect(licencaAceita(licenca), licenca).toBe(true);
    }
  });

  it("recusa as outras, que pedem mais do que o crédito", () => {
    for (const licenca of ["GFDL", "CC BY-NC 2.0", "CC BY-ND 4.0", "Copyrighted", ""]) {
      expect(licencaAceita(licenca), licenca).toBe(false);
    }
  });
});

describe("paginaNoCommons", () => {
  it("leva à página do arquivo, com espaços e acentos no formato do endereço", () => {
    expect(paginaNoCommons("File:Farol da Barra, Salvador.jpg")).toBe(
      "https://commons.wikimedia.org/wiki/File:Farol_da_Barra%2C_Salvador.jpg",
    );
    expect(paginaNoCommons("File:Ponte Hercílio Luz.jpg")).toBe("https://commons.wikimedia.org/wiki/File:Ponte_Herc%C3%ADlio_Luz.jpg");
  });
});

describe("fotoDaCidade", () => {
  it("é null para a cidade sem foto", () => {
    expect(fotoDaCidade("Cidade Que Não Existe", "SP")).toBeNull();
  });

  it("acha a foto pelo nome com ou sem acento, e monta os dois tamanhos, a prévia e a página no Commons", () => {
    const [slug, gravada] = LISTA[0]!;
    const foto = fotoDaCidade(gravada.cidade.normalize("NFD").replace(/\p{M}/gu, ""), gravada.uf);
    expect(foto).toMatchObject({
      src: `/fotos/cidades/${gravada.foto}.jpg`,
      srcPequena: `/fotos/cidades/${gravada.foto}-800.jpg`,
      previa: `/fotos/cidades/${gravada.previa}.jpg`,
      alt: gravada.descricao,
      pagina: paginaNoCommons(gravada.arquivo),
    });
    expect(gravada.foto.startsWith(`${slug}-`)).toBe(true);
  });
});

// A lista é escrita à mão e completada pelo npm run cidades:fotos: confere o que
// a página e o crédito precisam.
describe.each(LISTA)("fotos-das-cidades.json: %s", (slug, gravada) => {
  it("é de uma cidade do IBGE, no endereço da página dela", () => {
    expect(nomeOficial(gravada.cidade, gravada.uf)).toBe(gravada.cidade);
    expect(slugCidade(gravada.cidade, gravada.uf)).toBe(slug);
  });

  it("tem crédito, licença aceita e texto alternativo", () => {
    expect(gravada.autor.trim()).not.toBe("");
    expect(licencaAceita(gravada.licenca)).toBe(true);
    expect(gravada.descricao.trim()).not.toBe("");
    expect(gravada.arquivo).toMatch(/^File:/);
  });

  it("é horizontal e está em public/fotos/cidades nos dois tamanhos, com a prévia do link", () => {
    expect(gravada.largura / gravada.altura).toBeGreaterThanOrEqual(1.3);
    expect(gravada.previa.startsWith(`${slug}-previa-`)).toBe(true);
    for (const arquivo of [`${gravada.foto}.jpg`, `${gravada.foto}-800.jpg`, `${gravada.previa}.jpg`]) {
      expect(existsSync(path.join(process.cwd(), "public/fotos/cidades", arquivo)), arquivo).toBe(true);
    }
  });

  it("tem a prévia do link abaixo de 300 KB, longe do limite de 600 KB do WhatsApp", () => {
    expect(statSync(path.join(process.cwd(), "public/fotos/cidades", `${gravada.previa}.jpg`)).size).toBeLessThan(300 * 1024);
  });
});
