type Vencimento = { expiraEm: { lte: Date } };
type BancoLimpezaSessoes = {
  sessao: {
    count(args: { where: Vencimento }): PromiseLike<number>;
    findMany(args: {
      where: Vencimento;
      select: { id: true };
      orderBy: [{ expiraEm: "asc" }, { id: "asc" }];
      take: number;
    }): PromiseLike<{ id: string }[]>;
    deleteMany(args: { where: Vencimento & { id: { in: string[] } } }): PromiseLike<{ count: number }>;
  };
};

export type OpcoesLimpezaSessoes = { aplicar: boolean; lote: number };
export type ResultadoLimpezaSessoes = OpcoesLimpezaSessoes & {
  referencia: Date;
  vencidas: number;
  selecionadas: number;
  removidas: number;
};

export class UsoLimpezaSessoes extends Error {
  constructor() {
    super("Uso: npm run sessoes:limpar -- [--aplicar] [--lote 1..1000]");
  }
}

export class FalhaLimpezaSessoes extends Error {}

export function lerOpcoesLimpezaSessoes(argumentos: string[]): OpcoesLimpezaSessoes {
  let aplicar = false;
  let lote = 100;
  let loteInformado = false;
  for (let i = 0; i < argumentos.length; i++) {
    if (argumentos[i] === "--aplicar" && !aplicar) {
      aplicar = true;
    } else if (argumentos[i] === "--lote" && !loteInformado) {
      const valor = argumentos[++i];
      if (!valor || !/^[1-9]\d*$/.test(valor)) throw new UsoLimpezaSessoes();
      lote = Number(valor);
      loteInformado = true;
    } else {
      throw new UsoLimpezaSessoes();
    }
  }
  if (!Number.isInteger(lote) || lote < 1 || lote > 1000) throw new UsoLimpezaSessoes();
  return { aplicar, lote };
}

/** Usa o menor relógio para que o computador de manutenção adiantado não antecipe o corte. */
export function referenciaLimpezaSessoes(inicio: Date, banco: Date): Date {
  const instante = Math.min(inicio.getTime(), banco.getTime());
  if (!Number.isFinite(instante)) throw new FalhaLimpezaSessoes("Não foi possível determinar a referência da limpeza.");
  return new Date(instante);
}

/** Um corte fixo e um lote por chamada. O DELETE revalida o vencimento de sessões renovadas. */
export async function limparSessoesVencidas(
  db: BancoLimpezaSessoes,
  opcoes: OpcoesLimpezaSessoes,
  referencia: Date,
): Promise<ResultadoLimpezaSessoes> {
  if (typeof opcoes.aplicar !== "boolean" || !Number.isInteger(opcoes.lote) || opcoes.lote < 1 || opcoes.lote > 1000) {
    throw new UsoLimpezaSessoes();
  }
  const corte = referenciaLimpezaSessoes(referencia, referencia);
  const where = { expiraEm: { lte: corte } };
  let vencidas: number;
  let selecionadas: { id: string }[] = [];
  try {
    vencidas = await db.sessao.count({ where });
    if (opcoes.aplicar) {
      selecionadas = await db.sessao.findMany({
        where,
        select: { id: true },
        orderBy: [{ expiraEm: "asc" }, { id: "asc" }],
        take: opcoes.lote,
      });
    }
  } catch {
    throw new FalhaLimpezaSessoes("Falha ao consultar as sessões. Nenhuma exclusão foi solicitada.");
  }
  let removidas = 0;
  if (selecionadas.length) {
    try {
      const resultado = await db.sessao.deleteMany({
        where: { id: { in: selecionadas.map(({ id }) => id) }, expiraEm: { lte: corte } },
      });
      removidas = resultado.count;
    } catch {
      throw new FalhaLimpezaSessoes("Não foi possível confirmar a exclusão. O resultado é indeterminado. Faça novo diagnóstico antes de repetir.");
    }
  }
  return { ...opcoes, referencia: corte, vencidas, selecionadas: selecionadas.length, removidas };
}
