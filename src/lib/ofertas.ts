import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { podeCriarOfertas } from "@/lib/clube";
import { db, type Prisma } from "@/lib/db";

// Ofertas e cupons do Clube do Bem (#248). Só um dono liberado pela moderação cria ofertas
// (src/lib/clube.ts), e só quem favoritou o negócio gera cupom: gerar o cupom já favorita.

export const DIAS_MAXIMOS = 15;
export const DIAS_PADRAO = 7;
// O desconto é livre (decisão de 06/11/2026): até 100%, ou qualquer valor em reais. O teto em
// reais só garante que o número cabe no banco.
export const VALOR_MAXIMO_EM_REAIS = 1_000_000;

export const TIPOS_DE_OFERTA = { percentual: "Desconto em %", valor: "Desconto em reais", brinde: "Brinde" } as const;
export type TipoDeOferta = keyof typeof TIPOS_DE_OFERTA;
export const ONDE_VALE = { local: "No local", whatsapp: "Pelo WhatsApp", site: "Pelo site" } as const;
export type OndeVale = keyof typeof ONDE_VALE;

/** O dia de hoje (AAAA-MM-DD) no horário de Brasília. */
export function hojeEmBrasilia(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/** Soma dias a um dia AAAA-MM-DD. */
export function somarDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** 23h59 de um dia (AAAA-MM-DD) no horário de Brasília, que não tem horário de verão desde 2019. */
export function fimDoDia(dia: string): Date {
  return new Date(`${dia}T23:59:59.999-03:00`);
}

/**
 * O texto traz link, e-mail, telefone, documento ou Pix? O título e as condições da oferta não
 * podem: o contato é sempre o do perfil, e o desconto vale na hora da compra. Datas com barra
 * ("10/11") passam; um número com 8 dígitos ou mais seguidos (telefone, CPF, CNPJ) não.
 */
export function temContatoOuPagamento(texto: string): boolean {
  return (
    /https?:\/\/|www\.|\b[\w-]+\.(com|br|net|org|io|me|app|link|site|store|shop|online)\b/i.test(texto) ||
    /\S+@\S+\.\S+/.test(texto) ||
    /\d{8,}/.test(texto.replace(/[\s.()-]/g, "")) ||
    /\bpix\b/i.test(texto)
  );
}

const SEM_CONTATO = "Tire links, telefones, e-mails, documentos e Pix do texto. O contato é sempre o do perfil.";

/** Os dados da oferta, conferidos. `hoje` é o dia de Brasília em que ela é criada. */
export function esquemaDaOferta(hoje: string) {
  return z
    .object({
      titulo: z
        .string()
        .trim()
        .min(5, "Dê um título à oferta (pelo menos 5 caracteres).")
        .max(60, "Use até 60 caracteres.")
        .refine((t) => !temContatoOuPagamento(t), SEM_CONTATO),
      tipo: z.enum(["percentual", "valor", "brinde"], { message: "Escolha o tipo de oferta." }),
      valor: z.string().trim(),
      condicoes: z
        .string()
        .trim()
        .max(300, "Use até 300 caracteres.")
        .refine((t) => !temContatoOuPagamento(t), SEM_CONTATO),
      ondeVale: z.array(z.enum(["local", "whatsapp", "site"])).min(1, "Escolha onde a oferta vale."),
      ultimoDia: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha o último dia da oferta.")
        .refine((dia) => dia >= hoje, "O último dia não pode ser antes de hoje.")
        .refine((dia) => dia <= somarDias(hoje, DIAS_MAXIMOS - 1), `A oferta dura no máximo ${DIAS_MAXIMOS} dias, contando hoje.`),
      limite: z.string().trim(),
    })
    .superRefine((oferta, contexto) => {
      if (oferta.tipo !== "brinde") {
        const valor = Number(oferta.valor);
        const maximo = oferta.tipo === "percentual" ? 100 : VALOR_MAXIMO_EM_REAIS;
        if (!Number.isInteger(valor) || valor < 1 || valor > maximo) {
          contexto.addIssue({
            code: "custom",
            path: ["valor"],
            message:
              oferta.tipo === "percentual"
                ? "Use um desconto de 1% a 100%."
                : "Use um valor inteiro em reais, a partir de R$ 1.",
          });
        }
      }
      if (oferta.limite) {
        const limite = Number(oferta.limite);
        if (!Number.isInteger(limite) || limite < 1 || limite > 10_000) {
          contexto.addIssue({ code: "custom", path: ["limite"], message: "Use um número de 1 a 10.000, ou deixe em branco." });
        }
      }
    })
    .transform((oferta) => ({
      titulo: oferta.titulo,
      tipo: oferta.tipo,
      valor: oferta.tipo === "brinde" ? null : Number(oferta.valor),
      condicoes: oferta.condicoes || null,
      ondeVale: [...new Set(oferta.ondeVale)].join(","),
      fim: fimDoDia(oferta.ultimoDia),
      limite: oferta.limite ? Number(oferta.limite) : null,
    }));
}
export type DadosOferta = z.output<ReturnType<typeof esquemaDaOferta>>;

/** "15% de desconto", "R$ 20 de desconto" ou "Brinde". */
export function rotuloDoDesconto(oferta: { tipo: string; valor: number | null }): string {
  if (oferta.tipo === "percentual") return `${oferta.valor}% de desconto`;
  if (oferta.tipo === "valor") return `R$ ${oferta.valor?.toLocaleString("pt-BR")} de desconto`;
  return "Brinde";
}

/** Onde a oferta vale, em texto: "No local e pelo WhatsApp". */
export function rotuloOndeVale(ondeVale: string): string {
  const partes = ondeVale
    .split(",")
    .filter((parte): parte is OndeVale => parte in ONDE_VALE)
    .map((parte, i) => (i === 0 ? ONDE_VALE[parte] : ONDE_VALE[parte].charAt(0).toLowerCase() + ONDE_VALE[parte].slice(1)));
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

/** A oferta que está valendo agora no negócio, se houver. Só uma por vez. */
export function condicaoDeOfertaAtiva(agora = new Date()) {
  return { status: "ativa", fim: { gt: agora } } satisfies Prisma.OfertaWhereInput;
}

/** A oferta ativa de um negócio que o público vê: aprovado e fora do modo oculto, como no perfil. Alimenta a lista de /cupons. */
export function condicaoDeOfertaPublica(agora = new Date()) {
  return { ...condicaoDeOfertaAtiva(agora), empresa: { moderacao: "aprovada", oculta: false } } satisfies Prisma.OfertaWhereInput;
}

export class ErroOferta extends Error {
  constructor(readonly mensagem: string) {
    super(mensagem);
  }
}

/** Cria uma oferta. Só um dono liberado, num negócio do diretório, e uma oferta ativa por vez. */
export async function criarOferta(empresaId: string, usuarioId: string, oferta: DadosOferta): Promise<string> {
  if (!(await podeCriarOfertas(empresaId, usuarioId))) {
    throw new ErroOferta("Seu negócio ainda não foi liberado para o Clube do Bem, ou a liberação foi suspensa.");
  }
  return db.$transaction(async (tx) => {
    // Trava o negócio: com dois envios ao mesmo tempo, o segundo vê a oferta do primeiro.
    const [empresa] = await tx.$queryRaw<{ instagramUsername: string; moderacao: string; oculta: boolean }[]>`
      SELECT "instagramUsername", moderacao, oculta FROM "Empresa" WHERE id = ${empresaId} FOR UPDATE`;
    if (!empresa || empresa.moderacao !== "aprovada" || empresa.oculta) {
      throw new ErroOferta("Seu negócio precisa estar no diretório para criar ofertas.");
    }
    if (await tx.oferta.count({ where: { empresaId, ...condicaoDeOfertaAtiva() } })) {
      throw new ErroOferta("Já existe uma oferta valendo. Encerre a atual para criar outra.");
    }
    const criada = await tx.oferta.create({ data: { empresaId, criadaPorId: usuarioId, ...oferta } });
    await registrarAuditoria(tx, {
      usuarioId,
      acao: "oferta.criada",
      alvoTipo: "empresa",
      alvoId: empresaId,
      detalhes: `@${empresa.instagramUsername} · ${oferta.titulo}`,
    });
    return criada.id;
  });
}

/**
 * Encerra a oferta antes do fim: ninguém gera cupom novo, mas quem já gerou usa até o fim
 * previsto. Qualquer dono do negócio pode encerrar. Devolve o @ do negócio, ou null.
 */
export async function encerrarOferta(ofertaId: string, usuarioId: string): Promise<string | null> {
  return db.$transaction(async (tx) => {
    const oferta = await tx.oferta.findUnique({
      where: { id: ofertaId },
      include: { empresa: { select: { instagramUsername: true, membros: { where: { usuarioId }, select: { usuarioId: true } } } } },
    });
    if (!oferta || oferta.empresa.membros.length === 0) return null;
    const { count } = await tx.oferta.updateMany({ where: { id: ofertaId, status: "ativa" }, data: { status: "encerrada" } });
    if (count > 0) {
      await registrarAuditoria(tx, {
        usuarioId,
        acao: "oferta.encerrada",
        alvoTipo: "empresa",
        alvoId: oferta.empresaId,
        detalhes: `@${oferta.empresa.instagramUsername} · ${oferta.titulo}`,
      });
    }
    return oferta.empresa.instagramUsername;
  });
}

// Sem 0 e O, nem 1 e I, que se confundem ao ditar o código no balcão.
const LETRAS_DO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function novoCodigo(): string {
  return Array.from({ length: 6 }, () => LETRAS_DO_CODIGO[randomInt(LETRAS_DO_CODIGO.length)]).join("");
}

/** O código como a pessoa digitou ("7k3p-9q"), do jeito que fica guardado ("7K3P9Q"). */
export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function ehRepetido(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && (erro as { code?: unknown }).code === "P2002";
}

class SemCupom extends Error {}

export type ResultadoCupom =
  | { cupom: { id: string; codigo: string }; novo: boolean; favoritou: boolean; categoria: string; uf: string }
  | { erro: "indisponivel" | "esgotada" | "dono" };

/**
 * Gera o cupom de quem pediu, um por pessoa por oferta, e põe o negócio nos favoritos dela.
 * Pedir de novo devolve o mesmo cupom. O limite de cupons vale com pedidos ao mesmo tempo:
 * a reserva é um UPDATE condicional na oferta, na mesma transação do cupom.
 */
export async function gerarCupom(ofertaId: string, usuarioId: string): Promise<ResultadoCupom> {
  const oferta = await db.oferta.findUnique({
    where: { id: ofertaId },
    include: { empresa: { select: { id: true, moderacao: true, oculta: true, categoria: true, uf: true, membros: { select: { usuarioId: true } } } } },
  });
  if (!oferta) return { erro: "indisponivel" };
  const { empresa } = oferta;
  if (empresa.membros.some((membro) => membro.usuarioId === usuarioId)) return { erro: "dono" };
  if (empresa.moderacao !== "aprovada" || empresa.oculta) return { erro: "indisponivel" };
  const chave = { ofertaId_usuarioId: { ofertaId, usuarioId } };
  const jaTem = await db.cupom.findUnique({ where: chave, select: { id: true, codigo: true } });
  if (jaTem) return { cupom: jaTem, novo: false, favoritou: false, categoria: empresa.categoria, uf: empresa.uf };

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      const { cupom, favoritou } = await db.$transaction(async (tx) => {
        const reservados = await tx.$executeRaw`
          UPDATE "Oferta" SET "cuponsGerados" = "cuponsGerados" + 1
          WHERE id = ${ofertaId} AND status = 'ativa' AND fim > ${new Date()} AND (limite IS NULL OR "cuponsGerados" < limite)`;
        if (reservados === 0) throw new SemCupom();
        const { count } = await tx.empresaFavorita.createMany({ data: [{ empresaId: empresa.id, usuarioId }], skipDuplicates: true });
        const cupom = await tx.cupom.create({ data: { ofertaId, usuarioId, codigo: novoCodigo() }, select: { id: true, codigo: true } });
        return { cupom, favoritou: count > 0 };
      });
      return { cupom, novo: true, favoritou, categoria: empresa.categoria, uf: empresa.uf };
    } catch (erro) {
      if (erro instanceof SemCupom) {
        const agora = await db.oferta.findUnique({ where: { id: ofertaId }, select: { status: true, fim: true, limite: true, cuponsGerados: true } });
        const esgotada = !!agora && agora.status === "ativa" && agora.fim > new Date() && agora.limite !== null && agora.cuponsGerados >= agora.limite;
        return { erro: esgotada ? "esgotada" : "indisponivel" };
      }
      if (!ehRepetido(erro)) throw erro;
      // Dois pedidos da mesma pessoa ao mesmo tempo: o outro já gravou o cupom dela.
      const outro = await db.cupom.findUnique({ where: chave, select: { id: true, codigo: true } });
      if (outro) return { cupom: outro, novo: false, favoritou: false, categoria: empresa.categoria, uf: empresa.uf };
      // Senão, o código sorteado já existia: sorteia outro.
    }
  }
  throw new Error("Não foi possível sortear um código de cupom livre.");
}

