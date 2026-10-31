import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";

// Cada decisão só vale se o item ainda está como a moderação o viu. A escrita
// condicional trava a linha até o fim da transação, então de duas decisões
// simultâneas só a primeira é aplicada e registrada na auditoria.

export type SituacaoDaModeracao = "pendente" | "aprovada" | "rejeitada";

export function situacaoDaModeracao(valor: unknown): SituacaoDaModeracao | null {
  return valor === "pendente" || valor === "aprovada" || valor === "rejeitada" ? valor : null;
}

/** Publica ou tira do ar um negócio que estava em `de`. Devolve false se outra pessoa mudou antes. */
export async function moderarNegocio(params: {
  empresaId: string;
  de: SituacaoDaModeracao;
  decisao: "aprovada" | "rejeitada";
  moderadorId: string;
}): Promise<boolean> {
  const { empresaId, de, decisao, moderadorId } = params;
  if (de === decisao) return false;
  return db.$transaction(async (tx) => {
    const { count } = await tx.empresa.updateMany({ where: { id: empresaId, moderacao: de }, data: { moderacao: decisao } });
    if (count === 0) return false;
    const empresa = await tx.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { instagramUsername: true } });
    await registrarAuditoria(tx, {
      usuarioId: moderadorId,
      acao: decisao === "aprovada" ? "empresa.aprovada" : "empresa.rejeitada",
      alvoTipo: "empresa",
      alvoId: empresaId,
      detalhes: `@${empresa.instagramUsername}`,
    });
    return true;
  });
}

/** Remove ou mantém um depoimento denunciado. Devolve false se a denúncia já tinha sido decidida. */
export async function decidirDenunciaDoDepoimento(params: {
  depoimentoId: string;
  remover: boolean;
  moderadorId: string;
}): Promise<boolean> {
  const { depoimentoId, remover, moderadorId } = params;
  return db.$transaction(async (tx) => {
    const { count } = await tx.depoimento.updateMany({
      where: { id: depoimentoId, denunciado: true, status: "publicado" },
      data: remover ? { status: "removido", denunciado: false } : { denunciado: false, motivoDenuncia: null, denunciadoPorId: null },
    });
    if (count === 0) return false;
    await registrarAuditoria(tx, {
      usuarioId: moderadorId,
      acao: remover ? "depoimento.removido" : "depoimento.mantido",
      alvoTipo: "depoimento",
      alvoId: depoimentoId,
    });
    return true;
  });
}
