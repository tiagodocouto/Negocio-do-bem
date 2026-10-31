import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apagarFoto, guardarFoto } from "@/lib/armazenamento";

const { put, apagar } = vi.hoisted(() => ({ put: vi.fn(async () => ({})), apagar: vi.fn(async () => {}) }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { UPLOADS: { put, delete: apagar } } })),
}));

const FOTO = { arquivo: new File([new Uint8Array([0xff, 0xd8, 0xff])], "foto"), tipo: "image/jpeg" as const };
const URL_FOTO = "https://fotos.exemplo.com/perfis/x.jpg";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("guardarFoto e apagarFoto", () => {
  it("usa o bucket R2 configurado", async () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://fotos.exemplo.com");

    const url = await guardarFoto(FOTO, "perfis");
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^perfis\/[0-9a-f]{24}\.jpg$/), FOTO.arquivo, {
      httpMetadata: { contentType: "image/jpeg" },
    });
    expect(url).toMatch(/^https:\/\/fotos\.exemplo\.com\/perfis\//);

    await apagarFoto(URL_FOTO);
    expect(apagar).toHaveBeenCalledWith("perfis/x.jpg");
  });

  it("em produção, sem R2 configurado, recusa guardar a foto", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(guardarFoto(FOTO, "perfis")).rejects.toThrow("Configure NEXT_PUBLIC_R2_PUBLIC_URL");
    await apagarFoto(URL_FOTO);
    expect(put).not.toHaveBeenCalled();
    expect(apagar).not.toHaveBeenCalled();
  });
});
