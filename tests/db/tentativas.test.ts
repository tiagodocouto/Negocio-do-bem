import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JANELA_MS,
  LIMITE_POR_EMAIL,
  LIMITE_POR_IP,
  normalizarIp,
  reservarTentativaDoEmail,
  tentativaDoIpLiberada,
  zerarTentativasDoEmail,
} from "@/lib/auth/tentativas";
import { db } from "@/lib/db";

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "TentativaAcesso"`);
}

async function vencerJanelas() {
  await db.tentativaAcesso.updateMany({ data: { janelaIniciadaEm: new Date(Date.now() - JANELA_MS - 1000) } });
}

beforeEach(limparBanco);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("limite por IP", () => {
  it("libera até o limite e recusa a partir daí", async () => {
    for (let i = 0; i < LIMITE_POR_IP; i++) expect(await tentativaDoIpLiberada("200.0.0.1")).toBe(true);
    expect(await tentativaDoIpLiberada("200.0.0.1")).toBe(false);
    expect(await tentativaDoIpLiberada("200.0.0.2")).toBe(true);
  });

  it("volta a liberar quando a janela vence, e apaga as janelas vencidas", async () => {
    for (let i = 0; i <= LIMITE_POR_IP; i++) await tentativaDoIpLiberada("200.0.0.1");
    await vencerJanelas();
    expect(await tentativaDoIpLiberada("200.0.0.1")).toBe(true);
    expect(await db.tentativaAcesso.count()).toBe(1);
  });

  it("conta todas as tentativas simultâneas", async () => {
    const resultados = await Promise.all(
      Array.from({ length: LIMITE_POR_IP + 5 }, () => tentativaDoIpLiberada("200.0.0.1")),
    );
    expect(resultados.filter(Boolean)).toHaveLength(LIMITE_POR_IP);
    expect(await db.tentativaAcesso.findFirst()).toMatchObject({ contagem: LIMITE_POR_IP + 5 });
  });

  it("sem IP conhecido fora de produção, não há limite por IP e nada é guardado", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < LIMITE_POR_IP + 5; i++) expect(await tentativaDoIpLiberada(null)).toBe(true);
    expect(await db.tentativaAcesso.count()).toBe(0);
    expect(erro).not.toHaveBeenCalled();
  });

  it("sem IP conhecido em produção, recusa, avisa quem cuida do site e não guarda nada", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await tentativaDoIpLiberada(null)).toBe(false);
    expect(await tentativaDoIpLiberada("200.0.0.1")).toBe(true);
    expect(erro).toHaveBeenCalledTimes(1);
    expect(erro.mock.calls[0]![0]).toContain("AUTENTICACAO_PROXY_CONFIAVEL");
    expect(erro.mock.calls[0]![0]).toContain("CLOUDFLARE_DEPLOY=1");
    expect(erro.mock.calls[0]![0]).toContain("cf-connecting-ip");
    expect(erro.mock.calls[0]![0]).toContain("README");
    expect(await db.tentativaAcesso.count()).toBe(1);
  });

  it("guarda o hash do IP, e não o IP", async () => {
    await tentativaDoIpLiberada("200.0.0.1");
    const [tentativa] = await db.tentativaAcesso.findMany();
    expect(tentativa!.chave).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("normalizarIp", () => {
  it("deixa o IPv4 como está", () => {
    expect(normalizarIp("203.0.113.5")).toBe("203.0.113.5");
  });

  it("troca o IPv4 escrito como IPv6 pelo próprio IPv4", () => {
    expect(normalizarIp("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(normalizarIp("::FFFF:cb00:7105")).toBe("203.0.113.5");
    expect(normalizarIp("0:0:0:0:0:ffff:cb00:7105")).toBe("203.0.113.5");
  });

  it("troca o IPv6 pelo prefixo /64, seja qual for a forma de escrever", () => {
    const prefixo = "2001:db8:abcd:12::/64";
    expect(normalizarIp("2001:db8:abcd:12::1")).toBe(prefixo);
    expect(normalizarIp("2001:0DB8:ABCD:0012:ffff:ffff:ffff:ffff")).toBe(prefixo);
    expect(normalizarIp("2001:db8:abcd:12:1:2:3:4")).toBe(prefixo);
    expect(normalizarIp("2001:db8:abcd:13::1")).not.toBe(prefixo);
  });

  it("aceita os endereços de borda", () => {
    expect(normalizarIp("::1")).toBe("0:0:0:0::/64");
    expect(normalizarIp("::")).toBe("0:0:0:0::/64");
    expect(normalizarIp("fe80::1")).toBe("fe80:0:0:0::/64");
  });
});

describe("limite por e-mail", () => {
  it("libera as 5 primeiras tentativas e recusa da sexta em diante, só para aquele e-mail e aquela origem", async () => {
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) expect(await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1")).toBe(true);
    expect(await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1")).toBe(false);
    expect(await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1")).toBe(false);
    expect(await reservarTentativaDoEmail("joao@exemplo.com", "200.0.0.1")).toBe(true);
  });

  it("cada origem tem o próprio contador para o mesmo e-mail", async () => {
    for (let i = 0; i <= LIMITE_POR_EMAIL; i++) await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1");
    expect(await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1")).toBe(false);
    expect(await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.2")).toBe(true);
    expect(await reservarTentativaDoEmail("ana@exemplo.com", null)).toBe(true);
  });

  it("sem IP, as tentativas para o mesmo e-mail dividem um contador só", async () => {
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) expect(await reservarTentativaDoEmail("ana@exemplo.com", null)).toBe(true);
    expect(await reservarTentativaDoEmail("ana@exemplo.com", null)).toBe(false);
  });

  it("o login certo zera só a contagem daquela origem", async () => {
    for (let i = 0; i <= LIMITE_POR_EMAIL; i++) {
      await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1");
      await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.2");
    }
    await zerarTentativasDoEmail("ana@exemplo.com", "200.0.0.2");
    expect(await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1")).toBe(false);
    expect(await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.2")).toBe(true);
  });

  it("um login certo zera a contagem", async () => {
    for (let i = 0; i < LIMITE_POR_EMAIL - 1; i++) await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1");
    await zerarTentativasDoEmail("ana@exemplo.com", "200.0.0.1");
    for (let i = 0; i < LIMITE_POR_EMAIL - 1; i++) await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1");
    expect(await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1")).toBe(true);
  });

  it("volta a liberar quando a janela vence", async () => {
    for (let i = 0; i <= LIMITE_POR_EMAIL; i++) await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1");
    await vencerJanelas();
    expect(await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1")).toBe(true);
    expect(await db.tentativaAcesso.findFirst()).toMatchObject({ contagem: 1 });
  });

  it("reservas simultâneas logo depois de a janela vencer abrem uma janela só, sem perder nenhuma", async () => {
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1");
    await vencerJanelas();
    await Promise.all(Array.from({ length: 3 }, () => reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1")));
    const tentativa = await db.tentativaAcesso.findFirst();
    expect(tentativa).toMatchObject({ contagem: 3 });
    expect(tentativa!.janelaIniciadaEm.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("reservas simultâneas: só as 5 primeiras passam", async () => {
    const resultados = await Promise.all(
      Array.from({ length: LIMITE_POR_EMAIL + 19 }, () => reservarTentativaDoEmail("ana@exemplo.com", "200.0.0.1")),
    );
    expect(resultados.filter(Boolean)).toHaveLength(LIMITE_POR_EMAIL);
    expect(await db.tentativaAcesso.findFirst()).toMatchObject({ contagem: LIMITE_POR_EMAIL + 19 });
  });
});
