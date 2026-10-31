import "server-only";
import { cache } from "react";
import type { UsuarioSessao } from "@/lib/auth/sessao";
import { db, type Prisma } from "@/lib/db";
import { interpretarLocal, slugCidade, type CidadeComNegocios, type FiltrosDiretorio, type Local, type Ordem } from "@/lib/diretorio";
import { nomeOficial } from "@/lib/municipios";
import { normalizarTexto } from "@/lib/texto";

export const POR_PAGINA = 18;

/** Só aparecem no diretório os negócios publicados que o dono não escondeu. */
export const NO_DIRETORIO = { moderacao: "aprovada", oculta: false } satisfies Prisma.EmpresaWhereInput;

const ORDENACAO: Record<Ordem, Prisma.EmpresaOrderByWithRelationInput[]> = {
  // Verificados primeiro, depois os atualizados mais recentemente.
  verificados: [{ status: "desc" }, { atualizadoEm: "desc" }],
  recentes: [{ criadoEm: "desc" }],
  az: [{ nome: "asc" }],
};

/**
 * Quantos negócios do diretório há em cada cidade, do jeito que ela está escrita no banco.
 * Cadastros de antes da lista do IBGE podem ter a mesma cidade com outra grafia
 * ("Florianopolis", "Tubarão-SC"). `nome` é o oficial do IBGE ou, fora da lista, a
 * própria grafia. Lida uma vez por requisição.
 */
const contarPorGrafia = cache(async (): Promise<(CidadeComNegocios & { nome: string })[]> => {
  const grupos = await db.empresa.groupBy({ by: ["cidade", "uf"], where: NO_DIRETORIO, _count: { _all: true } });
  return grupos.map((g) => ({ cidade: g.cidade, uf: g.uf, total: g._count._all, nome: nomeOficial(g.cidade, g.uf) ?? g.cidade }));
});

/**
 * Cidades com negócios no diretório, com quantos há em cada uma. As grafias da mesma
 * cidade contam juntas com o nome oficial do IBGE.
 */
export const listarCidades = cache(async (): Promise<CidadeComNegocios[]> => {
  const cidades = new Map<string, CidadeComNegocios>();
  // A grafia mais usada vem primeiro: ela dá o nome quando a cidade não está na lista do IBGE.
  const grafias = [...(await contarPorGrafia())].sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, "pt-BR"));
  for (const g of grafias) {
    const chave = `${normalizarTexto(g.nome)}|${g.uf}`;
    const cidade = cidades.get(chave);
    if (cidade) cidade.total += g.total;
    else cidades.set(chave, { cidade: g.nome, uf: g.uf, total: g.total });
  }
  return [...cidades.values()].sort((a, b) => a.cidade.localeCompare(b.cidade, "pt-BR") || a.uf.localeCompare(b.uf));
});

/** Condição do banco para o lugar do "Onde?". A cidade vale em todas as grafias com que está no banco. */
async function condicaoDoLocal(local: Local | null): Promise<Prisma.EmpresaWhereInput> {
  const uf = local?.uf ? { uf: local.uf } : {};
  if (!local?.cidade) return uf;
  const nome = normalizarTexto(local.cidade);
  const grafias = (await contarPorGrafia())
    .filter((g) => normalizarTexto(g.nome) === nome && (!local.uf || g.uf === local.uf))
    .map((g) => g.cidade);
  return { ...uf, cidade: { in: grafias } };
}

/** A cidade de um endereço de /cidades, se ela tem negócios no diretório. */
export async function cidadeDoSlug(slug: string): Promise<CidadeComNegocios | undefined> {
  return (await listarCidades()).find((c) => slugCidade(c.cidade, c.uf) === slug);
}

/**
 * Cidades com negócios do diretório de um tipo ou de uma causa, das que têm mais
 * para as que têm menos. Como em listarCidades, as grafias da mesma cidade
 * ("Sao Paulo", "São Paulo") contam juntas, com o nome oficial do IBGE. Lida uma
 * vez por requisição: a página e os metadados usam a mesma lista.
 */
export const cidadesCom = cache(async (campo: "categoria" | "causa", valor: string): Promise<CidadeComNegocios[]> => {
  const grupos = await db.empresa.groupBy({
    by: ["cidade", "uf"],
    where: { ...NO_DIRETORIO, ...(campo === "categoria" ? { categoria: valor } : { causas: { some: { causa: valor } } }) },
    _count: { _all: true },
  });
  const cidades = new Map<string, CidadeComNegocios>();
  // A grafia mais usada vem primeiro: ela dá o nome quando a cidade não está na lista do IBGE.
  for (const g of grupos.sort((a, b) => b._count._all - a._count._all)) {
    const nome = nomeOficial(g.cidade, g.uf) ?? g.cidade;
    const cidade = cidades.get(slugCidade(nome, g.uf));
    if (cidade) cidade.total += g._count._all;
    else cidades.set(slugCidade(nome, g.uf), { cidade: nome, uf: g.uf, total: g._count._all });
  }
  return [...cidades.values()].sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, "pt-BR"));
});

