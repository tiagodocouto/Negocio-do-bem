import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { configLogin, COOKIE_ESTADO, urlAutorizacao } from "@/lib/instagram";

/** Começa o "Entrar com Instagram" para reivindicar um negócio. */
export async function GET(request: NextRequest) {
  const origem = request.nextUrl.origin;
  const empresaId = request.nextUrl.searchParams.get("empresa") ?? "";
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { instagramUsername: true } });
  if (!empresa) return NextResponse.redirect(new URL("/", origem));

  const voltar = `/empresas/${empresa.instagramUsername}/reivindicar`;
  const config = configLogin();
  if (!config) return NextResponse.redirect(new URL(`${voltar}?aviso=ig_indisponivel`, origem));

  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.redirect(new URL(`/entrar?voltar=${encodeURIComponent(voltar)}`, origem));
  // A página de reivindicar mostra o pedido para confirmar o e-mail no lugar das opções.
  if (!usuario.emailConfirmado) return NextResponse.redirect(new URL(voltar, origem));

  // O "state" volta do Instagram e precisa bater com o cookie: impede que alguém
  // force o retorno do login de outra pessoa para dentro da sua conta.
  const estado = randomBytes(24).toString("base64url");
  const resposta = NextResponse.redirect(urlAutorizacao(config, estado));
  resposta.cookies.set(COOKIE_ESTADO, `${estado}.${empresaId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/instagram",
    maxAge: 10 * 60,
  });
  return resposta;
}
