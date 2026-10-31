import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BuscaDiretorio } from "@/components/BuscaDiretorio";
import { EmpresaCard } from "@/components/EmpresaCard";
import { EmpresaLinha } from "@/components/EmpresaLinha";
import { IconeCategoria } from "@/components/IconeCategoria";
import { Paginacao } from "@/components/Paginacao";
import { buscarCausa, CAUSAS, GRUPOS, type GrupoCausa } from "@/lib/causas";
import { buscarDiretorio } from "@/lib/consultas";
import {
  alternar,
  hrefDiretorio,
  lerFiltros,
  mudarFiltro,
  ORDENS,
  tituloDoDiretorio,
  type FiltrosDiretorio,
  type Local,
  type Ordem,
} from "@/lib/diretorio";
import { CATEGORIAS } from "@/lib/dominio";
import { metadadosDaPagina } from "@/lib/seo";
import { OrdenarPor } from "./OrdenarPor";

// Com filtros, o canônico continua sendo /explorar: as combinações de filtros
// não viram páginas separadas na busca. Os links dos filtros levam nofollow, e o
// robots.txt bloqueia /explorar?..., para os robôs não abrirem cada combinação.
export const metadata: Metadata = metadadosDaPagina({
  titulo: "Explorar negócios",
  descricao:
    "Busque negócios do bem por cidade, tipo de negócio e pelas causas que importam para você: liderados por mulheres, afroempreendedores, opções veganas, sustentáveis e mais.",
  caminho: "/explorar",
});

// Os tipos com mais negócios aparecem direto; o resto fica em "Ver todos".
const TIPOS_VISIVEIS = 8;

const COR_DO_GRUPO: Record<GrupoCausa, string> = {
  trabalho: "bg-sky-500",
  diversidade: "bg-violet-500",
  planeta: "bg-emerald-500",
};

type Resultado = Awaited<ReturnType<typeof buscarDiretorio>>;

export default function Explorar(props: PageProps<"/explorar">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-6">
      <nav aria-label="Você está em" className="flex items-center gap-2 text-sm text-suave">
        <Link href="/" className="inline-flex items-center gap-1.5 font-semibold text-coral-700 hover:underline">
          <span aria-hidden="true">←</span> Início
        </Link>
        <span aria-hidden="true">/</span>
        <span>Diretório</span>
      </nav>
      <Suspense fallback={<DiretorioCarregando />}>
        <Diretorio searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Diretorio({ searchParams }: Pick<PageProps<"/explorar">, "searchParams">) {
  const filtros = lerFiltros(await searchParams);
  const resultado = await buscarDiretorio(filtros);
  const ativos = filtrosAtivos(filtros, resultado.local);
  const marcados = filtros.tipos.length + filtros.causas.length + (filtros.verificados ? 1 : 0);

  return (
    <>
      <h1 className="mt-2 font-serif text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
        {tituloDoDiretorio(filtros, resultado.local)}
      </h1>
      <div className="mt-5">
        <BuscaDiretorio cidades={resultado.cidades} filtros={filtros} />
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* No celular os filtros ficam recolhidos, para os resultados aparecerem logo. */}
        <details className="cartao group lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold">
            <span className="inline-flex items-center gap-2">
              <IconeFiltros />
              Filtros{marcados > 0 && <span className="rounded-full bg-coral px-2 py-0.5 text-xs text-white">{marcados}</span>}
            </span>
            <span aria-hidden="true" className="text-suave transition group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="border-t border-linha p-3">
            <Filtros filtros={filtros} resultado={resultado} />
          </div>
        </details>
        <aside aria-label="Filtros" className="hidden w-64 shrink-0 lg:block">
          <Filtros filtros={filtros} resultado={resultado} />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha pb-3.5">
            <p aria-live="polite" className="text-suave">
              <strong className="font-serif text-2xl font-semibold text-tinta">{resultado.total.toLocaleString("pt-BR")}</strong>{" "}
              {resultado.total === 1 ? "negócio" : "negócios"}
              {ativos.length > 0 ? " com esses filtros" : " no diretório"}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <OrdenarPor
                atual={filtros.ordem}
                links={Object.fromEntries((Object.keys(ORDENS) as Ordem[]).map((ordem) => [ordem, mudarFiltro(filtros, { ordem })])) as Record<Ordem, string>}
              />
              <div role="group" aria-label="Modo de exibição" className="inline-flex rounded-full border border-linha bg-superficie p-0.5">
                <BotaoVista href={hrefDiretorio({ ...filtros, vista: "grade" })} ativo={filtros.vista === "grade"} rotulo="Ver em grade">
                  <path d="M4 4h7v7H4V4ZM13 4h7v7h-7V4ZM4 13h7v7H4v-7ZM13 13h7v7h-7v-7Z" />
                </BotaoVista>
                <BotaoVista href={hrefDiretorio({ ...filtros, vista: "lista" })} ativo={filtros.vista === "lista"} rotulo="Ver em lista">
                  <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
                </BotaoVista>
              </div>
            </div>
          </div>

          {ativos.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {ativos.map((ativo) => (
                <Link
                  key={ativo.rotulo}
                  href={ativo.href}
                  scroll={false} rel="nofollow"
                  aria-label={`Tirar o filtro ${ativo.rotulo}`}
                  className="inline-flex items-center gap-2 rounded-full border border-tinta/60 bg-superficie py-1.5 pr-2.5 pl-3.5 text-sm font-medium transition hover:border-tinta"
                >
                  {ativo.rotulo}
                  <span aria-hidden="true" className="text-suave">
                    ✕
                  </span>
                </Link>
              ))}
            </div>
          )}

          {resultado.itens.length > 0 ? (
            filtros.vista === "lista" ? (
              <div className="mt-5 flex flex-col gap-2">
                {resultado.itens.map((empresa) => (
                  <EmpresaLinha key={empresa.instagramUsername} empresa={empresa} />
                ))}
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {resultado.itens.map((empresa) => (
                  <EmpresaCard key={empresa.instagramUsername} empresa={empresa} />
                ))}
              </div>
            )
          ) : (
            <Vazio filtros={filtros} resultado={resultado} />
          )}

          <Paginacao atual={filtros.pagina} total={resultado.paginas} href={(pagina) => hrefDiretorio({ ...filtros, pagina })} />
        </div>
      </div>
    </>
  );
}

