import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { cookies, headers } from "next/headers";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { gerarHashSenha, verificarSenha } from "@/lib/auth/senha";
import { db, type Prisma } from "@/lib/db";

export function opcoesAuth() {
  if (!process.env.BETTER_AUTH_SECRETS) throw new Error("Better Auth versioned secrets are not set.");
  if (!process.env.APP_URL) throw new Error("Better Auth application URL is not set.");
  return {
    baseURL: process.env.APP_URL,
    database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
    logger: { level: "error" },
    user: {
      modelName: "usuario",
      fields: { name: "nome", emailVerified: "emailVerificado", image: "imagem", createdAt: "criadoEm", updatedAt: "atualizadoEm" },
      additionalFields: {
        papel: { type: "string", input: false, defaultValue: "membro" },
        telefone: { type: "string", required: false, input: false },
        emailConfirmadoEm: { type: "date", required: false, input: false },
      },
    },
    session: {
      modelName: "sessao",
      fields: { userId: "usuarioId", expiresAt: "expiraEm", createdAt: "criadoEm", updatedAt: "atualizadoEm", ipAddress: "ip", userAgent: "userAgent" },
      expiresIn: 2592000,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "vinculoAuth",
      fields: {
        userId: "usuarioId", accountId: "contaId", providerId: "provedorId", password: "senha",
        accessTokenExpiresAt: "accessTokenExpiraEm", refreshTokenExpiresAt: "refreshTokenExpiraEm",
        scope: "escopo", createdAt: "criadoEm", updatedAt: "atualizadoEm",
      },
    },
    verification: {
      modelName: "verificacaoAuth",
      fields: { identifier: "identificador", value: "valor", expiresAt: "expiraEm", createdAt: "criadoEm", updatedAt: "atualizadoEm" },
      storeIdentifier: "hashed",
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 200,
      password: { hash: gerarHashSenha, verify: ({ password, hash }) => verificarSenha(password, hash) },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      cookies: { session_token: { name: "ndb_sessao", attributes: { httpOnly: true, sameSite: "lax", path: "/" } } },
    },
    databaseHooks: {
      session: { create: { before: async () => ({ data: { ipAddress: null, userAgent: null } }) } },
    },
    disabledPaths: ["/sign-in/email", "/sign-up/email", "/change-password", "/reset-password", "/request-password-reset"],
  } satisfies BetterAuthOptions;
}

export function criarAuth() {
  return betterAuth(opcoesAuth());
}

export async function cabecalhosAuth(): Promise<Headers> {
  const cabecalhos = new Headers(await headers());
  cabecalhos.set("cookie", (await cookies()).toString());
  return cabecalhos;
}

export async function gravarCookiesAuth(cabecalhos: Headers): Promise<void> {
  const loja = await cookies();
  for (const [nome, valor] of parseSetCookieHeader(cabecalhos.get("set-cookie") ?? "")) {
    loja.set(nome, valor.value, toCookieOptions(valor));
  }
}

export async function gravarCredencial(tx: Prisma.TransactionClient, usuarioId: string, senha: string): Promise<void> {
  await tx.vinculoAuth.upsert({
    where: { provedorId_contaId: { provedorId: "credential", contaId: usuarioId } },
    create: { usuarioId, contaId: usuarioId, provedorId: "credential", senha },
    update: { senha },
  });
}