/** Os números da página inicial: total, cidades, estados, verificados e quantos há em cada categoria. */
export const resumoDoDiretorio = cache(async () => {
  const [total, verificados, cidades, categorias] = await Promise.all([
    db.empresa.count({ where: NO_DIRETORIO }),
    db.empresa.count({ where: { ...NO_DIRETORIO, status: "verificada" } }),
    listarCidades(),
    db.empresa.groupBy({ by: ["categoria"], where: NO_DIRETORIO, _count: { _all: true } }),
  ]);
  return {
    total,
    verificados,
    cidades: cidades.length,
    estados: new Set(cidades.map((c) => c.uf)).size,
    porCategoria: Object.fromEntries(categorias.map((c) => [c.categoria, c._count._all])) as Record<string, number>,
  };
});

/**
 * Condição do banco para os filtros. `ignorar` tira um grupo de filtros, para
 * contar quantos negócios cada opção daquele grupo mostraria.
 */
function condicao(filtros: FiltrosDiretorio, lugar: Prisma.EmpresaWhereInput, ignorar?: "tipos" | "verificados") {
  const termos = normalizarTexto(filtros.q).split(" ").filter(Boolean).slice(0, 6);
  return {
    ...NO_DIRETORIO,
    ...lugar,
    ...(ignorar !== "tipos" && filtros.tipos.length > 0 ? { categoria: { in: filtros.tipos } } : {}),
    ...(ignorar !== "verificados" && filtros.verificados ? { status: "verificada" } : {}),
    AND: [
      ...termos.map((termo) => ({ busca: { contains: termo } })),
      ...filtros.causas.map((causa) => ({ causas: { some: { causa } } })),
    ],
  } satisfies Prisma.EmpresaWhereInput;
}

/** Uma página do diretório, com as contagens que aparecem ao lado de cada filtro. */
export async function buscarDiretorio(filtros: FiltrosDiretorio) {
  const cidades = await listarCidades();
  const local = interpretarLocal(filtros.onde, cidades);
  const lugar = await condicaoDoLocal(local);
  const onde = condicao(filtros, lugar);

  const [total, itens, categorias, causas, verificados] = await Promise.all([
    db.empresa.count({ where: onde }),
    db.empresa.findMany({
      where: onde,
      orderBy: ORDENACAO[filtros.ordem],
      skip: (filtros.pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        causas: { select: { causa: true } },
        _count: { select: { depoimentos: { where: { status: "publicado" } } } },
      },
    }),
    db.empresa.groupBy({ by: ["categoria"], where: condicao(filtros, lugar, "tipos"), _count: { _all: true } }),
    // Entre os resultados, quantos têm cada causa: é o que sobra ao marcar mais uma.
    db.empresaCausa.groupBy({ by: ["causa"], where: { empresa: onde }, _count: { _all: true } }),
    db.empresa.count({ where: { ...condicao(filtros, lugar, "verificados"), status: "verificada" } }),
  ]);

  return {
    cidades,
    local,
    total,
    itens,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    porCategoria: Object.fromEntries(categorias.map((c) => [c.categoria, c._count._all])) as Record<string, number>,
    porCausa: Object.fromEntries(causas.map((c) => [c.causa, c._count._all])) as Record<string, number>,
    verificados,
  };
}

/** Negócios do diretório para o sitemap, do atualizado mais recentemente ao mais antigo. */
export async function listarParaSitemap() {
  return db.empresa.findMany({
    where: NO_DIRETORIO,
    select: {
      instagramUsername: true,
      fotoUrl: true,
      atualizadoEm: true,
      cidade: true,
      uf: true,
      categoria: true,
      causas: { select: { causa: true } },
    },
    orderBy: { atualizadoEm: "desc" },
  });
}

export async function buscarPerfil(username: string) {
  return db.empresa.findUnique({
    where: { instagramUsername: username },
    include: {
      causas: { select: { causa: true } },
      membros: { select: { usuarioId: true } },
      indicadaPor: { select: { nome: true } },
      depoimentos: {
        where: { status: "publicado" },
        orderBy: { criadoEm: "desc" },
        include: { autor: { select: { nome: true } } },
      },
    },
  });
}

type EmpresaVisivel = {
  moderacao: string;
  oculta: boolean;
  indicadaPorId: string | null;
  membros: { usuarioId: string }[];
};

export function ehDono(empresa: { membros: { usuarioId: string }[] }, usuario: UsuarioSessao | null): boolean {
  return !!usuario && empresa.membros.some((m) => m.usuarioId === usuario.id);
}

/** Perfis fora do diretório só aparecem para donos, moderação e quem indicou. */
export function podeVerPerfil(empresa: EmpresaVisivel, usuario: UsuarioSessao | null): boolean {
  if (empresa.moderacao === "aprovada" && !empresa.oculta) return true;
  if (!usuario) return false;
  return usuario.moderador || ehDono(empresa, usuario) || empresa.indicadaPorId === usuario.id;
}
