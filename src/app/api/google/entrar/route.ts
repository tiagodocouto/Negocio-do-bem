import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_GOOGLE, configGoogle, urlAutorizacao } from "@/lib/auth/google";
import { caminhoSeguro, usuarioAtual } from "@/lib/auth/sessao";

/** Começa o "Continuar com o Google" de /entrar e /cadastrar. */
export async function GET(request: NextRequest) {
  const origem = request.nextUrl.origin;
  const voltar = caminhoSeguro(request.nextUrl.searchParams.get("voltar"));
  if (await usuarioAtual()) return NextResponse.redirect(new URL(voltar, origem));

  const config = configGoogle();
  if (!config) {
    const destino = new URL("/entrar", origem);
    destino.search = new URLSearchParams({ voltar, aviso: "google_indisponivel" }).toString();
    return NextResponse.redirect(destino);
  }

  // O "state" volta do Google e precisa bater com o cookie: impede que alguém force
  // o retorno do login dele para dentro do navegador de outra pessoa. O verificador
  // do PKCE garante que só quem começou o login consegue trocar o código.
  const estado = randomBytes(24).toString("base64url");
  const verificador = randomBytes(32).toString("base64url");
  const resposta = NextResponse.redirect(urlAutorizacao(config, estado, verificador));
  resposta.cookies.set(COOKIE_GOOGLE, [estado, verificador, Buffer.from(voltar).toString("base64url")].join("."), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 10 * 60,
  });
  return resposta;
}
