import "server-only";
import { cache } from "react";
import { z } from "zod";
import { apagarFoto, conferirFoto, guardarFoto } from "@/lib/armazenamento";
import { registrarAuditoria } from "@/lib/auditoria";
import { listarCidades } from "@/lib/consultas";
import { db, type Prisma } from "@/lib/db";
import { hrefCidade, hrefDiretorio, rotuloEstado, type CidadeComNegocios } from "@/lib/diretorio";
import { NOMES_UF, TITULOS_EMBAIXADOR, UFS, type TituloEmbaixador, type Uf } from "@/lib/dominio";
import { campoMunicipio, errosPorCampo, texto } from "@/lib/formulario";
import { ehFotoDoSite } from "@/lib/fotos";
import { normalizarUsername } from "@/lib/instagram";
import { arquivoDaFoto, buscarPreviaDoInstagram, configPrevia } from "@/lib/previa-instagram";
import { normalizarTexto } from "@/lib/texto";

// Embaixadores do bem (#250): quem leva o projeto para uma cidade ou um estado
// inteiro. A moderação cadastra; o site mostra na página inicial, em /embaixadores,
// na página da cidade e na página de cada um (/embaixadores/<@>, #259). Os
// seguidores, a foto e a primeira versão do "Sobre" vêm da API oficial da Meta, a
// mesma da prévia do cadastro (src/lib/previa-instagram.ts).

/**
 * "8.940", "48,2 mil", "131 mil", "1,2 mi". Corta em vez de arredondar, para
 * nunca mostrar mais seguidores do que a pessoa tem.
 */
export function formatarSeguidores(total: number): string {
  if (total < 10_000) return total.toLocaleString("pt-BR");
  const [unidade, sufixo] = total < 1_000_000 ? [1000, "mil"] : [1_000_000, "mi"];
  // Abaixo de 100, uma casa decimal ("48,2 mil"); a partir daí, só o inteiro ("131 mil").
  const valor = total < 100 * unidade ? Math.floor(total / (unidade / 10)) / 10 : Math.floor(total / unidade);
  return `${valor.toLocaleString("pt-BR")} ${sufixo}`;
}

type Lugar = { cidade: string | null; uf: string };

/** "Salvador, BA", ou "Bahia (todo o estado)" para quem cobre o estado. */
export function lugarDoEmbaixador({ cidade, uf }: Lugar): string {
  return cidade ? `${cidade}, ${uf}` : `${NOMES_UF[uf as Uf] ?? uf} (todo o estado)`;
}

/** "Embaixadora em Salvador", ou "Embaixador de todo o estado". */
export function tituloNaCidade({ titulo, cidade }: { titulo: string; cidade: string | null }): string {
  const nome = TITULOS_EMBAIXADOR[titulo as TituloEmbaixador] ?? TITULOS_EMBAIXADOR.embaixadora;
  return cidade ? `${nome} em ${cidade}` : `${nome} de todo o estado`;
}

/** "Embaixadora do bem · Curitiba, PR": o rótulo da página do embaixador. */
export function tituloComLugar(embaixador: { titulo: string } & Lugar): string {
  const nome = TITULOS_EMBAIXADOR[embaixador.titulo as TituloEmbaixador] ?? TITULOS_EMBAIXADOR.embaixadora;
  return `${nome} do bem · ${lugarDoEmbaixador(embaixador)}`;
}

/** A página do embaixador, pelo @: o link para divulgar no Instagram. */
export function hrefDoEmbaixador(instagramUsername: string): string {
  return `/embaixadores/${instagramUsername}`;
}

/** O "Onde?" do diretório para os negócios da região: a cidade, ou o estado inteiro. */
export function ondeDoEmbaixador({ cidade, uf }: Lugar): string {
  return cidade ? `${cidade}, ${uf}` : rotuloEstado(uf as Uf);
}

export type DestinoDoEmbaixador = { href: string; detalhe: string };

