import Link from "next/link";
import type { ReactNode } from "react";
import { EmpresaCard, type EmpresaResumo } from "@/components/EmpresaCard";
import { JsonLd } from "@/components/JsonLd";
import type { Migalha } from "@/lib/seo";

/**
 * Página fixa de uma cidade, causa ou tipo de negócio (src/app/cidades, causas e
 * tipos): título, introdução, os primeiros negócios e links para continuar no
 * diretório. Os filtros ficam no /explorar; aqui é a porta de entrada da busca.
 * A `capa` (a foto da cidade) fica ao lado do título na tela larga e em cima dele
 * no celular.
 */
export function Vitrine({
  migalhas,
  rotulo,
  titulo,
  introducao,
  capa,
  total,
  itens,
  hrefNoDiretorio,
  jsonLd,
  children,
}: {
  migalhas: Migalha[];
  rotulo: ReactNode;
  titulo: string;
  introducao: ReactNode;
  capa?: ReactNode;
  total: number;
  itens: EmpresaResumo[];
  hrefNoDiretorio: string;
  jsonLd: object;
  children?: ReactNode;
}) {
  const cabecalho = (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">{rotulo}</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">{titulo}</h1>
      <div className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-suave">{introducao}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-6">
      <JsonLd dados={jsonLd} />
      <nav aria-label="Você está em" className="flex flex-wrap items-center gap-2 text-sm text-suave">
        {migalhas.map((migalha, i) =>
          i === migalhas.length - 1 ? (
            <span key={migalha.caminho} aria-current="page">
              {migalha.nome}
            </span>
          ) : (
            <span key={migalha.caminho} className="inline-flex items-center gap-2">
              <Link href={migalha.caminho} className="font-semibold text-coral-700 hover:underline">
                {i === 0 && <span aria-hidden="true">← </span>}
                {migalha.nome}
              </Link>
              <span aria-hidden="true">/</span>
            </span>
          ),
        )}
      </nav>

      {capa ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_30rem] lg:items-center lg:gap-12">
          <div className="lg:order-2">{capa}</div>
          {cabecalho}
        </div>
      ) : (
        <div className="mt-6">{cabecalho}</div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-linha pb-3.5">
        <p className="text-suave">
          <strong className="font-serif text-2xl font-semibold text-tinta">{total.toLocaleString("pt-BR")}</strong>{" "}
          {total === 1 ? "negócio no diretório" : "negócios no diretório"}
        </p>
        {total > 0 && (
          <Link href={hrefNoDiretorio} className="botao-claro botao-pequeno">
            Filtrar no diretório
          </Link>
        )}
      </div>

      {itens.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((empresa) => (
            <EmpresaCard key={empresa.instagramUsername} empresa={empresa} />
          ))}
        </div>
      ) : (
        <div className="cartao mt-5 px-6 py-14 text-center">
          <p className="font-serif text-2xl">Ainda não há negócios aqui no diretório.</p>
          <p className="mx-auto mt-2 max-w-md text-suave">Conhece algum? Indique e ajude a comunidade a encontrá-lo.</p>
          <Link href="/participar" className="botao-coral mt-6">
            Indicar um negócio
          </Link>
        </div>
      )}

      {total > itens.length && (
        <div className="mt-6 text-center">
          <Link href={hrefNoDiretorio} className="botao">
            Ver todos os {total.toLocaleString("pt-BR")} no diretório <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}

      {children && <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">{children}</div>}
    </div>
  );
}

export type Atalho = { chave: string; rotulo: ReactNode; href: string; total?: number };

/** Uma lista de links para continuar a busca: os tipos de uma cidade, as cidades de uma causa… */
export function Atalhos({ titulo, itens }: { titulo: string; itens: Atalho[] }) {
  if (itens.length === 0) return null;
  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold tracking-tight">{titulo}</h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {itens.map((item) => (
          <li key={item.chave}>
            <Link
              href={item.href}
              className="inline-flex items-center gap-2 rounded-full border border-linha bg-superficie px-3.5 py-1.5 text-sm font-medium transition hover:border-tinta/40"
            >
              {item.rotulo}
              {item.total !== undefined && <span className="text-xs text-suave tabular-nums">{item.total}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VitrineCarregando() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-7 sm:px-6" aria-busy="true">
      <div className="h-5 w-48 animate-pulse rounded-full bg-superficie" />
      <div className="mt-8 h-12 w-96 max-w-full animate-pulse rounded-2xl bg-superficie" />
      <div className="mt-4 h-16 w-[36rem] max-w-full animate-pulse rounded-2xl bg-superficie" />
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-60 animate-pulse rounded-3xl bg-superficie" />
        ))}
      </div>
    </div>
  );
}
