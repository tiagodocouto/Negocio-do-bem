import "server-only";
import { betterAuth } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { opcoesAuth } from "@/lib/auth/better-auth";

// This server-only factory is not an action. Call only with an account validated by the server.
export function authParaContaValidada(usuarioId: string) {
  return betterAuth({
    ...opcoesAuth(),
    plugins: [{
      id: "sessao-validada",
      endpoints: {
        sessaoValidada: createAuthEndpoint.serverOnly({ method: "POST", body: z.strictObject({}) }, async (ctx) => {
          const usuario = await ctx.context.internalAdapter.findUserById(usuarioId);
          if (!usuario) throw new Error("Validated session account does not exist.");
          // Better Auth 1.7.14 internal API. The validated identity stays in this server-only closure.
          const sessao = await ctx.context.internalAdapter.createSession(usuario.id);
          if (!sessao) throw new Error("Validated session creation failed.");
          await setSessionCookie(ctx, { user: usuario, session: sessao });
          return ctx.json({ ok: true });
        }),
      },
    }],
  });
}
