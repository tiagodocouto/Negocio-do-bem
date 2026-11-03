import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arquivoDaFoto, buscarPreviaDoInstagram, esquecerPrevias, fotoDaMeta } from "@/lib/previa-instagram";

const FOTO = "https://scontent-gru2-1.cdninstagram.com/v/t51/foto.jpg?assinatura=1";

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
}

function respostaImagem(bytes: number, tipo = "image/jpeg") {
  return new Response(new Uint8Array(bytes).fill(7), { status: 200, headers: { "content-type": tipo } });
}

beforeEach(() => {
  esquecerPrevias();
  vi.stubEnv("META_ACCESS_TOKEN", "token-de-teste");
  vi.stubEnv("META_IG_USER_ID", "17841400000000000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("prévia do Instagram", () => {
  it("devolve o nome, o site e a foto em data URL", async () => {
    const fetch = vi.fn(async (url: URL | string) =>
      String(url).startsWith("https://graph.facebook.com/")
        ? respostaJson({ business_discovery: { name: " Padaria Flor ", website: "https://padariaflor.com.br", profile_picture_url: FOTO } })
        : respostaImagem(100),
    );
    vi.stubGlobal("fetch", fetch);

    const previa = await buscarPreviaDoInstagram("padaria.flor");

    expect(previa).toMatchObject({ nome: "Padaria Flor", site: "https://padariaflor.com.br" });
    expect(previa?.foto).toMatch(/^data:image\/jpeg;base64,/);
    const consulta = new URL(String(fetch.mock.calls[0]![0]));
    expect(consulta.pathname).toBe("/v26.0/17841400000000000");
    expect(consulta.searchParams.get("fields")).toBe("business_discovery.username(padaria.flor){name,website,profile_picture_url}");
  });

  it("sem as variáveis, não chama a Meta", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    expect(await buscarPreviaDoInstagram("padaria.flor")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("conta pessoal, token vencido ou Meta fora do ar: sem prévia, sem erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respostaJson({ error: { code: 110, message: "Invalid user id" } }, 400)));
    expect(await buscarPreviaDoInstagram("conta.pessoal")).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    expect(await buscarPreviaDoInstagram("meta.fora")).toBeNull();
  });

  it("guarda a resposta de cada @ por um tempo, para não gastar o limite da Meta", async () => {
    const fetch = vi.fn(async () => respostaJson({ business_discovery: { name: "Padaria Flor" } }));
    vi.stubGlobal("fetch", fetch);

    await buscarPreviaDoInstagram("padaria.flor");
    await buscarPreviaDoInstagram("padaria.flor");

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("sem prévia, consulta de novo: a conta pode ter acabado de virar profissional", async () => {
    let profissional = false;
    const fetch = vi.fn(async () =>
      profissional
        ? respostaJson({ business_discovery: { name: "Casa do Fantasma" } })
        : respostaJson({ error: { code: 110, message: "Invalid user id" } }, 400),
    );
    vi.stubGlobal("fetch", fetch);

    expect(await buscarPreviaDoInstagram("casadofantasma")).toBeNull();
    profissional = true;
    expect(await buscarPreviaDoInstagram("casadofantasma")).toMatchObject({ nome: "Casa do Fantasma" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("não baixa foto grande demais nem de outro tipo", async () => {
    const perfil = { business_discovery: { name: "Padaria Flor", profile_picture_url: FOTO } };
    vi.stubGlobal("fetch", vi.fn(async (url: URL | string) => (String(url).includes("graph") ? respostaJson(perfil) : respostaImagem(400_000))));
    expect((await buscarPreviaDoInstagram("foto.grande"))?.foto).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async (url: URL | string) => (String(url).includes("graph") ? respostaJson(perfil) : respostaImagem(100, "image/svg+xml"))));
    expect((await buscarPreviaDoInstagram("foto.svg"))?.foto).toBeNull();
  });

  it("só baixa fotos dos domínios da Meta, por https", () => {
    expect(fotoDaMeta(FOTO)?.hostname).toBe("scontent-gru2-1.cdninstagram.com");
    expect(fotoDaMeta("https://scontent.xx.fbcdn.net/foto.jpg")).not.toBeNull();
    expect(fotoDaMeta("http://scontent.xx.fbcdn.net/foto.jpg")).toBeNull();
    expect(fotoDaMeta("https://fbcdn.net.exemplo.com/foto.jpg")).toBeNull();
    expect(fotoDaMeta("https://169.254.169.254/latest")).toBeNull();
    expect(fotoDaMeta(undefined)).toBeNull();
  });
});

describe("arquivoDaFoto", () => {
  it("transforma a foto da prévia num arquivo, para guardar no site", async () => {
    const arquivo = arquivoDaFoto(`data:image/png;base64,${Buffer.from("png").toString("base64")}`);
    expect(arquivo?.type).toBe("image/png");
    expect(Buffer.from(await arquivo!.arrayBuffer()).toString()).toBe("png");
  });

  it("recusa o que não é uma imagem em data URL", () => {
    expect(arquivoDaFoto("https://scontent.cdninstagram.com/foto.jpg")).toBeNull();
    expect(arquivoDaFoto("data:text/html;base64,PGgxPg==")).toBeNull();
  });
});
