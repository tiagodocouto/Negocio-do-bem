"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { AVISOS } from "@/lib/avisos";
import { cnpjValido, limparCnpj } from "@/lib/cnpj";
import { db } from "@/lib/db";
import { campoSite, errosPorCampo, texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import { avisarNovaReivindicacao } from "@/lib/notificacoes";
import { cancelar, ErroReivindicacao, solicitarPorDocumento } from "@/lib/reivindicacao";

async function carregar(dados: FormData) {
  const empresa = await db.empresa.findUnique({ where: { id: texto(dados, "empresaId") } });
  if (!empresa) redirect("/");
  const caminho = `/empresas/${empresa.instagramUsername}/reivindicar`;
  const usuario = await exigirUsuario(caminho);
  return { empresa, usuario, caminho };
}

const esquemaDocumento = z.object({
  cnpj: z
    .string()
    .trim()
    .transform((valor, ctx) => {
      if (!valor) return null;
      if (!cnpjValido(valor)) {
        ctx.addIssue({ code: "custom", message: "Este CNPJ não parece válido. Confira os números." });
        return z.NEVER;
      }
      return limparCnpj(valor);
    }),
  site: campoSite,
  relacao: z.string().trim().min(2, "Conte qual é a sua relação com o negócio.").max(120),
  contato: z.string().trim().min(5, "Deixe um WhatsApp ou e-mail para a moderação falar com você.").max(160),
  mensagem: z.string().trim().max(1000, "Use até 1.000 caracteres."),
});

export async function enviarDocumento(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { empresa, usuario, caminho } = await carregar(dados);
  if (!usuario.emailConfirmado) return { erro: AVISOS.confirmar_email.texto, valores: valoresDoFormulario(dados) };
  const resultado = esquemaDocumento.safeParse({
    cnpj: texto(dados, "cnpj"),
    site: texto(dados, "site"),
    relacao: texto(dados, "relacao"),
    contato: texto(dados, "contato"),
    mensagem: texto(dados, "mensagem"),
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error), valores: valoresDoFormulario(dados) };

  let aprovada: boolean;
  try {
    const pedido = await solicitarPorDocumento({
      empresaId: empresa.id,
      usuarioId: usuario.id,
      ...resultado.data,
      mensagem: resultado.data.mensagem || null,
    });
    aprovada = pedido.status === "aprovada";
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) return { erro: erro.message, valores: valoresDoFormulario(dados) };
    throw erro;
  }
  if (!aprovada) after(() => avisarNovaReivindicacao(empresa.id));
  redirect(aprovada ? `/painel/${empresa.instagramUsername}?aviso=verificada` : `${caminho}?aviso=documento_enviado`);
}

export async function cancelarReivindicacao(dados: FormData): Promise<void> {
  const { usuario, caminho } = await carregar(dados);
  await cancelar(texto(dados, "reivindicacaoId"), usuario.id);
  redirect(`${caminho}?aviso=cancelada`);
}
