"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { exigirModerador, exigirUsuario } from "@/lib/auth/sessao";
import { AVISOS } from "@/lib/avisos";
import { ErroClube, liberarParaClube, pedirVerificacao, recusarPedido, suspenderDoClube, type MotivoRecusaClube } from "@/lib/clube";
import { db } from "@/lib/db";
import { apagarDocumentosGuardados, conferirDocumentos, guardarDocumento } from "@/lib/documentos";
import { texto, type EstadoFormulario } from "@/lib/formulario";
import { hrefModeracao } from "@/lib/moderacao/filtros";
import { avisarDecisaoDoClube, avisarNovoPedidoDoClube } from "@/lib/notificacoes";

/** Volta para onde a moderação estava: a fila do clube ou a ficha do negócio. */
function voltarDaModeracao(dados: FormData, username: string, aviso: string): never {
  if (texto(dados, "voltar") === "fila") redirect(`${hrefModeracao("clube", { aviso })}#pedidos`);
  redirect(`/moderacao/negocios/${username}?aviso=${aviso}#clube`);
}

/** Libera um dono do negócio para o Clube do Bem, com o CNPJ conferido na Receita. Só a moderação. */
export async function liberarDonoParaClube(dados: FormData): Promise<void> {
  const moderador = await exigirModerador("acao");
  const empresa = await db.empresa.findUnique({ where: { id: texto(dados, "empresaId") }, select: { id: true, instagramUsername: true } });
  if (!empresa) redirect("/moderacao?aba=negocios");
  const usuarioId = texto(dados, "usuarioId");
  try {
    await liberarParaClube({ empresaId: empresa.id, usuarioId, cnpj: texto(dados, "cnpj"), moderadorId: moderador.id });
  } catch (erro) {
    if (erro instanceof ErroClube) voltarDaModeracao(dados, empresa.instagramUsername, `clube_${erro.motivo}`);
    throw erro;
  }
  after(() => avisarDecisaoDoClube(empresa.id, usuarioId));
  voltarDaModeracao(dados, empresa.instagramUsername, "clube_liberado");
}

/** Suspende a liberação de um dono, com o motivo. Só a moderação. */
export async function suspenderDonoDoClube(dados: FormData): Promise<void> {
  const moderador = await exigirModerador("acao");
  const motivo = texto(dados, "motivo").trim().slice(0, 500) || "Sem motivo informado";
  const username = await suspenderDoClube({ liberacaoId: texto(dados, "liberacaoId"), moderadorId: moderador.id, motivo });
  if (!username) redirect("/moderacao?aba=negocios");
  voltarDaModeracao(dados, username, "clube_suspenso");
}

/** Recusa um pedido da fila do clube, com o motivo, que o dono vê. Só a moderação. */
export async function recusarPedidoDoClube(dados: FormData): Promise<void> {
  const moderador = await exigirModerador("acao");
  const motivo = texto(dados, "motivo").trim().slice(0, 500) || "Sem motivo informado";
  const resultado = await recusarPedido({ liberacaoId: texto(dados, "liberacaoId"), moderadorId: moderador.id, motivo });
  if (!resultado) redirect(hrefModeracao("clube"));
  if (!resultado.recusado) voltarDaModeracao(dados, resultado.username, "clube_ja_decidido");
  after(() => avisarDecisaoDoClube(resultado.empresaId, resultado.usuarioId));
  voltarDaModeracao(dados, resultado.username, "clube_recusado");
}

// O texto que o dono vê quando o pedido não entra, no lugar dos avisos da moderação.
const ERROS_DO_PEDIDO: Partial<Record<MotivoRecusaClube, string>> = {
  cnpj_invalido: "CNPJ inválido. Confira os números.",
  cnpj_inativo: "Este CNPJ não está ativo na Receita. Só entram no clube negócios com CNPJ ativo.",
  cnpj_nao_encontrado: "Não achamos este CNPJ na Receita. Confira os números.",
  nao_e_dono: "Só um dono do negócio pode pedir a verificação.",
  ja_liberado: "Você já está liberado no clube.",
  pedido_em_analise: "Você já tem um pedido em análise.",
  nome_invalido: "Escreva o seu nome completo, como no documento.",
  cpf_invalido: "CPF inválido. Confira os números.",
  sem_consentimento: "Marque a autorização para a moderação usar o seu nome, o seu CPF e o seu documento na verificação.",
  sem_documento: "Envie a foto do seu RG ou da sua CNH.",
};

/** O dono pede a verificação do negócio para o Clube do Bem, com o CNPJ. O pedido vai para a fila da moderação. */
export async function pedirVerificacaoAcao(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const empresa = await db.empresa.findUnique({ where: { id: texto(dados, "empresaId") }, select: { id: true, instagramUsername: true } });
  if (!empresa) redirect("/painel");
  const clube = `/painel/${empresa.instagramUsername}/clube`;
  const usuario = await exigirUsuario(clube);
  // O servidor não devolve o CPF: só o CNPJ e o nome voltam nos `valores` de um erro.
  const valores = { cnpj: texto(dados, "cnpj"), nomeCompleto: texto(dados, "nomeCompleto") };
  if (!usuario.emailConfirmado) return { erro: AVISOS.confirmar_email.texto, valores };
  const conferidos = await conferirDocumentos(dados.getAll("documentos"));
  if ("erro" in conferidos) return { erro: conferidos.erro, valores };
  // O documento vai para o bucket privado antes do pedido; se o pedido não entrar, ele é apagado.
  const documentoChaves: string[] = [];
  try {
    for (const documento of conferidos.documentos) documentoChaves.push(await guardarDocumento(documento));
    await pedirVerificacao({
      empresaId: empresa.id,
      usuarioId: usuario.id,
      cnpj: valores.cnpj,
      nomeCompleto: valores.nomeCompleto,
      cpf: texto(dados, "cpf"),
      consentimento: texto(dados, "consentimento") === "sim",
      documentoChaves,
    });
  } catch (erro) {
    await apagarDocumentosGuardados(documentoChaves);
    if (erro instanceof ErroClube) return { erro: ERROS_DO_PEDIDO[erro.motivo] ?? AVISOS[`clube_${erro.motivo}`]?.texto, valores };
    throw erro;
  }
  after(() => avisarNovoPedidoDoClube(empresa.id));
  redirect(`${clube}?aviso=clube_pedido_enviado#verificar`);
}
