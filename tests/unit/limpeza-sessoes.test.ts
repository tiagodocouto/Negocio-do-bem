import { describe, expect, it, vi } from "vitest";
import {
  FalhaLimpezaSessoes,
  lerOpcoesLimpezaSessoes,
  limparSessoesVencidas,
  referenciaLimpezaSessoes,
  UsoLimpezaSessoes,
} from "@/lib/limpeza-sessoes";

const referencia = new Date("2020-01-01T00:00:00.000Z");

function cliente() {
  const sessao = {
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  return { sessao, db: { sessao } };
}

describe("opções da limpeza de sessões", () => {
  it("diagnostica por padrão e admite os limites explícitos", () => {
    expect(lerOpcoesLimpezaSessoes([])).toEqual({ aplicar: false, lote: 100 });
    expect(lerOpcoesLimpezaSessoes(["--aplicar", "--lote", "1"])).toEqual({ aplicar: true, lote: 1 });
    expect(lerOpcoesLimpezaSessoes(["--lote", "1000", "--aplicar"])).toEqual({ aplicar: true, lote: 1000 });
  });

  it.each([
    ["--ignorar"], ["--aplicar", "--aplicar"], ["--lote", "1", "--lote", "2"],
    ["--lote"], ["--lote", "0"], ["--lote", "-1"], ["--lote", "1.5"],
    ["--lote", "texto"], ["--lote", "1001"], ["--lote", "Infinity"],
    ["--lote", "1e2"], ["--lote", "01"], ["--lote=2"], ["--referencia", "2100-01-01"],
    ["--lote", "9999999999999999999999999999999999999999"],
  ])("recusa argumentos inválidos: %j", (...argumentos) => {
    expect(() => lerOpcoesLimpezaSessoes(argumentos)).toThrow(UsoLimpezaSessoes);
  });

  it.each([0, -1, 1.5, 1001, NaN])("recusa lote interno inválido %s sem consultar", async (lote) => {
    const { db, sessao } = cliente();
    await expect(limparSessoesVencidas(db, { aplicar: true, lote }, referencia)).rejects.toThrow(UsoLimpezaSessoes);
    expect(sessao.count).not.toHaveBeenCalled();
    expect(sessao.findMany).not.toHaveBeenCalled();
    expect(sessao.deleteMany).not.toHaveBeenCalled();
  });
});

describe("referência da limpeza", () => {
  it("não antecipa o corte com o relógio local ou do banco adiantado", () => {
    const depois = new Date(referencia.getTime() + 600_000);
    expect(referenciaLimpezaSessoes(depois, referencia)).toEqual(referencia);
    expect(referenciaLimpezaSessoes(referencia, depois)).toEqual(referencia);
  });

  it("recusa um relógio inválido antes de consultar", async () => {
    const { db, sessao } = cliente();
    await expect(limparSessoesVencidas(db, { aplicar: true, lote: 1 }, new Date(NaN))).rejects.toThrow(FalhaLimpezaSessoes);
    expect(sessao.count).not.toHaveBeenCalled();
  });
});

describe("fronteiras do núcleo", () => {
  it("diagnóstico só conta, mesmo havendo vencidas", async () => {
    const { db, sessao } = cliente();
    sessao.count.mockResolvedValue(3);
    await expect(limparSessoesVencidas(db, { aplicar: false, lote: 100 }, referencia)).resolves.toMatchObject({ vencidas: 3, removidas: 0 });
    expect(sessao.findMany).not.toHaveBeenCalled();
    expect(sessao.deleteMany).not.toHaveBeenCalled();
  });

  it("seleção vazia não vira uma exclusão sem filtro", async () => {
    const { db, sessao } = cliente();
    await expect(limparSessoesVencidas(db, { aplicar: true, lote: 1 }, referencia)).resolves.toMatchObject({ selecionadas: 0, removidas: 0 });
    expect(sessao.deleteMany).not.toHaveBeenCalled();
  });

  it("sanitiza a falha de leitura sem tentar excluir", async () => {
    const { db, sessao } = cliente();
    sessao.count.mockRejectedValue(new Error("detalhe privado do driver"));
    await expect(limparSessoesVencidas(db, { aplicar: true, lote: 1 }, referencia)).rejects.toThrow("Falha ao consultar as sessões. Nenhuma exclusão foi solicitada.");
    expect(sessao.deleteMany).not.toHaveBeenCalled();
  });
});