export type SituacaoCupom = "valido" | "usado" | "vencido" | "suspenso";

/** Um cupom vale até o fim previsto da oferta, mesmo se o dono encerrar antes; com a oferta suspensa, não vale. */
export function situacaoDoCupom(cupom: { usadoEm: Date | null; oferta: { fim: Date; status: string } }, agora = new Date()): SituacaoCupom {
  if (cupom.usadoEm) return "usado";
  if (cupom.oferta.status === "suspensa") return "suspenso";
  if (cupom.oferta.fim <= agora) return "vencido";
  return "valido";
}

export type ResultadoValidacao =
  | { situacao: "usado_agora"; categoria: string; uf: string }
  | { situacao: SituacaoCupom | "nao_encontrado" };

/**
 * Marca o cupom como usado, no balcão. Só um dono do negócio do cupom. O uso é único, mesmo
 * com duas validações ao mesmo tempo: a condição fica no próprio UPDATE.
 */
export async function usarCupom(empresaId: string, codigo: string, donoId: string): Promise<ResultadoValidacao> {
  const cupom = await db.cupom.findUnique({
    where: { codigo: normalizarCodigo(codigo) },
    include: { oferta: { select: { empresaId: true, fim: true, status: true, empresa: { select: { categoria: true, uf: true } } } } },
  });
  const ehDono = await db.empresaMembro.findUnique({ where: { empresaId_usuarioId: { empresaId, usuarioId: donoId } } });
  if (!cupom || !ehDono || cupom.oferta.empresaId !== empresaId) return { situacao: "nao_encontrado" };
  const agora = new Date();
  const { count } = await db.cupom.updateMany({
    where: { id: cupom.id, usadoEm: null, oferta: { fim: { gt: agora }, status: { not: "suspensa" } } },
    data: { usadoEm: agora, validadoPorId: donoId },
  });
  if (count > 0) return { situacao: "usado_agora", categoria: cupom.oferta.empresa.categoria, uf: cupom.oferta.empresa.uf };
  const depois = await db.cupom.findUniqueOrThrow({ where: { id: cupom.id }, include: { oferta: { select: { fim: true, status: true } } } });
  return { situacao: situacaoDoCupom(depois, agora) };
}

