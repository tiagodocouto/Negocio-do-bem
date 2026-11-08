// Troca do @ do Instagram de um negócio (#298). O @ é também o endereço da página,
// então o antigo fica guardado em EnderecoAntigo e redireciona para o atual.

import "server-only";
import { permanentRedirect, redirect } from "next/navigation";
import { registrarAuditoria } from "@/lib/auditoria";
import { db, type Prisma } from "@/lib/db";
import { rotuloDoInstagram } from "@/lib/endereco";
import { MOTIVO_ARROBA, suspenderPorContatoAlterado } from "@/lib/ofertas";
import { textoDeBusca } from "@/lib/texto";

export type ResultadoDaTroca = "trocado" | "mesmo" | "ocupado";

type EmpresaDaTroca = {
  id: string;
  instagramUsername: string;
  nome: string;
  resumo: string;
  categoria: string;
  cidade: string;
  uf: string;
};

/**
 * Troca o endereço do negócio para o @ `novo` (já normalizado). Recusa um @ que já é
 * de outro negócio. O endereço antigo passa a redirecionar para o novo; se o novo era
 * endereço antigo de algum negócio, deixa de ser. Troca feita pelo dono suspende o
 * Clube do Bem até a moderação conferir de novo, como a troca de contato.
 */
export async function trocarArroba(
  tx: Prisma.TransactionClient,
  empresa: EmpresaDaTroca,
  novo: string,
  quem: { usuarioId: string; pelaModeracao: boolean },
): Promise<ResultadoDaTroca> {
  const antigo = empresa.instagramUsername;
  if (novo === antigo) return "mesmo";
  const dono = await tx.empresa.findUnique({ where: { instagramUsername: novo }, select: { id: true } });
  if (dono) return "ocupado";

  await tx.enderecoAntigo.deleteMany({ where: { endereco: novo } });
  await tx.empresa.update({
    where: { id: empresa.id },
    data: { instagramUsername: novo, busca: textoDeBusca({ ...empresa, instagramUsername: novo }) },
  });
  await tx.enderecoAntigo.upsert({
    where: { endereco: antigo },
    create: { endereco: antigo, empresaId: empresa.id },
    update: { empresaId: empresa.id },
  });
  await registrarAuditoria(tx, {
    usuarioId: quem.usuarioId,
    acao: quem.pelaModeracao ? "empresa.arroba_trocado_pela_moderacao" : "empresa.arroba_trocado",
    alvoTipo: "empresa",
    alvoId: empresa.id,
    detalhes: `${rotuloDoInstagram(antigo)} (${antigo}) → @${novo}`,
  });
  if (!quem.pelaModeracao) await suspenderPorContatoAlterado(tx, { id: empresa.id, instagramUsername: novo }, MOTIVO_ARROBA);
  return "trocado";
}

/** O endereço atual de um negócio que já usou `endereco`, ou null. */
export async function enderecoAtual(endereco: string): Promise<string | null> {
  const antigo = await db.enderecoAntigo.findUnique({
    where: { endereco },
    select: { empresa: { select: { instagramUsername: true } } },
  });
  return antigo?.empresa.instagramUsername ?? null;
}

/** Página aberta pelo endereço antigo: redireciona para o mesmo caminho com o endereço atual. */
export async function seguirEnderecoAntigo(endereco: string, caminho: (atual: string) => string, permanente = false): Promise<void> {
  const atual = await enderecoAtual(endereco);
  if (!atual) return;
  if (permanente) permanentRedirect(caminho(atual));
  redirect(caminho(atual));
}
