import "server-only";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { db } from "@/lib/db";

// Cada login e cadastro calcula o scrypt (~32 MB de memória), então o limite é
// conferido antes dele. A contagem fica no banco porque o site roda em várias
// instâncias. A chave é o sha256 do IP ou do e-mail, para o banco não guardá-los.
export const LIMITE_POR_IP = 10;
export const LIMITE_POR_EMAIL = 5;
export const JANELA_MS = 15 * 60 * 1000;

function chave(tipo: "ip" | "ip-desconhecido" | "email", valor: string): string {
  return createHash("sha256").update(`${tipo}:${valor}`).digest("hex");
}

function inicioDaJanela(): Date {
  return new Date(Date.now() - JANELA_MS);
}

/**
 * Soma uma tentativa à janela atual, ou abre uma janela nova se a anterior venceu.
 * É um comando só no banco, para tentativas simultâneas não se perderem.
 */
async function contar(chaveTentativa: string): Promise<number> {
  const agora = new Date();
  const inicio = new Date(agora.getTime() - JANELA_MS);
  const [tentativa] = await db.$queryRaw<{ contagem: number }[]>`
    INSERT INTO "TentativaAcesso" ("chave", "contagem", "janelaIniciadaEm")
    VALUES (${chaveTentativa}, 1, ${agora})
    ON CONFLICT ("chave") DO UPDATE SET
      "contagem" = CASE WHEN "TentativaAcesso"."janelaIniciadaEm" >= ${inicio}
        THEN "TentativaAcesso"."contagem" + 1 ELSE 1 END,
      "janelaIniciadaEm" = CASE WHEN "TentativaAcesso"."janelaIniciadaEm" >= ${inicio}
        THEN "TentativaAcesso"."janelaIniciadaEm" ELSE EXCLUDED."janelaIniciadaEm" END
    RETURNING "contagem"`;
  return tentativa!.contagem;
}

/**
 * IP de quem fez a requisição, ou null quando não há como saber com segurança.
 * Cabeçalho que o visitante pode escrever não vale: se valesse, cada tentativa
 * traria um IP novo e o limite nunca agiria.
 * - No Vercel (VERCEL=1), só o x-vercel-forwarded-for, que o próprio Vercel escreve.
 * - Em outra hospedagem, nenhum cabeçalho, a menos que quem cuida do site declare
 *   com AUTENTICACAO_PROXY_CONFIAVEL=1 que há um proxy na frente que escreve o
 *   x-forwarded-for. Vale o último valor da lista, que é o que o proxy acrescentou.
 */
export function ipDoCabecalho(cabecalhos: Headers): string | null {
  const nome =
    process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : process.env.AUTENTICACAO_PROXY_CONFIAVEL === "1" ? "x-forwarded-for" : null;
  const ip = nome ? cabecalhos.get(nome)?.split(",").at(-1)?.trim() : undefined;
  return ip && !ip.includes("%") && isIP(ip) ? normalizarIp(ip) : null;
}

/**
 * Dá a mesma forma a endereços que valem como o mesmo visitante, para o contador não se dividir:
 * - IPv4 escrito como IPv6 (::ffff:203.0.113.5) vira o IPv4 (203.0.113.5);
 * - IPv6 vira o prefixo /64, porque quem recebe uma rede IPv6 escolhe qualquer
 *   endereço dela a cada requisição. Cada endereço teria um contador novo.
 * Recebe só um IP já conferido com `isIP`.
 */
export function normalizarIp(ip: string): string {
  if (isIP(ip) === 4) return ip;
  // O URL devolve o IPv6 em minúsculas e abreviado, e o IPv4 embutido em hexadecimal.
  const abreviado = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const [antes = "", depois = ""] = abreviado.split("::");
  const esquerda = antes ? antes.split(":") : [];
  const direita = depois ? depois.split(":") : [];
  const zeros = Array<string>(8 - esquerda.length - direita.length).fill("0");
  const grupos = [...esquerda, ...zeros, ...direita].map((grupo) => parseInt(grupo, 16));
  if (grupos.slice(0, 5).every((grupo) => grupo === 0) && grupos[5] === 0xffff) {
    return [grupos[6]! >> 8, grupos[6]! & 255, grupos[7]! >> 8, grupos[7]! & 255].join(".");
  }
  return `${grupos.slice(0, 4).map((grupo) => grupo.toString(16)).join(":")}::/64`;
}

/**
 * Conta uma tentativa de login ou de cadastro vinda deste IP e diz se ela pode seguir.
 * Sem IP conhecido, todas as tentativas dividem um contador só: o cadastro não tem
 * limite por e-mail, e sem este contador o scrypt ficaria sem freio.
 */
export async function tentativaDoIpLiberada(ip: string | null): Promise<boolean> {
  await db.tentativaAcesso.deleteMany({ where: { janelaIniciadaEm: { lt: inicioDaJanela() } } });
  return (await contar(ip ? chave("ip", ip) : chave("ip-desconhecido", ""))) <= LIMITE_POR_IP;
}

/**
 * O contador do e-mail é separado por origem (o IP, ou o /64 no IPv6): quem erra a senha
 * de outra pessoa de outro lugar não bloqueia a dona da conta. Sem IP confiável, as
 * tentativas sem IP dividem um contador só por e-mail.
 */
function chaveDoEmail(email: string, ip: string | null): string {
  return chave("email", `${email} ${ip ?? "ip-desconhecido"}`);
}

/**
 * Reserva uma tentativa de senha para este e-mail, vinda desta origem, e diz se ela pode
 * seguir: só as 5 primeiras da janela seguem. A reserva é um comando só no banco, feito
 * antes de conferir a senha: conferir primeiro e contar depois deixaria passar todas as
 * tentativas que chegam juntas antes de a primeira contar. Nada fica preso no banco durante o scrypt.
 */
export async function reservarTentativaDoEmail(email: string, ip: string | null): Promise<boolean> {
  return (await contar(chaveDoEmail(email, ip))) <= LIMITE_POR_EMAIL;
}

/** O login deu certo: a contagem daquele e-mail, naquela origem, volta a zero. */
export async function zerarTentativasDoEmail(email: string, ip: string | null): Promise<void> {
  await db.tentativaAcesso.deleteMany({ where: { chave: chaveDoEmail(email, ip) } });
}
