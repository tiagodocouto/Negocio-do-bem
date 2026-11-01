import "server-only";
import { cabecalhosAuth, criarAuth, gravarCookiesAuth } from "@/lib/auth/better-auth";
import { authParaContaValidada } from "@/lib/auth/ponte-sessao";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { CONFIRMACAO_DE_EMAIL_LIGADA } from "@/lib/auth/links";
import { db } from "@/lib/db";

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  moderador: boolean;
  // Indicar, escrever e denunciar depoimentos e reivindicar pedem o e-mail confirmado.
  // Com CONFIRMACAO_DE_EMAIL_LIGADA desligada, é sempre true.
  emailConfirmado: boolean;
};

/**
 * Só o papel gravado no banco dá moderação, nunca o e-mail: quem se cadastrasse
 * com o endereço certo antes da pessoa levaria a moderação, e as contas antigas
 * nem confirmaram o e-mail. Para dar ou tirar: `npm run moderacao`.
 */
export function ehModerador(usuario: { papel: string }): boolean {
  return usuario.papel === "moderador";
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const resposta = await authParaContaValidada(usuarioId).api.sessaoValidada({ body: {}, headers: await cabecalhosAuth(), returnHeaders: true });
  await gravarCookiesAuth(resposta.headers);
}

export async function encerrarSessao(): Promise<void> {
  const resposta = await criarAuth().api.signOut({ headers: await cabecalhosAuth(), returnHeaders: true });
  await gravarCookiesAuth(resposta.headers);
}

/** Current Better Auth session ID. Password changes preserve only this session. */
export async function idDaSessaoAtual(): Promise<string | null> {
  const cabecalhos = await cabecalhosAuth();
  const sessao = await criarAuth().api.getSession({ headers: cabecalhos });
  return sessao?.session.id ?? null;
}

/** Usuário logado nesta requisição, ou null. Lido uma vez por requisição. */
export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const cabecalhos = await cabecalhosAuth();
  const sessao = await criarAuth().api.getSession({ headers: cabecalhos });
  if (!sessao) return null;
  const usuario = await db.usuario.findUnique({ where: { id: sessao.user.id } });
  if (!usuario) return null;
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    moderador: ehModerador(usuario),
    emailConfirmado: !CONFIRMACAO_DE_EMAIL_LIGADA || usuario.emailConfirmadoEm !== null,
  };
});

/** Exige login; senão manda para /entrar e volta para `voltarPara` depois. */
export async function exigirUsuario(voltarPara: string): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect(`/entrar?voltar=${encodeURIComponent(voltarPara)}`);
  return usuario;
}

/** Para quem não é moderador, a área de moderação simplesmente não existe. */
export async function exigirModerador(): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario?.moderador) notFound();
  return usuario;
}

/**
 * Aceita só caminhos internos, para o ?voltar= não virar um redirecionamento aberto.
 * Recusa autoridades, barras invertidas e controles antes de conferir a origem da URL (padrão WHATWG).
 * O TAB, o LF e o CR somem na interpretação, então "/<TAB>/host" viraria "//host", uma URL de outro site.
 */
export function caminhoSeguro(valor: unknown, padrao = "/"): string {
  if (
    typeof valor !== "string" ||
    !valor.startsWith("/") ||
    valor.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(valor)
  ) {
    return padrao;
  }
  const origem = "http://origem.invalid";
  try {
    if (new URL(valor, origem).origin !== origem) return padrao;
  } catch {
    return padrao;
  }
  return valor;
}
