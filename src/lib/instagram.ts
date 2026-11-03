// Integração com o Instagram (Instagram API with Instagram Login).
//
// Uso opcional, ligado por variáveis de ambiente: no "Entrar com Instagram", o
// dono faz login na conta profissional do negócio e o Instagram nos diz qual @
// ele controla.
//
// Documentação: https://developers.facebook.com/docs/instagram-platform

import { ehEnderecoSemInstagram } from "@/lib/endereco";

const HOST_GRAPH = "https://graph.instagram.com";

// Caminhos de instagram.com que não são perfis.
const ROTAS_RESERVADAS = new Set(["p", "reel", "reels", "explore", "stories", "accounts", "direct", "tv"]);

/**
 * Aceita "@fulano", "fulano" ou um link do perfil e devolve "fulano".
 * Retorna null se não parecer um @ válido do Instagram.
 */
export function normalizarUsername(entrada: unknown): string | null {
  if (typeof entrada !== "string") return null;
  let valor = entrada.trim();
  const link = valor.match(/instagram\.com\/([^/?#\s]+)/i);
  if (link) valor = link[1]!;
  valor = valor.replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(valor)) return null;
  if (valor.startsWith(".") || valor.endsWith(".") || valor.includes("..")) return null;
  if (ROTAS_RESERVADAS.has(valor)) return null;
  return valor;
}

export function linkPerfil(username: string): string {
  return `https://www.instagram.com/${username}/`;
}

/** Lê o endereço da URL: um @ do Instagram ou o endereço de um negócio sem Instagram (src/lib/endereco.ts). */
export function normalizarEndereco(entrada: unknown): string | null {
  return ehEnderecoSemInstagram(entrada) ? entrada : normalizarUsername(entrada);
}

/** @ do Negócio do Bem no Instagram, mostrado como contato do projeto. */
export function perfilOficial(): string | null {
  return normalizarUsername(process.env.INSTAGRAM_PERFIL_OFICIAL);
}

function versaoGraph(): string {
  return process.env.INSTAGRAM_GRAPH_VERSION || "v25.0";
}

// ---------------------------------------------------------------------------
// Entrar com Instagram (OAuth)
// ---------------------------------------------------------------------------

/** Cookie que guarda o "state" do OAuth e o negócio sendo reivindicado. */
export const COOKIE_ESTADO = "ndb_ig_estado";

export type ConfigLogin = { appId: string; appSecret: string; redirectUri: string };

export function configLogin(): ConfigLogin | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const appUrl = process.env.APP_URL;
  if (!appId || !appSecret || !appUrl) return null;
  return { appId, appSecret, redirectUri: `${appUrl.replace(/\/+$/, "")}/api/instagram/retorno` };
}

export function urlAutorizacao(config: ConfigLogin, estado: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    // Só precisamos saber quem é a conta: nenhuma permissão de publicar ou ler DMs.
    scope: "instagram_business_basic",
    state: estado,
    // Pede o login de novo, para a pessoa escolher a conta do negócio
    // mesmo que o navegador esteja logado em outra.
    force_reauth: "true",
  }).toString();
  return url.toString();
}

export async function trocarCodigoPorToken(config: ConfigLogin, codigo: string): Promise<string> {
  const resposta = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code: codigo,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = objeto(await resposta.json().catch(() => null));
  // A resposta já veio como objeto simples e como { data: [ ... ] }; aceitamos as duas.
  const dados = Array.isArray(json?.data) ? objeto(json.data[0]) : json;
  const token = dados?.access_token;
  if (!resposta.ok || typeof token !== "string") {
    throw new Error(`O Instagram não aceitou o código de autorização (HTTP ${resposta.status}).`);
  }
  return token;
}

export type ContaInstagram = { userId: string; username: string };

/** Pergunta ao Instagram qual conta acabou de autorizar o login. */
export async function buscarContaConectada(token: string): Promise<ContaInstagram> {
  const url = new URL(`${HOST_GRAPH}/${versaoGraph()}/me`);
  url.searchParams.set("fields", "user_id,username");
  url.searchParams.set("access_token", token);
  const resposta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const json = objeto(await resposta.json().catch(() => null));
  const userId = json?.user_id;
  const username = normalizarUsername(json?.username);
  if (!resposta.ok || (typeof userId !== "string" && typeof userId !== "number") || !username) {
    throw new Error(`Não foi possível ler a conta conectada (HTTP ${resposta.status}).`);
  }
  return { userId: String(userId), username };
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}
