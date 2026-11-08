"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirModerador } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { texto } from "@/lib/formulario";
import { apagarDocumentosDaLiberacao } from "@/lib/clube";
import { decidirDenunciaDoDepoimento, moderarNegocio, situacaoDaModeracao } from "@/lib/moderacao/decisoes";
import { comAviso, destinoNaModeracao, hrefModeracao } from "@/lib/moderacao/filtros";
import { avisarDecisaoDaReivindicacao, avisarDonoRemovido } from "@/lib/notificacoes";
import {
  aprovar,
  aprovarPendentesSemDono,
  ErroReivindicacao,
  recusar,
  removerDono as tirarDosDonos,
  type ModoAprovacao,
} from "@/lib/reivindicacao";

function voltar(aba: string, aviso: string): never {
  redirect(`/moderacao?aba=${aba}&aviso=${aviso}`);
}

/** Esvazia a fila antiga: aprova as reivindicações de negócios que ainda não têm dono. */
export async function aprovarReivindicacoesSemDono(): Promise<void> {
  const moderador = await exigirModerador("acao");
  const aprovadas = await aprovarPendentesSemDono(moderador.id);
  after(async () => {
    for (const id of aprovadas) await avisarDecisaoDaReivindicacao(id);
  });
  voltar("reivindicacoes", "feito");
}

/** Esvazia a fila antiga: publica todas as indicações que esperavam a moderação. */
export async function publicarIndicacoesPendentes(): Promise<void> {
  const moderador = await exigirModerador("acao");
  const pendentes = await db.empresa.findMany({ where: { moderacao: "pendente" }, select: { id: true, instagramUsername: true } });
  for (const { id, instagramUsername } of pendentes) {
    await db.$transaction(async (tx) => {
      const { count } = await tx.empresa.updateMany({ where: { id, moderacao: "pendente" }, data: { moderacao: "aprovada" } });
      if (count === 0) return;
      await registrarAuditoria(tx, {
        usuarioId: moderador.id,
        acao: "empresa.aprovada",
        alvoTipo: "empresa",
        alvoId: id,
        detalhes: `@${instagramUsername}`,
      });
    });
  }
  voltar("indicacoes", "feito");
}

export async function aprovarReivindicacao(dados: FormData): Promise<void> {
  const moderador = await exigirModerador("acao");
  const modo: ModoAprovacao = dados.get("modo") === "transferir" ? "transferir" : "adicionar";
  const reivindicacaoId = texto(dados, "reivindicacaoId");
  try {
    await aprovar({ reivindicacaoId, revisorId: moderador.id, modo });
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) voltar("reivindicacoes", "ja_processada");
    throw erro;
  }
  after(() => avisarDecisaoDaReivindicacao(reivindicacaoId));
  voltar("reivindicacoes", "feito");
}

export async function recusarReivindicacao(dados: FormData): Promise<void> {
  const moderador = await exigirModerador("acao");
  const motivo = texto(dados, "motivo").trim().slice(0, 500) || "Não foi possível confirmar que você controla este negócio.";
  const reivindicacaoId = texto(dados, "reivindicacaoId");
  try {
    await recusar({ reivindicacaoId, revisorId: moderador.id, motivo });
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) voltar("reivindicacoes", "ja_processada");
    throw erro;
  }
  after(() => avisarDecisaoDaReivindicacao(reivindicacaoId));
  voltar("reivindicacoes", "feito");
}

/**
 * Publica ou tira do ar um negócio. Serve para a fila de indicações e para a aba
 * Negócios, que manda em `voltar` a lista filtrada de onde o pedido saiu.
 */
export async function moderarEmpresa(dados: FormData): Promise<void> {
  const moderador = await exigirModerador("acao");
  const decisao = dados.get("decisao") === "aprovar" ? "aprovada" : "rejeitada";
  const aba = dados.get("aba") === "negocios" ? "negocios" : "indicacoes";
  const de = situacaoDaModeracao(dados.get("de")) ?? (aba === "negocios" && decisao === "rejeitada" ? "aprovada" : "pendente");
  const aplicada = await moderarNegocio({ empresaId: texto(dados, "empresaId"), de, decisao, moderadorId: moderador.id });
  const aviso = aplicada ? "feito" : "ja_decidido";
  const destino = destinoNaModeracao(dados.get("voltar"));
  if (destino) redirect(comAviso(destino, aviso));
  voltar(aba, aviso);
}

/** Volta para a seção de donos da ficha do negócio ou, com `voltar=fila`, para a fila do clube. */
function voltarDosDonos(dados: FormData, username: string, aviso: string): never {
  if (texto(dados, "voltar") === "fila") redirect(`${hrefModeracao("clube", { aviso })}#pedidos`);
  redirect(`/moderacao/negocios/${username}?aviso=${aviso}#donos`);
}

/**
 * Tira uma conta dos donos do negócio, com o motivo, que a pessoa recebe por e-mail. Só
 * com a confirmação marcada. As regras estão em `removerDono` (src/lib/reivindicacao.ts).
 */
export async function removerDono(dados: FormData): Promise<void> {
  const moderador = await exigirModerador("acao");
  const empresa = await db.empresa.findUnique({ where: { id: texto(dados, "empresaId") }, select: { id: true, instagramUsername: true } });
  if (!empresa) redirect("/moderacao?aba=negocios");
  if (texto(dados, "confirmo") !== "sim") voltarDosDonos(dados, empresa.instagramUsername, "dono_sem_confirmacao");
  const usuarioId = texto(dados, "usuarioId");
  const motivo = texto(dados, "motivo").trim().slice(0, 500) || "Sem motivo informado";
  const resultado = await tirarDosDonos({ empresaId: empresa.id, usuarioId, moderadorId: moderador.id, motivo });
  if (!resultado?.removido) voltarDosDonos(dados, empresa.instagramUsername, "dono_ja_removido");
  // Um pedido do clube em análise foi recusado junto: o documento dele não fica guardado.
  await apagarDocumentosDaLiberacao(empresa.id, usuarioId);
  after(() => avisarDonoRemovido(empresa.id, usuarioId, motivo));
  voltarDosDonos(dados, empresa.instagramUsername, "dono_removido");
}

export async function decidirDenuncia(dados: FormData): Promise<void> {
  const moderador = await exigirModerador("acao");
  const aplicada = await decidirDenunciaDoDepoimento({
    depoimentoId: texto(dados, "depoimentoId"),
    remover: dados.get("decisao") === "remover",
    moderadorId: moderador.id,
  });
  voltar("denuncias", aplicada ? "feito" : "ja_decidido");
}
