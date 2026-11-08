/**
 * Ambiente do deploy ("production" ou "preview"), ou undefined fora de um deploy,
 * como no computador de quem desenvolve. No Cloudflare vem do DEPLOY_ENV; no
 * Vercel, do VERCEL_ENV. Variável vazia conta como ausente.
 */
export function ambienteDeDeploy(): string | undefined {
  return process.env.DEPLOY_ENV || process.env.VERCEL_ENV || undefined;
}
