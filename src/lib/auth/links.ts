// Links mandados por e-mail: confirmar o endereço da conta, entrar sem senha ou criar uma senha nova.
//
// O token vai só no link. O banco guarda o sha256 dele, como na sessão. Cada link
// vale uma vez, por pouco tempo, e só enquanto a conta tiver o e-mail para onde foi.
//
// Abrir o link não usa o token: /api/link guarda o token num cookie e leva a /link,
// que pede um clique. Assim os filtros de e-mail que abrem links sozinhos não gastam
// o link, e o token sai do endereço antes de a página carregar o Google Analytics.

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ambienteDeDeploy } from "@/lib/ambiente";
import { gerarHashSenha } from "@/lib/auth/senha";
import { registrarAuditoria } from "@/lib/auditoria";
import { db, type Prisma } from "@/lib/db";
import { enviarEmail, envioLigado } from "@/lib/email";
import { corpo, primeiroNome } from "@/lib/notificacoes";
import { ENDERECO_DO_SITE, NOME_DO_SITE } from "@/lib/seo";

export type Finalidade = "confirmar" | "entrar" | "redefinir";

/**
 * Pedir o e-mail confirmado para indicar, escrever e denunciar depoimentos e reivindicar.
 * Desligado por enquanto: o plano grátis do Resend manda só 100 e-mails por dia, e quem
 * se cadastrava depois disso ficava sem o link e travado. Desligado, toda conta vale
 * como confirmada e o cadastro não manda o link. Ligue de novo junto com o novo envio.
 */
export const CONFIRMACAO_DE_EMAIL_LIGADA: boolean = false;

/** Cookie onde /api/link guarda o token até o clique em /link. */
export const COOKIE_LINK = "ndb_link";

export const VALIDADE_MS: Record<Finalidade, number> = {
  confirmar: 24 * 60 * 60 * 1000,
  entrar: 15 * 60 * 1000,
  redefinir: 60 * 60 * 1000,
};

/** Links por conta a cada hora: ninguém lota a caixa de outra pessoa nem gasta a cota do Resend. */
export const LIMITE_LINKS_POR_HORA = 5;
const HORA_MS = 60 * 60 * 1000;

type Conta = { id: string; nome: string; email: string };

export type LinkValido = { finalidade: Finalidade; destino: string; usuario: Conta };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cria o link e devolve o token, ou null se a conta já recebeu links demais na última hora. */
export async function criarLink(conta: Conta, finalidade: Finalidade, destino = "/"): Promise<string | null> {
  const agora = Date.now();
  const recentes = await db.linkEmail.count({
    where: { usuarioId: conta.id, criadoEm: { gte: new Date(agora - HORA_MS) } },
  });
  if (recentes >= LIMITE_LINKS_POR_HORA) return null;
  // Um link vencido há mais de uma hora já não conta no limite.
  await db.linkEmail.deleteMany({ where: { usuarioId: conta.id, expiraEm: { lt: new Date(agora - HORA_MS) } } });

  const token = randomBytes(32).toString("base64url");
  await db.linkEmail.create({
    data: {
      id: hashToken(token),
      usuarioId: conta.id,
      finalidade,
      email: conta.email,
      destino,
      expiraEm: new Date(agora + VALIDADE_MS[finalidade]),
    },
  });
  return token;
}

/** O link ainda vale? Só olha, sem usar: é o que /link mostra antes do clique. */
export async function lerLink(token: string): Promise<LinkValido | null> {
  if (!token) return null;
  const link = await db.linkEmail.findUnique({
    where: { id: hashToken(token) },
    include: { usuario: { select: { id: true, nome: true, email: true } } },
  });
  if (!link || link.usadoEm || link.expiraEm <= new Date() || link.email !== link.usuario.email) return null;
  return { finalidade: link.finalidade as Finalidade, destino: link.destino, usuario: link.usuario };
}

/**
 * Usa o link uma vez só: dois cliques ao mesmo tempo não usam o mesmo link duas vezes.
 * Qualquer link usado confirma o e-mail, porque prova que a pessoa abriu a caixa dele.
 * Criar a sessão, no link de entrar, fica com quem chama.
 */
export async function usarLink(token: string): Promise<LinkValido | null> {
  const link = await lerLink(token);
  if (!link) return null;
  const agora = new Date();
  const { count } = await db.linkEmail.updateMany({
    where: { id: hashToken(token), usadoEm: null, expiraEm: { gt: agora } },
    data: { usadoEm: agora },
  });
  if (count === 0) return null;
  await db.usuario.updateMany({
    where: { id: link.usuario.id, email: link.usuario.email, emailConfirmadoEm: null },
    data: { emailConfirmadoEm: agora },
  });
  return link;
}

