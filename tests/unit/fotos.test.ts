import { describe, expect, it, vi } from "vitest";
import { conferirFoto } from "@/lib/armazenamento";
import { ehFotoDoSite } from "@/lib/fotos";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const WEBP = [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")];

function arquivo(bytes: number[], tipo = "image/jpeg") {
  return new File([new Uint8Array(bytes)], "foto", { type: tipo });
}

describe("conferirFoto", () => {
  it("aceita JPEG, PNG e WebP pelos primeiros bytes", async () => {
    expect(await conferirFoto(arquivo(JPEG))).toMatchObject({ tipo: "image/jpeg" });
    expect(await conferirFoto(arquivo(PNG, "image/png"))).toMatchObject({ tipo: "image/png" });
    // O tipo informado pelo navegador não importa: valem os bytes.
    expect(await conferirFoto(arquivo(WEBP, "image/jpeg"))).toMatchObject({ tipo: "image/webp" });
  });

  it("recusa outros arquivos, mesmo dizendo que são imagem", async () => {
    const svg = arquivo([...Buffer.from("<svg onload=x>")], "image/jpeg");
    expect(await conferirFoto(svg)).toEqual({ erro: "Use uma foto JPG, PNG ou WebP." });
  });

  it("recusa campo vazio, texto e foto grande demais", async () => {
    expect(await conferirFoto(null)).toEqual({ erro: "Escolha uma foto." });
    expect(await conferirFoto("texto")).toEqual({ erro: "Escolha uma foto." });
    const grande = arquivo([...JPEG, ...new Array(3 * 1024 * 1024).fill(0)]);
    expect(await conferirFoto(grande)).toEqual({ erro: "A foto pode ter até 3 MB." });
  });
});

describe("ehFotoDoSite", () => {
  it("aceita o Vercel Blob e a pasta local de desenvolvimento", () => {
    expect(ehFotoDoSite("https://abc123.public.blob.vercel-storage.com/perfis/x.jpg")).toBe(true);
    expect(ehFotoDoSite("/enviados/historias/x.jpg")).toBe(true);
  });

  it("aceita endereços antigos de qualquer store do Vercel Blob durante a migração", () => {
    expect(ehFotoDoSite("https://producao1.public.blob.vercel-storage.com/perfis/x.jpg")).toBe(true);
    expect(ehFotoDoSite("https://previews2.public.blob.vercel-storage.com/historias/x.jpg")).toBe(true);
  });

  it("aceita o domínio R2 configurado para o ambiente", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://fotos.exemplo.com");
    expect(ehFotoDoSite("https://fotos.exemplo.com/perfis/x.jpg")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("recusa imagens de outros endereços e caminhos suspeitos", () => {
    expect(ehFotoDoSite("https://exemplo.com/foto.jpg")).toBe(false);
    expect(ehFotoDoSite("http://abc123.public.blob.vercel-storage.com/x.jpg")).toBe(false);
    expect(ehFotoDoSite("https://public.blob.vercel-storage.com.exemplo.com/x.jpg")).toBe(false);
    expect(ehFotoDoSite("/enviados/../.env")).toBe(false);
    expect(ehFotoDoSite("javascript:alert(1)")).toBe(false);
    expect(ehFotoDoSite(null)).toBe(false);
  });
});