/**
 * Para onde leva o cartão: a página da cidade, ou o diretório filtrado pelo estado.
 * Sem negócios lá ainda (e então a cidade não tem página), leva para indicar o primeiro.
 */
export function destinoDoEmbaixador({ cidade, uf }: Lugar, cidades: CidadeComNegocios[]): DestinoDoEmbaixador {
  const daCidade = cidade ? cidades.find((c) => c.uf === uf && normalizarTexto(c.cidade) === normalizarTexto(cidade)) : undefined;
  const total = cidade ? (daCidade?.total ?? 0) : cidades.filter((c) => c.uf === uf).reduce((soma, c) => soma + c.total, 0);
  if (total === 0) return { href: "/participar", detalhe: "Indique o primeiro negócio" };
  const negocios = `${total} ${total === 1 ? "negócio" : "negócios"}`;
  return daCidade
    ? { href: hrefCidade(daCidade.cidade, uf), detalhe: `${negocios} do bem` }
    : { href: hrefDiretorio({ onde: rotuloEstado(uf as Uf) }), detalhe: `${negocios} no estado` };
}

/** O que as páginas públicas mostram de cada embaixador. */
export type EmbaixadorNoSite = {
  id: string;
  nome: string;
  instagramUsername: string;
  fotoUrl: string | null;
  /** Já formatado ("48,2 mil"). */
  seguidores: string | null;
  numeroDeSeguidores: number | null;
  titulo: string;
  cidade: string | null;
  uf: string;
  lugar: string;
  naInicial: boolean;
  destino: DestinoDoEmbaixador;
  /** A página do embaixador. */
  href: string;
  sobre: string | null;
};

/** Os embaixadores no ar, na ordem da moderação, com o lugar e o link de cada um. Lido uma vez por requisição. */
export const embaixadoresNoSite = cache(async (): Promise<EmbaixadorNoSite[]> => {
  const [embaixadores, cidades] = await Promise.all([
    db.embaixador.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
    listarCidades(),
  ]);
  return embaixadores.map((e) => ({
    id: e.id,
    nome: e.nome,
    instagramUsername: e.instagramUsername,
    fotoUrl: ehFotoDoSite(e.fotoUrl) ? e.fotoUrl : null,
    seguidores: e.seguidores === null ? null : formatarSeguidores(e.seguidores),
    numeroDeSeguidores: e.seguidores,
    titulo: e.titulo,
    cidade: e.cidade,
    uf: e.uf,
    lugar: lugarDoEmbaixador(e),
    naInicial: e.naInicial,
    destino: destinoDoEmbaixador(e, cidades),
    href: hrefDoEmbaixador(e.instagramUsername),
    sobre: e.sobre,
  }));
});

/** O embaixador da página /embaixadores/<@>, só se estiver no site. Aceita o @ com maiúsculas ou "@". */
export async function embaixadorDoEndereco(endereco: string): Promise<EmbaixadorNoSite | null> {
  const username = normalizarUsername(endereco);
  if (!username) return null;
  return (await embaixadoresNoSite()).find((e) => e.instagramUsername === username) ?? null;
}

/** Na página de uma cidade: quem cobre a cidade e, depois, quem cobre o estado inteiro. */
export function embaixadoresDaCidade<T extends Lugar>(lista: T[], cidade: string, uf: string): T[] {
  const nome = normalizarTexto(cidade);
  const daCidade = lista.filter((e) => e.uf === uf && e.cidade !== null && normalizarTexto(e.cidade) === nome);
  return [...daCidade, ...lista.filter((e) => e.uf === uf && e.cidade === null)];
}

// --- Formulário da moderação ----------------------------------------------------

export type DadosEmbaixador = {
  instagramUsername: string;
  nome: string;
  titulo: TituloEmbaixador;
  sobre: string | null;
  cidade: string | null;
  uf: Uf;
  seguidoresManual: boolean;
  /** Só quando a moderação digita o número. */
  seguidores: number | null;
  ordem: number;
  naInicial: boolean;
  ativo: boolean;
};

