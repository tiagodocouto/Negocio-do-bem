import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonLdDaVitrine, jsonLdDoNegocio, metadadosDaPagina, paginaDaCidade } from "@/lib/seo";
import { CORES_DA_MARCA, svgDoLogo } from "@/lib/marca";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function seoCom(variaveis: Record<string, string>) {
  for (const [nome, valor] of Object.entries(variaveis)) vi.stubEnv(nome, valor);
  vi.resetModules();
  return import("@/lib/seo");
}

const NEGOCIO = {
  instagramUsername: "padaria.florescer",
  nome: "Padaria Florescer",
  resumo: "Pão de fermentação natural.",
  categoria: "Café e padaria",
  cidade: "Recife",
  uf: "PE",
  fotoUrl: null,
  site: null,
  whatsapp: null,
  emailContato: null,
  telefoneComercial: null,
};

describe("endereço do site", () => {
  it("no Vercel usa o domínio de produção, até nos previews", async () => {
    const seo = await seoCom({ VERCEL_PROJECT_PRODUCTION_URL: "negociodobem.com.br", VERCEL_ENV: "preview", APP_URL: "https://outro.exemplo" });
    expect(seo.ENDERECO_DO_SITE).toBe("https://negociodobem.com.br");
    expect(seo.urlAbsoluta("/empresas/x")).toBe("https://negociodobem.com.br/empresas/x");
    // Preview não entra nos buscadores.
    expect(seo.INDEXAVEL).toBe(false);
  });

  it("fora do Vercel usa o APP_URL, sem a barra do final", async () => {
    const seo = await seoCom({ VERCEL_PROJECT_PRODUCTION_URL: "", VERCEL_ENV: "", APP_URL: "https://meusite.exemplo/" });
    expect(seo.ENDERECO_DO_SITE).toBe("https://meusite.exemplo");
  });
});

describe("metadadosDaPagina", () => {
  it("repete o nome do site e o idioma no openGraph, que substitui o do layout", () => {
    const m = metadadosDaPagina({ titulo: "Explorar negócios", descricao: "Busque.", caminho: "/explorar" });
    expect(m.alternates).toEqual({ canonical: "/explorar" });
    expect(m.openGraph).toMatchObject({ siteName: "Negócio do Bem", locale: "pt_BR", title: "Explorar negócios", url: "/explorar" });
  });
});

describe("jsonLdDoNegocio", () => {
  const ficha = (dados: object) => jsonLdDoNegocio({ ...NEGOCIO, ...dados }, ["Liderado por mulheres"])["@graph"][0] as Record<string, unknown>;

  it("leva só os contatos preenchidos", () => {
    const vazia = ficha({});
    expect(vazia).not.toHaveProperty("telephone");
    expect(vazia).not.toHaveProperty("email");
    expect(vazia).not.toHaveProperty("image");
    expect(vazia.sameAs).toEqual(["https://www.instagram.com/padaria.florescer/"]);
    expect(vazia.keywords).toBe("Café e padaria, Liderado por mulheres");

    const completa = ficha({ whatsapp: "5581999990000", emailContato: "oi@padaria.exemplo", site: "https://padaria.exemplo" });
    expect(completa).toMatchObject({ telephone: "+5581999990000", email: "oi@padaria.exemplo" });
    expect(completa.sameAs).toContain("https://padaria.exemplo");
  });

  it("prefere o telefone comercial ao WhatsApp", () => {
    expect(ficha({ whatsapp: "5581999990000", telefoneComercial: "558133334444" }).telephone).toBe("+558133334444");
  });

  it("negócio sem Instagram não aponta para o Instagram", () => {
    expect(ficha({ instagramUsername: "padaria-florescer-recife" }).sameAs).toEqual([]);
    expect(ficha({ instagramUsername: "padaria-florescer-recife", site: "https://padaria.exemplo" }).sameAs).toEqual([
      "https://padaria.exemplo",
    ]);
  });

  it("só usa fotos guardadas pelo site", () => {
    expect(ficha({ fotoUrl: "https://abc.public.blob.vercel-storage.com/perfis/x.jpg" }).image).toBe(
      "https://abc.public.blob.vercel-storage.com/perfis/x.jpg",
    );
    expect(ficha({ fotoUrl: "https://outro-site.exemplo/foto.jpg" })).not.toHaveProperty("image");
  });

  it("não deixa o texto do negócio fechar a tag do script", async () => {
    const { JsonLd } = await import("@/components/JsonLd");
    const html = JsonLd({ dados: ficha({ resumo: "</script><script>alert(1)</script>" }) }).props.dangerouslySetInnerHTML.__html;
    expect(html).not.toContain("</script>");
  });
});

describe("caminho até as páginas", () => {
  const nomes = (dados: { "@graph": object[] }) =>
    (dados["@graph"][1] as { itemListElement: { name: string; item: string }[] }).itemListElement.map((i) => [i.name, new URL(i.item).pathname]);

  it("a página da cidade de um negócio usa o nome oficial", () => {
    expect(paginaDaCidade("Tubarao-SC", "SC")).toEqual({ nome: "Tubarão, SC", caminho: "/cidades/tubarao-sc" });
    expect(paginaDaCidade("florianopolis", "SC")).toEqual({ nome: "Florianópolis, SC", caminho: "/cidades/florianopolis-sc" });
    // Fora da lista do IBGE, fica a grafia gravada.
    expect(paginaDaCidade("Vila Inventada", "BA")).toEqual({ nome: "Vila Inventada, BA", caminho: "/cidades/vila-inventada-ba" });
  });

  it("o perfil passa pela página da cidade", () => {
    expect(nomes(jsonLdDoNegocio(NEGOCIO, []))).toEqual([
      ["Início", "/"],
      ["Recife, PE", "/cidades/recife-pe"],
      ["Padaria Florescer", "/empresas/padaria.florescer"],
    ]);
  });

  it("a página da cidade lista os negócios em ordem, com o endereço de cada um", () => {
    const dados = jsonLdDaVitrine({
      titulo: "Negócios do bem em Recife, PE",
      descricao: "Dois negócios.",
      migalhas: [
        { nome: "Início", caminho: "/" },
        { nome: "Cidades", caminho: "/cidades" },
        { nome: "Recife, PE", caminho: "/cidades/recife-pe" },
      ],
      negocios: [
        { instagramUsername: "padaria.florescer", nome: "Padaria Florescer" },
        { instagramUsername: "atelie.raiz", nome: "Ateliê Raiz Preta" },
      ],
    });
    const colecao = dados["@graph"][0] as { url: string; mainEntity: { itemListElement: { position: number; url: string }[] } };
    expect(new URL(colecao.url).pathname).toBe("/cidades/recife-pe");
    expect(colecao.mainEntity.itemListElement.map((i) => [i.position, new URL(i.url).pathname])).toEqual([
      [1, "/empresas/padaria.florescer"],
      [2, "/empresas/atelie.raiz"],
    ]);
    expect(nomes(dados).map(([nome]) => nome)).toEqual(["Início", "Cidades", "Recife, PE"]);
  });
});

describe("svgDoLogo", () => {
  it("no fundo escuro troca o marrom pelo creme", () => {
    expect(svgDoLogo("claro")).toContain(CORES_DA_MARCA.marrom);
    expect(svgDoLogo("escuro")).not.toContain(CORES_DA_MARCA.marrom);
    expect(svgDoLogo("escuro")).toContain(CORES_DA_MARCA.creme);
  });
});
