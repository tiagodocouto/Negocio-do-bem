import type { TipoAviso } from "@/components/Aviso";

// Mensagens mostradas depois de um redirecionamento (?aviso=codigo).
// Só códigos conhecidos viram texto: nada da URL é exibido diretamente.
export const AVISOS: Record<string, { tipo: TipoAviso; texto: string }> = {
  indicada: {
    tipo: "sucesso",
    texto: "Obrigado por indicar! O perfil já está no diretório.",
  },
  verificada: {
    tipo: "sucesso",
    texto: "Pronto! Você agora é dono deste perfil e pode contar a história do seu negócio no painel.",
  },
  em_analise: {
    tipo: "info",
    texto: "Recebemos sua solicitação. A moderação vai analisar e o resultado aparece no seu painel.",
  },
  documento_enviado: {
    tipo: "info",
    texto: "Recebemos seus dados. Como este perfil já tem dono, a moderação decide e pode falar com você pelo contato informado.",
  },
  ig_conta_diferente: {
    tipo: "erro",
    texto: "Você entrou com uma conta do Instagram diferente da deste negócio. Saia do Instagram e entre com a conta do negócio.",
  },
  ig_cancelado: { tipo: "erro", texto: "O login no Instagram foi cancelado. Nada foi alterado." },
  ig_erro: {
    tipo: "erro",
    texto: "Não conseguimos confirmar sua conta com o Instagram agora. Tente de novo ou envie os dados do negócio.",
  },
  ig_indisponivel: {
    tipo: "erro",
    texto: "O login com Instagram ainda não está disponível. Envie os dados do negócio.",
  },
  google_cancelado: { tipo: "erro", texto: "O login com o Google foi cancelado." },
  google_erro: {
    tipo: "erro",
    texto: "Não conseguimos entrar com o Google agora. Tente de novo ou entre com e-mail e senha.",
  },
  google_indisponivel: {
    tipo: "erro",
    texto: "O login com o Google ainda não está disponível. Entre com e-mail e senha.",
  },
  google_email_nao_verificado: {
    tipo: "erro",
    texto: "O Google ainda não confirmou o e-mail dessa conta. Confirme o e-mail no Google ou entre com e-mail e senha.",
  },
  google_outra_conta: {
    tipo: "erro",
    texto: "Este e-mail já está ligado a outra conta do Google. Entre com ela, com a senha ou com um link por e-mail.",
  },
  redefinicao_pedida: {
    tipo: "info",
    texto: "Se existe uma conta com esse e-mail, mandamos um link para criar uma senha nova. Ele vale por 1 hora.",
  },
  senha_trocada: { tipo: "sucesso", texto: "Senha trocada. Os outros aparelhos saíram da sua conta." },
  limite: {
    tipo: "erro",
    texto: "Você fez muitas solicitações nas últimas 24 horas. Tente de novo amanhã.",
  },
  salvo: { tipo: "sucesso", texto: "Alterações salvas." },
  foto_salva: { tipo: "sucesso", texto: "Foto atualizada." },
  foto_removida: { tipo: "info", texto: "Foto removida." },
  oculta: { tipo: "info", texto: "Seu negócio saiu do diretório. Você pode voltar a mostrá-lo quando quiser." },
  visivel: { tipo: "sucesso", texto: "Seu negócio voltou a aparecer no diretório." },
  depoimento_publicado: { tipo: "sucesso", texto: "Obrigado! Seu depoimento já está no ar." },
  resposta_publicada: { tipo: "sucesso", texto: "Resposta publicada." },
  denuncia_enviada: { tipo: "info", texto: "Denúncia enviada. A moderação vai avaliar." },
  confirmar_email: {
    tipo: "erro",
    texto: "Antes, confirme o seu e-mail: abra o link que mandamos para você ou peça outro no seu painel.",
  },
  feito: { tipo: "sucesso", texto: "Feito." },
  ja_processada: { tipo: "erro", texto: "Esta solicitação já tinha sido decidida por outra pessoa da moderação." },
  ja_decidido: { tipo: "erro", texto: "Outra pessoa da moderação já tinha decidido isso. A lista mostra como ficou." },
  cancelada: { tipo: "info", texto: "Solicitação cancelada." },
};

export function avisoDe(codigo: unknown) {
  return typeof codigo === "string" ? AVISOS[codigo] : undefined;
}