const TITULOS = Object.keys(TITULOS_EMBAIXADOR) as [TituloEmbaixador, ...TituloEmbaixador[]];
const MAXIMO_DE_SEGUIDORES = 1_000_000_000;
export const MAXIMO_DO_SOBRE = 600;

const esquema = z.object({
  instagram: z.string().transform((valor, ctx) => {
    const username = normalizarUsername(valor);
    if (username) return username;
    ctx.addIssue({ code: "custom", message: "Esse @ não parece certo. Use só letras, números, ponto e sublinhado." });
    return z.NEVER;
  }),
  nome: z.string().trim().min(2, "Qual nome aparece no site?").max(60, "Use até 60 caracteres."),
  titulo: z.enum(TITULOS, { error: "Escolha como chamar." }),
  // Vazio no cadastro: a bio do Instagram entra no lugar (atualizarPeloInstagram).
  sobre: z
    .string()
    .transform((valor) => valor.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
    .pipe(z.string().max(MAXIMO_DO_SOBRE, `Use até ${MAXIMO_DO_SOBRE} caracteres.`))
    .transform((valor) => valor || null),
  ordem: z.coerce.number({ error: "Use um número." }).int("Use um número inteiro.").min(0, "Use 0 ou mais.").max(999, "Use até 999."),
});

const esquemaCidade = z.object({ municipio: campoMunicipio });
const esquemaEstado = z.object({ uf: z.enum(UFS, { error: "Escolha o estado." }) });
const esquemaSeguidores = z.object({
  // Aceita "48.231" ou "48 231": só os dígitos contam.
  seguidores: z
    .string()
    .transform((valor) => valor.replace(/\D/g, ""))
    .pipe(z.string().min(1, "Quantos seguidores a conta tem?").max(10, "Número grande demais."))
    .transform(Number)
    .pipe(z.number().max(MAXIMO_DE_SEGUIDORES, "Número grande demais.")),
});

/** Lê e confere o formulário da moderação. Os erros vêm por campo, como nos outros formulários. */
export function lerEmbaixador(dados: FormData): { dados: DadosEmbaixador } | { erros: Record<string, string> } {
  const porEstado = texto(dados, "abrangencia") === "estado";
  const seguidoresManual = dados.get("seguidoresManual") === "sim";
  const partes = [
    esquema.safeParse({
      instagram: texto(dados, "instagram"),
      nome: texto(dados, "nome"),
      titulo: texto(dados, "titulo"),
      sobre: texto(dados, "sobre"),
      ordem: texto(dados, "ordem") || "0",
    }),
    porEstado ? esquemaEstado.safeParse({ uf: texto(dados, "uf") }) : esquemaCidade.safeParse({ municipio: texto(dados, "municipio") }),
    seguidoresManual ? esquemaSeguidores.safeParse({ seguidores: texto(dados, "seguidores") }) : null,
  ] as const;

  const erros = Object.assign({}, ...partes.map((parte) => (parte && !parte.success ? errosPorCampo(parte.error) : {})));
  const [comuns, lugar, numero] = partes;
  if (!comuns.success || !lugar.success || (numero && !numero.success)) return { erros };

  return {
    dados: {
      instagramUsername: comuns.data.instagram,
      nome: comuns.data.nome,
      titulo: comuns.data.titulo,
      sobre: comuns.data.sobre,
      ...("municipio" in lugar.data ? { cidade: lugar.data.municipio.nome, uf: lugar.data.municipio.uf as Uf } : { cidade: null, uf: lugar.data.uf }),
      seguidoresManual,
      seguidores: numero?.success ? numero.data.seguidores : null,
      ordem: comuns.data.ordem,
      naInicial: dados.get("naInicial") === "sim",
      ativo: dados.get("ativo") === "sim",
    },
  };
}

// --- Instagram -----------------------------------------------------------------

const UM_DIA = 24 * 60 * 60 * 1000;
/** Quantos embaixadores uma visita atualiza, no máximo: os outros ficam para a próxima. */
const POR_RODADA = 25;

/** Não consultado nas últimas 24 horas. */
function semConsultaDesde(limite: Date): Prisma.EmbaixadorWhereInput {
  return { OR: [{ consultadoEm: null }, { consultadoEm: { lt: limite } }] };
}

/** Grava a foto vinda do Instagram, só se o embaixador continuar sem foto. */
async function gravarFotoDoInstagram(id: string, foto: string): Promise<void> {
  const arquivo = arquivoDaFoto(foto);
  const conferida = arquivo ? await conferirFoto(arquivo) : null;
  if (!conferida || "erro" in conferida) return;
  const fotoUrl = await guardarFoto(conferida, "perfis");
  // A moderação pode ter enviado uma foto enquanto esta subia: vale a dela.
  const gravada = await db.$transaction(async (tx) => {
    const { count } = await tx.embaixador.updateMany({ where: { id, fotoUrl: null }, data: { fotoUrl } });
    if (count === 0) return false;
    await registrarAuditoria(tx, { usuarioId: null, acao: "embaixador.foto_do_instagram", alvoTipo: "embaixador", alvoId: id });
    return true;
  });
  if (!gravada) await apagarFoto(fotoUrl);
}

export type ResultadoDoInstagram = "atualizado" | "sem_resposta";

/**
 * Consulta o @ no Instagram e grava os seguidores, a menos que a moderação tenha
 * digitado o número. A foto só entra se o embaixador estiver sem: a enviada pela
 * moderação nunca é trocada. Com `comBio` (pedido da moderação, nunca a consulta
 * do dia), a bio entra no "Sobre" vazio. "sem_resposta": conta pessoal ou privada,
 * @ errado, token vencido ou a Meta fora do ar.
 */
export async function atualizarPeloInstagram(id: string, agora = new Date(), { comBio = false } = {}): Promise<ResultadoDoInstagram> {
  const embaixador = await db.embaixador.update({
    where: { id },
    data: { consultadoEm: agora },
    select: { instagramUsername: true, fotoUrl: true },
  });
  const previa = await buscarPreviaDoInstagram(embaixador.instagramUsername);
  if (!previa) return "sem_resposta";
  if (previa.seguidores !== null) {
    await db.embaixador.updateMany({
      where: { id, seguidoresManual: false },
      data: { seguidores: previa.seguidores, seguidoresEm: agora },
    });
  }
  if (comBio && previa.bio) await db.embaixador.updateMany({ where: { id, sobre: null }, data: { sobre: previa.bio } });
  if (!embaixador.fotoUrl && previa.foto) await gravarFotoDoInstagram(id, previa.foto);
  return "atualizado";
}

/**
 * Atualiza os embaixadores no ar que não foram consultados nas últimas 24 horas.
 * As páginas que mostram embaixadores chamam depois de responder (after), então
 * quem visita não espera. Duas visitas ao mesmo tempo não consultam o mesmo @:
 * cada uma marca o embaixador antes de consultar, e só uma consegue. Nunca lança erro.
 */
export async function atualizarSeguidoresDoDia(agora = new Date()): Promise<number> {
  if (!configPrevia()) return 0;
  const limite = new Date(agora.getTime() - UM_DIA);
  let atualizados = 0;
  try {
    const vencidos = await db.embaixador.findMany({
      where: { ativo: true, seguidoresManual: false, ...semConsultaDesde(limite) },
      orderBy: { consultadoEm: { sort: "asc", nulls: "first" } },
      take: POR_RODADA,
      select: { id: true },
    });
    for (const { id } of vencidos) {
      const { count } = await db.embaixador.updateMany({ where: { id, ...semConsultaDesde(limite) }, data: { consultadoEm: agora } });
      if (count === 0) continue;
      try {
        if ((await atualizarPeloInstagram(id, agora)) === "atualizado") atualizados += 1;
      } catch (erro) {
        console.error("Falha ao atualizar o embaixador pelo Instagram", id, erro);
      }
    }
  } catch (erro) {
    console.error("Falha ao atualizar os embaixadores pelo Instagram", erro);
  }
  return atualizados;
}
