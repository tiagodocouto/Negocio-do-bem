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
  documento_em_analise: {
    tipo: "info",
    texto: "Recebemos seus dados. A moderação analisa o pedido e pode falar com você pelo contato informado.",
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
  arroba_trocado: { tipo: "sucesso", texto: "@ do Instagram trocado. O endereço antigo da página leva para o novo." },
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
  dono_removido: {
    tipo: "sucesso",
    texto: "Dono removido. A pessoa recebe o motivo por e-mail, e um pedido novo dela para este negócio vai para a moderação.",
  },
  dono_ja_removido: { tipo: "erro", texto: "Essa conta já não era dona deste negócio." },
  dono_sem_confirmacao: { tipo: "erro", texto: "Marque a confirmação para remover o dono. Nada foi alterado." },
  clube_liberado: { tipo: "sucesso", texto: "Dono liberado para criar ofertas no Clube do Bem." },
  clube_suspenso: { tipo: "info", texto: "Liberação suspensa. O dono não cria mais ofertas até ser liberado de novo." },
  clube_cnpj_invalido: { tipo: "erro", texto: "CNPJ inválido. Confira os números." },
  clube_cnpj_inativo: { tipo: "erro", texto: "Este CNPJ não está ativo na Receita, então o dono não pode ser liberado." },
  clube_receita_indisponivel: {
    tipo: "erro",
    texto: "Não foi possível consultar a Receita agora, e sem a consulta não há liberação. Tente de novo em alguns minutos.",
  },
  clube_nao_e_dono: { tipo: "erro", texto: "Essa conta não é dona deste negócio." },
  clube_recusado: { tipo: "info", texto: "Pedido recusado. O dono vê o motivo no painel e pode pedir de novo." },
  clube_ja_decidido: { tipo: "erro", texto: "Este pedido já tinha sido decidido por outra pessoa da moderação." },
  clube_pedido_enviado: {
    tipo: "sucesso",
    texto: "Pedido enviado. A moderação confere o CNPJ na Receita e a resposta aparece aqui.",
  },
  oferta_criada: { tipo: "sucesso", texto: "Oferta no ar! Ela aparece no perfil do negócio até o último dia." },
  oferta_encerrada: { tipo: "info", texto: "Oferta encerrada. Quem já gerou o cupom pode usar até o fim previsto." },
  cupom_gerado: { tipo: "sucesso", texto: "Seu cupom está pronto. Mostre o código na hora da compra." },
  cupom_esgotado: { tipo: "erro", texto: "Os cupons desta oferta acabaram." },
  cupom_indisponivel: { tipo: "erro", texto: "Esta oferta não está mais valendo." },
  cupom_usado: { tipo: "sucesso", texto: "Cupom usado. Pode dar o desconto." },
  cupom_ja_usado: { tipo: "erro", texto: "Este cupom já foi usado. Não dê o desconto de novo." },
  cupom_vencido: { tipo: "erro", texto: "Este cupom venceu junto com a oferta." },
  cupom_suspenso: { tipo: "erro", texto: "A oferta deste cupom foi suspensa pela moderação. Ele não vale." },
  cupom_nao_encontrado: { tipo: "erro", texto: "Não achamos um cupom com esse código neste negócio. Confira as letras." },
  embaixador_salvo: { tipo: "sucesso", texto: "Embaixador salvo." },
  embaixador_salvo_sem_instagram: {
    tipo: "info",
    texto:
      "Embaixador salvo, mas o Instagram não mostrou esta conta. Confira o @. Se a conta for pessoal ou privada, marque os seguidores à mão.",
  },
  embaixador_atualizado: { tipo: "sucesso", texto: "Seguidores atualizados pelo Instagram." },
  embaixador_sem_instagram: {
    tipo: "erro",
    texto: "O Instagram não mostrou esta conta agora. Ela pode ser pessoal ou privada, ou o @ mudou.",
  },
  embaixador_excluido: { tipo: "info", texto: "Embaixador excluído." },
};

export function avisoDe(codigo: unknown) {
  return typeof codigo === "string" ? AVISOS[codigo] : undefined;
}
