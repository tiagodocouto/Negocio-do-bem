import "server-only";
import { cookies } from "next/headers";
import { COOKIE_EVENTOS, juntarEvento, type Evento } from "@/lib/medicao";

/**
 * Registra no Analytics uma ação que deu certo no servidor. O evento espera num cookie
 * curto, e o navegador o manda na página seguinte (`EventosAnalytics`): assim ele entra na
 * mesma visita, com a origem dela (Instagram, Google, link direto), e só conta o que foi
 * salvo, nunca a tentativa. Chame antes do `redirect`. Sem o Analytics, não faz nada.
 */
export async function medir(evento: Evento): Promise<void> {
  if (!process.env.NEXT_PUBLIC_GA_ID) return;
  const loja = await cookies();
  loja.set(COOKIE_EVENTOS, juntarEvento(loja.get(COOKIE_EVENTOS)?.value, evento), {
    // O script do navegador lê e apaga o cookie: ele não pode ser httpOnly.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 5 * 60,
  });
}
