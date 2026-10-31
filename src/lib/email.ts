// Envio de e-mails pelo Resend (https://resend.com/docs/api-reference/emails/send-email).
//
// Opcional, como as outras integrações: sem RESEND_API_KEY e EMAIL_REMETENTE nada
// é enviado e o site funciona igual. Nos previews o envio fica desligado mesmo
// com as variáveis, porque o banco de previews só tem contas de teste.

import "server-only";
import { ambienteDeDeploy } from "@/lib/ambiente";

const API_RESEND = "https://api.resend.com/emails";

export type Email = { para: string; assunto: string; texto: string };

function config(): { chave: string; remetente: string; resposta: string | null } | null {
  const ambiente = ambienteDeDeploy();
  if (ambiente && ambiente !== "production") return null;
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE;
  if (!chave || !remetente) return null;
  return { chave, remetente, resposta: process.env.EMAIL_RESPOSTA || null };
}

export function envioLigado(): boolean {
  return config() !== null;
}

/**
 * Envia um e-mail para uma pessoa só. Nunca lança erro: uma falha no envio não
 * pode desfazer a ação de quem está no site. Devolve se o Resend aceitou.
 */
export async function enviarEmail(email: Email): Promise<boolean> {
  const atual = config();
  if (!atual) return false;
  try {
    const resposta = await fetch(API_RESEND, {
      method: "POST",
      headers: { Authorization: `Bearer ${atual.chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: atual.remetente,
        to: [email.para],
        ...(atual.resposta ? { reply_to: atual.resposta } : {}),
        subject: email.assunto,
        text: email.texto,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resposta.ok) {
      console.error(`O Resend recusou o e-mail "${email.assunto}" (HTTP ${resposta.status}): ${await resposta.text()}`);
      return false;
    }
    return true;
  } catch (erro) {
    console.error(`Não foi possível enviar o e-mail "${email.assunto}":`, erro);
    return false;
  }
}