/**
 * A senha mudou: os links ainda abertos da conta deixam de valer, inclusive o de entrar.
 * Sem isto, quem invadiu a conta e pediu um link voltaria por ele depois da troca.
 */
export async function gastarLinksAbertos(tx: Prisma.TransactionClient, usuarioId: string, agora: Date): Promise<void> {
  await tx.linkEmail.updateMany({ where: { usuarioId, usadoEm: null }, data: { usadoEm: agora } });
}

/**
 * Troca a senha de quem abriu um link de redefinir. Num passo só, para dois envios ao mesmo
 * tempo não usarem o mesmo link: gasta o link e os outros abertos da conta, troca a senha,
 * encerra todas as sessões (quem entrou com a senha antiga, ou com ela vazada, perde o
 * acesso) e deixa o registro na auditoria. Como em `usarLink`, o link confirma o e-mail.
 * Devolve a conta, ou null quando o link não existe, venceu, já foi usado ou é de outra finalidade.
 */
export async function redefinirSenhaComLink(token: string, novaSenha: string): Promise<Conta | null> {
  const link = await lerLink(token);
  if (!link || link.finalidade !== "redefinir") return null;
  const { usuario } = link;
  // O scrypt fica fora da transação, para ela não segurar o banco durante o cálculo.
  const senhaHash = await gerarHashSenha(novaSenha);
  const agora = new Date();
  const trocou = await db.$transaction(async (tx) => {
    const { count } = await tx.linkEmail.updateMany({
      where: { id: hashToken(token), usadoEm: null, expiraEm: { gt: agora } },
      data: { usadoEm: agora },
    });
    if (count === 0) return false;
    await gastarLinksAbertos(tx, usuario.id, agora);
    await tx.usuario.updateMany({ where: { id: usuario.id, email: usuario.email, emailConfirmadoEm: null }, data: { emailConfirmadoEm: agora } });
    await tx.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });
    await tx.sessao.deleteMany({ where: { usuarioId: usuario.id } });
    await registrarAuditoria(tx, { usuarioId: usuario.id, acao: "usuario.senha_redefinida", alvoTipo: "usuario", alvoId: usuario.id });
    return true;
  });
  return trocou ? usuario : null;
}

/**
 * Endereço que vai no e-mail. Vem da configuração e nunca do cabeçalho Host da
 * requisição: quem forjasse o Host receberia no próprio site o link de outra pessoa.
 * Nos previews do Vercel, o link aponta para o próprio preview; em Cloudflare,
 * APP_URL é configurado para o endereço canônico.
 */
export function urlDoLink(token: string): string {
  const base = process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ENDERECO_DO_SITE;
  return `${base}/api/link?t=${token}`;
}

/**
 * Manda o link por e-mail. Sem o envio configurado (no `npm run dev` e nos previews),
 * o link vai para o log do servidor. Na produção, não: o log daria a conta a quem o lê.
 */
export async function enviarLink(conta: Conta, finalidade: Finalidade, token: string): Promise<void> {
  const url = urlDoLink(token);
  if (!envioLigado()) {
    if (ambienteDeDeploy() !== "production") {
      console.info(`[e-mail desligado] Link para ${finalidade} da conta ${conta.email}: ${url}`);
    }
    return;
  }
  const ola = `Olá, ${primeiroNome(conta.nome)}!`;
  if (finalidade === "confirmar") {
    await enviarEmail({
      para: conta.email,
      assunto: `Confirme seu e-mail no ${NOME_DO_SITE}`,
      texto: corpo(
        ola,
        "Para confirmar que este e-mail é seu, abra o link abaixo e clique em “Confirmar meu e-mail”. Depois disso você pode indicar negócios, deixar depoimentos e assumir o perfil do seu negócio.",
        url,
        `O link vale por 24 horas. Se você não criou uma conta no ${NOME_DO_SITE}, é só ignorar este e-mail.`,
      ),
    });
  } else if (finalidade === "redefinir") {
    await enviarEmail({
      para: conta.email,
      assunto: `Crie uma senha nova no ${NOME_DO_SITE}`,
      texto: corpo(
        ola,
        "Recebemos um pedido para criar uma senha nova para a sua conta. Para escolher a senha, abra o link abaixo.",
        url,
        "O link vale por 1 hora e uma vez só. Se não foi você que pediu, ignore este e-mail: a sua senha continua a mesma.",
      ),
    });
  } else {
    await enviarEmail({
      para: conta.email,
      assunto: `Seu link para entrar no ${NOME_DO_SITE}`,
      texto: corpo(
        ola,
        "Para entrar na sua conta, abra o link abaixo e clique em “Entrar”.",
        url,
        "O link vale por 15 minutos e uma vez só. Se não foi você que pediu, ignore este e-mail: sem ele, ninguém entra na sua conta.",
      ),
    });
  }
}
