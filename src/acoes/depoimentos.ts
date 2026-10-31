"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { AVISOS } from "@/lib/avisos";
import { db } from "@/lib/db";
import { texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import { avisarNovaDenuncia, avisarNovoDepoimento } from "@/lib/notificacoes";

const esquemaDepoimento = z
  .string()
  .trim()
  .min(20, "Conte um pouco mais (pelo menos 20 caracteres).")
  .max(1500, "Use até 1.500 caracteres.");

export async function publicarDepoimento(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const empresa = await db.empresa.findUnique({
    where: { id: texto(dados, "empresaId") },
    include: { membros: { select: { usuarioId: true } } },
  });
  if (!empresa) return { erro: "Negócio não encontrado." };
  const usuario = await exigirUsuario(`/empresas/${empresa.instagramUsername}#depoimentos`);
  if (!usuario.emailConfirmado) return { erro: AVISOS.confirmar_email.texto, valores: valoresDoFormulario(dados) };

  if (empresa.moderacao !== "aprovada" || empresa.oculta) {
    return { erro: "Este perfil ainda não está recebendo depoimentos." };
  }
  if (empresa.membros.some((m) => m.usuarioId === usuario.id)) {
    return { erro: "Donos não podem deixar depoimento no próprio negócio, mas podem responder aos depoimentos." };
  }

  const resultado = esquemaDepoimento.safeParse(texto(dados, "texto"));
  if (!resultado.success) {
    return { erros: { texto: resultado.error.issues[0]?.message ?? "Texto inválido." }, valores: valoresDoFormulario(dados) };
  }

  const jaEscreveu = await db.depoimento.findUnique({
    where: { empresaId_autorId: { empresaId: empresa.id, autorId: usuario.id } },
  });
  if (jaEscreveu) return { erro: "Você já deixou um depoimento para este negócio. Obrigado!" };

  const depoimento = await db.depoimento.create({ data: { empresaId: empresa.id, autorId: usuario.id, texto: resultado.data } });
  after(() => avisarNovoDepoimento(depoimento.id));
  redirect(`/empresas/${empresa.instagramUsername}?aviso=depoimento_publicado#depoimentos`);
}

export async function responderDepoimento(dados: FormData): Promise<void> {
  const depoimento = await db.depoimento.findUnique({
    where: { id: texto(dados, "depoimentoId") },
    include: { empresa: { include: { membros: { select: { usuarioId: true } } } } },
  });
  if (!depoimento) redirect("/painel");
  const usuario = await exigirUsuario("/painel");
  const { empresa } = depoimento;
  if (!empresa.membros.some((m) => m.usuarioId === usuario.id)) redirect("/painel");

  const resposta = texto(dados, "resposta").trim().slice(0, 1000);
  await db.depoimento.update({
    where: { id: depoimento.id },
    data: resposta ? { resposta, respondidoEm: new Date() } : { resposta: null, respondidoEm: null },
  });
  redirect(`/painel/${empresa.instagramUsername}?aviso=resposta_publicada#depoimentos`);
}

/** Denunciar não esconde o depoimento: só sinaliza para a moderação. */
export async function denunciarDepoimento(dados: FormData): Promise<void> {
  const depoimento = await db.depoimento.findUnique({
    where: { id: texto(dados, "depoimentoId") },
    include: { empresa: { select: { instagramUsername: true } } },
  });
  if (!depoimento) redirect("/");
  const voltar = `/empresas/${depoimento.empresa.instagramUsername}`;
  const usuario = await exigirUsuario(voltar);
  // A página esconde o botão para o autor; a regra vale aqui também.
  if (depoimento.autorId === usuario.id) redirect(`${voltar}#depoimentos`);
  if (!usuario.emailConfirmado) redirect(`${voltar}?aviso=confirmar_email#depoimentos`);

  // A condição `denunciado: false` fica no próprio UPDATE: com dois envios ao
  // mesmo tempo, só o primeiro grava e só ele avisa a moderação.
  const { count } = await db.depoimento.updateMany({
    where: { id: depoimento.id, denunciado: false, status: "publicado" },
    data: {
      denunciado: true,
      motivoDenuncia: texto(dados, "motivo").trim().slice(0, 300) || "Sem motivo informado",
      denunciadoPorId: usuario.id,
    },
  });
  if (count > 0) after(() => avisarNovaDenuncia(depoimento.id));
  redirect(`${voltar}?aviso=denuncia_enviada#depoimentos`);
}