const MOTIVO_CONTATO = "O contato do perfil mudou";
export const MOTIVO_ARROBA = "O @ do Instagram mudou";

/** Os campos de contato que, trocados pelo dono, suspendem o clube até a moderação conferir de novo. */
export function contatoMudou(
  antes: { whatsapp: string | null; telefoneComercial: string | null; site: string | null; emailContato: string | null },
  depois: { whatsapp?: string | null; telefoneComercial?: string | null; site?: string | null; emailContato?: string | null },
): boolean {
  const campos = ["whatsapp", "telefoneComercial", "site", "emailContato"] as const;
  return campos.some((campo) => (antes[campo] || null) !== (depois[campo] || null));
}

/** Suspende as ofertas do negócio cujos cupons ainda valem: as ativas e as encerradas antes do fim. */
export function suspenderOfertasQueValem(
  tx: Prisma.TransactionClient,
  where: Prisma.OfertaWhereInput,
  agora = new Date(),
) {
  return tx.oferta.updateMany({
    where: { ...where, status: { in: ["ativa", "encerrada"] }, fim: { gt: agora } },
    data: { status: "suspensa" },
  });
}

/**
 * O dono trocou o contato do perfil (ou o @, com `motivo`): as liberações do clube do negócio ficam suspensas e as
 * ofertas que estão valendo saem do ar, até a moderação conferir de novo. Fecha o golpe de
 * assumir o perfil, trocar o WhatsApp e lançar um cupom. Roda na transação da edição.
 */
export async function suspenderPorContatoAlterado(
  tx: Prisma.TransactionClient,
  empresa: { id: string; instagramUsername: string },
  motivo: string = MOTIVO_CONTATO,
): Promise<void> {
  const { count } = await tx.liberacaoClube.updateMany({
    where: { empresaId: empresa.id, status: "liberada" },
    data: { status: "suspensa", motivo, decididoPorId: null, decididoEm: new Date() },
  });
  if (count === 0) return;
  await suspenderOfertasQueValem(tx, { empresaId: empresa.id });
  await registrarAuditoria(tx, {
    usuarioId: null,
    acao: "clube.suspenso",
    alvoTipo: "empresa",
    alvoId: empresa.id,
    detalhes: `@${empresa.instagramUsername} · ${motivo}`,
  });
}
