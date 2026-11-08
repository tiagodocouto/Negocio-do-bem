"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { AVISOS } from "@/lib/avisos";
import { db } from "@/lib/db";
import { errosPorCampo, texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import { medir } from "@/lib/medicao-servidor";
import { avisarNovaReivindicacao } from "@/lib/notificacoes";
import { cancelar, ErroReivindicacao, solicitarPorDocumento } from "@/lib/reivindicacao";

async function carregar(dados: FormData) {
  const empresa = await db.empresa.findUnique({ where: { id: texto(dados, "empresaId") } });
  if (!empresa) redirect("/");
  const caminho = `/empresas/${empresa.instagramUsername}/reivindicar`;
  const usuario = await exigirUsuario(caminho);
  return { empresa, usuario, caminho };
}

// O CNPJ, o nome completo e o CPF vêm depois, no pedido de verificação do painel (#293).
const esquemaDocumento = z.object({
  relacao: z.string().trim().min(2, "Conte qual é a sua relação com o negócio.").max(120),
  mensagem: z.string().trim().max(1000, "Use até 1.000 caracteres."),
});

export async function enviarDocumento(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { empresa, usuario, caminho } = await carregar(dados);
  if (!usuario.emailConfirmado) return { erro: AVISOS.confirmar_email.texto, valores: valoresDoFormulario(dados) };
  const resultado = esquemaDocumento.safeParse({
    relacao: texto(dados, "relacao"),
    mensagem: texto(dados, "mensagem"),
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error), valores: valoresDoFormulario(dados) };

  let aprovada: boolean;
  try {
    const pedido = await solicitarPorDocumento({
      empresaId: empresa.id,
      usuarioId: usuario.id,
      cnpj: null,
      site: null,
      relacao: resultado.data.relacao,
      // A moderação fala com a pessoa pelo e-mail da conta.
      contato: usuario.email,
      mensagem: resultado.data.mensagem || null,
    });
    aprovada = pedido.status === "aprovada";
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) return { erro: erro.message, valores: valoresDoFormulario(dados) };
    throw erro;
  }
  if (!aprovada) after(() => avisarNovaReivindicacao(empresa.id));
  await medir({ nome: "perfil_reivindicado", params: { method: "documento", resultado: aprovada ? "verificada" : "em_analise" } });
  if (aprovada) redirect(`/painel/${empresa.instagramUsername}?aviso=verificada`);
  const temDono = (await db.empresaMembro.count({ where: { empresaId: empresa.id } })) > 0;
  redirect(`${caminho}?aviso=${temDono ? "documento_enviado" : "documento_em_analise"}`);
}

export async function cancelarReivindicacao(dados: FormData): Promise<void> {
  const { usuario, caminho } = await carregar(dados);
  await cancelar(texto(dados, "reivindicacaoId"), usuario.id);
  redirect(`${caminho}?aviso=cancelada`);
}
