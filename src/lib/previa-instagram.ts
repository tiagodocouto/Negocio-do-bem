// Prévia do Instagram no cadastro por etapas: quando a pessoa digita o @ de um
// negócio novo, o site mostra a foto, o nome e o site do perfil, e já preenche o
// nome e o site no formulário. Ao cadastrar, a mesma foto vira a foto do perfil
// (gravarFotoDaPrevia, em src/lib/fotos-instagram.ts).
//
// Usa a API oficial da Meta (Business Discovery), a mesma da rotina de fotos
// (scripts/fotos-instagram.ts). Ela só enxerga contas profissionais (comerciais ou
// de criador), que nunca são privadas. Conta pessoal, privada ou pública, e @
// digitado errado voltam iguais: sem prévia. Sem as variáveis, com o token vencido
// ou com a Meta fora do ar, também não há prévia, e o formulário segue normal.

import "server-only";

export type PreviaInstagram = {
  nome: string | null;
  site: string | null;
  /** A foto em data URL: o site baixa a imagem, porque a política de conteúdo não libera o CDN da Meta. */
  foto: string | null;
};

/**
 * A prévia de cada @ fica guardada por 15 minutos em cada servidor, para não gastar
 * o limite da Meta. Só a que existe: sem prévia, a próxima procura consulta de novo,
 * e o "Já mudei, procurar de novo" funciona logo depois de a conta virar profissional.
 */
const VALIDADE_MS = 15 * 60 * 1000;
const MAXIMO_GUARDADAS = 500;
const LIMITE_DA_FOTO = 300_000;
const ESPERA_MS = 5000;
const guardadas = new Map<string, { em: number; previa: PreviaInstagram }>();

export function configPrevia(): { token: string; igUserId: string; versao: string } | null {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const igUserId = process.env.META_IG_USER_ID?.trim();
  if (!token || !igUserId) return null;
  return { token, igUserId, versao: process.env.META_GRAPH_VERSION?.trim() || "v26.0" };
}

function texto(valor: unknown, maximo: number): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim().slice(0, maximo) : null;
}

/** Só baixa fotos dos domínios da Meta, por https. */
export function fotoDaMeta(url: unknown): URL | null {
  if (typeof url !== "string") return null;
  try {
    const endereco = new URL(url);
    const host = endereco.hostname;
    const daMeta = host.endsWith(".fbcdn.net") || host.endsWith(".cdninstagram.com");
    return endereco.protocol === "https:" && daMeta ? endereco : null;
  } catch {
    return null;
  }
}

async function baixarFoto(url: URL): Promise<string | null> {
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS) });
    const tipo = resposta.headers.get("content-type") ?? "";
    if (!resposta.ok || !/^image\/(jpeg|png|webp)$/.test(tipo.split(";")[0]!.trim())) return null;
    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (bytes.length === 0 || bytes.length > LIMITE_DA_FOTO) return null;
    return `data:${tipo.split(";")[0]!.trim()};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

async function consultar(username: string): Promise<PreviaInstagram | null> {
  const config = configPrevia();
  if (!config) return null;
  const url = new URL(`https://graph.facebook.com/${config.versao}/${config.igUserId}`);
  // O @ já passou por normalizarUsername: só letras, números, ponto e sublinhado.
  url.searchParams.set("fields", `business_discovery.username(${username}){name,website,profile_picture_url}`);
  try {
    const resposta = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!resposta.ok) return null;
    const corpo = (await resposta.json()) as { business_discovery?: Record<string, unknown> };
    const perfil = corpo.business_discovery;
    if (!perfil) return null;
    const foto = fotoDaMeta(perfil.profile_picture_url);
    return {
      nome: texto(perfil.name, 80),
      site: texto(perfil.website, 200),
      foto: foto ? await baixarFoto(foto) : null,
    };
  } catch {
    return null;
  }
}

/** A prévia do perfil, ou null quando não há (ver o começo do arquivo). Nunca lança erro. */
export async function buscarPreviaDoInstagram(username: string): Promise<PreviaInstagram | null> {
  const agora = Date.now();
  const guardada = guardadas.get(username);
  if (guardada && agora - guardada.em < VALIDADE_MS) return guardada.previa;

  const previa = await consultar(username);
  if (!previa) return null;
  if (guardadas.size >= MAXIMO_GUARDADAS) guardadas.delete(guardadas.keys().next().value!);
  guardadas.set(username, { em: agora, previa });
  return previa;
}

/** A foto da prévia, que chega em data URL, como arquivo para guardar no site. */
export function arquivoDaFoto(foto: string): File | null {
  const partes = foto.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!partes) return null;
  return new File([Buffer.from(partes[2]!, "base64")], "instagram", { type: partes[1] });
}

/** Só para os testes: esquece as prévias guardadas. */
export function esquecerPrevias(): void {
  guardadas.clear();
}
