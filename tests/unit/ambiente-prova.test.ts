import { afterEach, describe, expect, it, vi } from "vitest";

const { put, apagar } = vi.hoisted(() => ({ put: vi.fn(async () => ({})), apagar: vi.fn(async () => {}) }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { UPLOADS: { put, delete: apagar } } })),
}));
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), unlink: vi.fn(), writeFile: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("isolamento do armazenamento dos testes", () => {
  it.each(["BLOB_STORE_ID", "BLOB_READ_WRITE_TOKEN", "NEXT_PUBLIC_R2_PUBLIC_URL"])("remove o seletor herdado %s antes da prova", async (variavel) => {
    vi.stubEnv(variavel, "https://fotos.exemplo.test");
    vi.stubEnv("NODE_ENV", "test");
    vi.resetModules();
    await import("../setup");
    const { guardarFoto, apagarFoto } = await import("@/lib/armazenamento");
    const foto = { arquivo: new File([new Uint8Array([0xff, 0xd8, 0xff])], "prova.jpg"), tipo: "image/jpeg" as const };

    const url = await guardarFoto(foto, "perfis");
    await apagarFoto(url);

    expect(put).not.toHaveBeenCalled();
    expect(apagar).not.toHaveBeenCalled();
    expect(url).toMatch(/^\/enviados\/perfis\//);
  });
});