function Filtros({ filtros, resultado }: { filtros: FiltrosDiretorio; resultado: Resultado }) {
  const tipos = CATEGORIAS.map((tipo) => ({ tipo, total: resultado.porCategoria[tipo] ?? 0, ativo: filtros.tipos.includes(tipo) })).sort(
    (a, b) => Number(b.ativo) - Number(a.ativo) || b.total - a.total || a.tipo.localeCompare(b.tipo, "pt-BR"),
  );
  const opcaoDeTipo = ({ tipo, total, ativo }: (typeof tipos)[number]) => (
    <OpcaoFiltro key={tipo} href={mudarFiltro(filtros, { tipos: alternar(filtros.tipos, tipo) })} ativo={ativo} total={total}>
      <IconeCategoria categoria={tipo} className="h-4 w-4 text-suave" />
      {tipo}
    </OpcaoFiltro>
  );
  const temMarcados = filtros.tipos.length > 0 || filtros.causas.length > 0 || filtros.verificados;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="hidden items-center justify-between lg:flex">
        <p className="inline-flex items-center gap-2 font-semibold">
          <IconeFiltros />
          Filtros
        </p>
        {temMarcados && (
          <Link href={mudarFiltro(filtros, { tipos: [], causas: [], verificados: false })} scroll={false} rel="nofollow" className="link text-sm">
            Limpar
          </Link>
        )}
      </div>

      <Grupo titulo="Tipo de negócio">
        {tipos.slice(0, TIPOS_VISIVEIS).map(opcaoDeTipo)}
        <details className="group/mais">
          <summary className="cursor-pointer list-none px-2 pt-1.5 text-sm font-semibold text-coral-700">
            <span className="group-open/mais:hidden">Ver todos os {CATEGORIAS.length} tipos</span>
            <span className="hidden group-open/mais:inline">Mostrar menos</span>
          </summary>
          <div className="mt-1 flex flex-col">{tipos.slice(TIPOS_VISIVEIS).map(opcaoDeTipo)}</div>
        </details>
      </Grupo>

      {(Object.keys(GRUPOS) as GrupoCausa[]).map((grupo) => (
        <Grupo
          key={grupo}
          titulo={
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${COR_DO_GRUPO[grupo]}`} />
              {GRUPOS[grupo]}
            </span>
          }
        >
          {CAUSAS.filter((causa) => causa.grupo === grupo).map((causa) => {
            const ativo = filtros.causas.includes(causa.slug);
            return (
              <OpcaoFiltro
                key={causa.slug}
                href={mudarFiltro(filtros, { causas: alternar(filtros.causas, causa.slug) })}
                ativo={ativo}
                total={ativo ? resultado.total : (resultado.porCausa[causa.slug] ?? 0)}
              >
                <span aria-hidden="true">{causa.emoji}</span>
                {causa.nome}
              </OpcaoFiltro>
            );
          })}
        </Grupo>
      ))}

      <Link
        href={mudarFiltro(filtros, { verificados: !filtros.verificados })}
        scroll={false} rel="nofollow"
        aria-current={filtros.verificados ? "true" : undefined}
        className="cartao flex items-center justify-between gap-3 p-4 transition hover:border-tinta/30"
      >
        <span>
          <span className="block text-sm font-semibold">Só verificados pelo dono</span>
          <span className="mt-0.5 block text-xs text-suave">
            {resultado.verificados} {resultado.verificados === 1 ? "negócio confirmado" : "negócios confirmados"} pelo dono
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative h-6 w-10 shrink-0 rounded-full transition ${filtros.verificados ? "bg-folha" : "bg-linha"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-superficie shadow transition-all ${filtros.verificados ? "left-[1.125rem]" : "left-0.5"}`}
          />
        </span>
      </Link>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <section className="cartao p-2.5">
      <h2 className="px-2 pt-1 pb-2 text-sm font-semibold">{titulo}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/** Uma opção de filtro: um link que marca ou desmarca, com quantos negócios ela mostra. */
function OpcaoFiltro({ href, ativo, total, children }: { href: string; ativo: boolean; total: number; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false} rel="nofollow"
      aria-current={ativo ? "true" : undefined}
      className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition hover:bg-papel ${total === 0 && !ativo ? "opacity-55" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded-[0.3rem] border ${
          ativo ? "border-coral bg-coral text-white" : "border-tinta/25 bg-superficie"
        }`}
      >
        {ativo && (
          <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="m4.5 10.5 3.5 3.5 7.5-8" />
          </svg>
        )}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {ativo && <span className="sr-only">(marcado)</span>}
      <span className="text-xs text-suave tabular-nums">{total}</span>
    </Link>
  );
}

function BotaoVista({ href, ativo, rotulo, children }: { href: string; ativo: boolean; rotulo: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false} rel="nofollow"
      aria-label={rotulo}
      aria-current={ativo ? "true" : undefined}
      className={`grid h-8 w-9 place-items-center rounded-full transition ${ativo ? "bg-tinta text-papel" : "text-suave hover:text-tinta"}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </Link>
  );
}

function Vazio({ filtros, resultado }: { filtros: FiltrosDiretorio; resultado: Resultado }) {
  if (resultado.total > 0) {
    return (
      <div className="cartao mt-5 px-6 py-14 text-center">
        <p className="font-serif text-2xl">Essa página não existe.</p>
        <Link href={hrefDiretorio({ ...filtros, pagina: 1 })} className="botao-claro mt-5">
          Voltar para a primeira página
        </Link>
      </div>
    );
  }
  const soOLugar =
    resultado.local?.cidade && !filtros.q && filtros.tipos.length === 0 && filtros.causas.length === 0 && !filtros.verificados;
  return (
    <div className="cartao mt-5 px-6 py-14 text-center">
      <p className="font-serif text-2xl">
        {soOLugar ? `Ainda não há negócios do bem em ${resultado.local!.cidade} no diretório.` : "Nenhum negócio com esses filtros por enquanto."}
      </p>
      <p className="mx-auto mt-2 max-w-md text-suave">
        {soOLugar ? "Conhece algum por lá? Indique e ajude a comunidade a encontrá-lo." : "Tire um filtro para ver mais opções, ou indique um negócio que você conhece."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/explorar" className="botao-claro">
          Limpar a busca
        </Link>
        <Link href="/participar" className="botao-coral">
          Indicar um negócio
        </Link>
      </div>
    </div>
  );
}

/** Os filtros em uso, cada um com o link que o tira. */
function filtrosAtivos(filtros: FiltrosDiretorio, local: Local | null) {
  const ativos: { rotulo: string; href: string }[] = [];
  if (filtros.q) ativos.push({ rotulo: `“${filtros.q}”`, href: mudarFiltro(filtros, { q: "" }) });
  if (filtros.onde) ativos.push({ rotulo: local?.rotulo ?? filtros.onde, href: mudarFiltro(filtros, { onde: "" }) });
  for (const tipo of filtros.tipos) ativos.push({ rotulo: tipo, href: mudarFiltro(filtros, { tipos: alternar(filtros.tipos, tipo) }) });
  for (const causa of filtros.causas) {
    ativos.push({ rotulo: buscarCausa(causa)?.nome ?? causa, href: mudarFiltro(filtros, { causas: alternar(filtros.causas, causa) }) });
  }
  if (filtros.verificados) ativos.push({ rotulo: "Só verificados", href: mudarFiltro(filtros, { verificados: false }) });
  return ativos;
}

function IconeFiltros() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4" />
    </svg>
  );
}

function DiretorioCarregando() {
  return (
    <div aria-busy="true">
      <div className="mt-3 h-12 w-80 max-w-full animate-pulse rounded-2xl bg-superficie" />
      <div className="mt-5 h-[4.5rem] animate-pulse rounded-3xl bg-superficie" />
      <div className="mt-8 flex gap-8">
        <div className="hidden h-[36rem] w-64 shrink-0 animate-pulse rounded-3xl bg-superficie lg:block" />
        <div className="grid grid-cols-1 flex-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-60 animate-pulse rounded-3xl bg-superficie" />
          ))}
        </div>
      </div>
    </div>
  );
}
