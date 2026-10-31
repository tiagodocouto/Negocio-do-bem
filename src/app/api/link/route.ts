import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_LINK, VALIDADE_MS } from "@/lib/auth/links";

/**
 * Onde chega o link do e-mail. Ele não usa o token: só o guarda num cookie e leva
 * a /link, que pede um clique. Os filtros de e-mail que abrem links sozinhos param
 * aqui, e o token sai do endereço antes de qualquer página carregar.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const resposta = NextResponse.redirect(new URL("/link", request.nextUrl.origin));
  if (token) {
    resposta.cookies.set(COOKIE_LINK, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/link",
      maxAge: VALIDADE_MS.confirmar / 1000,
    });
  }
  return resposta;
}
