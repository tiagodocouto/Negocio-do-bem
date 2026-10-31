import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { CONFIRMACAO_DE_EMAIL_LIGADA } from "@/lib/auth/links";
import { db } from "@/lib/db";

const COOKIE = "ndb_sessao";
const DURACAO_MS = 30 * 24 * 60 * 60 * 1000;

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  moderador: boolean;
  // Indicar, escrever e denunciar depoimentos e reivindicar pedem o e-mail confirmado.
  // Com CONFIRMACAO_DE_EMAIL_LIGADA desligada, é sempre true.
  emailConfirmado: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Só o papel gravado no banco dá moderação, nunca o e-mail: quem se cadastrasse
 * com o endereço certo antes da pessoa levaria a moderação, e as contas antigas
 * nem confirmaram o e-mail. Para dar ou tirar: `npm run moderacao`.
 */
export function ehModerador(usuario: { papel: string }): boolean {
  return usuario.papel === "moderador";
}

/** Cria a sessão e grava o cookie. Só pode ser chamada em Server Actions e Route Handlers. */
export async function criarSessao(usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + DURACAO_MS);
  await db.sessao.create({ data: { id: hashToken(token), usuarioId, expiraEm } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });
}

export async function encerrarSessao(): Promise<void> {
  const loja = await cookies();
  const token = loja.get(COOKIE)?.value;
  if (token) await db.sessao.deleteMany({ where: { id: hashToken(token) } });
  loja.delete(COOKIE);
}

/** Usuário logado nesta requisição, ou null. Lido uma vez por requisição. */
export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const sessao = await db.sessao.findUnique({
    where: { id: hashToken(token) },
    include: { usuario: true },
  });
  if (!sessao || sessao.expiraEm <= new Date()) return null;
  const { usuario } = sessao;
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
