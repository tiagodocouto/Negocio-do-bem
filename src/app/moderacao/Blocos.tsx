import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Aba, Semana } from "@/lib/moderacao/filtros";
import { formatarDiaMes } from "@/lib/texto";

// Peças de interface do painel da moderação.

export function numero(valor: number): string {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

/** "1 conta" ou "3 contas". */
export function contar(valor: number, singular: string, plural: string): string {
  return `${numero(valor)} ${valor === 1 ? singular : plural}`;
}

const TONS = {
  neutro: "bg-papel text-suave",
  bom: "bg-folha-50 text-folha",
  atencao: "bg-amber-50 text-amber-800",
  alerta: "bg-coral-50 text-coral-700",
  info: "bg-sky-50 text-sky-900",
} as const;
export type Tom = keyof typeof TONS;

export function Etiqueta({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONS[tom]}`}>{children}</span>;
}

/** A situação de um negócio em etiquetas: se está no ar, se o dono escondeu e se é verificado. */
export function EtiquetasDoNegocio({ empresa }: { empresa: { moderacao: string; oculta: boolean; status: string } }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {empresa.moderacao === "rejeitada" && <Etiqueta tom="alerta">Fora do ar</Etiqueta>}
      {empresa.moderacao === "pendente" && <Etiqueta tom="atencao">Aguardando moderação</Etiqueta>}
      {empresa.moderacao === "aprovada" && (empresa.oculta ? <Etiqueta>Oculto pelo dono</Etiqueta> : <Etiqueta tom="bom">No diretório</Etiqueta>)}
      {empresa.status === "verificada" && <Etiqueta tom="info">Verificado</Etiqueta>}
    </span>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="cartao p-8 text-center text-suave">{children}</p>;
}

/** Título de um bloco do painel, com uma frase de explicação e um link opcional à direita. */
export function TituloDoBloco({ titulo, descricao, children }: { titulo: string; descricao?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <h3 className="font-serif text-xl font-semibold">{titulo}</h3>
        {descricao && <p className="text-sm text-suave">{descricao}</p>}
      </div>
      {children}
    </div>
  );
}

/** Busca de uma aba. A situação escolhida vai junto, e a página volta para a primeira. */
export function Busca({ aba, q, situacao, rotulo }: { aba: Aba; q: string; situacao?: string; rotulo: string }) {
  return (
    <Form action="/moderacao" className="cartao flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <input type="hidden" name="aba" value={aba} />
      {situacao && situacao !== "todos" && situacao !== "todas" && <input type="hidden" name="situacao" value={situacao} />}
      <input name="q" type="search" defaultValue={q} placeholder={rotulo} aria-label={rotulo} className="campo flex-1" />
      <button type="submit" className="botao">
        Buscar
      </button>
    </Form>
  );
}

/** Uma linha de filtros em pílulas, com a opção atual marcada. */
export function Pilulas({ opcoes, rotulo }: { opcoes: { href: string; texto: string; ativo: boolean }[]; rotulo: string }) {
  return (
    <nav aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.ativo ? "page" : undefined}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
            o.ativo ? "bg-tinta text-papel" : "border border-linha bg-superficie text-suave hover:text-tinta"
          }`}
        >
          {o.texto}
        </Link>
      ))}
    </nav>
  );
}

/** Um número grande com o que ele conta embaixo. */
export function Numero({ valor, rotulo, href }: { valor: number; rotulo: string; href?: string }) {
  const conteudo = (
    <>
      <span className="block text-4xl font-semibold tracking-tight">{numero(valor)}</span>
      <span className="mt-1 block text-sm text-suave">{rotulo}</span>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl transition hover:opacity-80">
      {conteudo}
    </Link>
  ) : (
    <div>{conteudo}</div>
  );
}

/** Lista de números menores, alinhados à direita, cada um podendo levar à lista que ele conta. */
export function Detalhes({ itens }: { itens: { rotulo: string; valor: number; href?: string }[] }) {
  return (
    <dl className="mt-5 divide-y divide-linha border-t border-linha text-sm">
      {itens.map((item) => (
        <div key={item.rotulo} className="flex items-center justify-between gap-3 py-2">
          <dt className="text-suave">
            {item.href ? (
              <Link href={item.href} className="hover:text-tinta hover:underline">
                {item.rotulo}
              </Link>
            ) : (
              item.rotulo
            )}
          </dt>
          <dd className="font-semibold tabular-nums">{numero(item.valor)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Colunas de uma série por semana, numa cor só. Cada coluna mostra a semana e o
 * total ao passar o mouse; a tabela de "Ver os números" traz tudo sem o mouse.
 */
export function Colunas({ titulo, semanas }: { titulo: string; semanas: Semana[] }) {
  const maximo = Math.max(1, ...semanas.map((s) => s.total));
  const total = semanas.reduce((soma, s) => soma + s.total, 0);
  const ultima = semanas.at(-1)?.total ?? 0;
  return (
    <figure className="cartao p-5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{titulo}</span>
        <span className="text-sm text-suave">
          <span className="font-semibold text-tinta">{numero(total)}</span> em {semanas.length} semanas
        </span>
      </figcaption>
      <div
        role="img"
        aria-label={`${titulo}: ${numero(total)} nas últimas ${semanas.length} semanas, ${numero(ultima)} na última.`}
        className="mt-4 flex h-28 items-end gap-0.5 border-b border-linha"
      >
        {semanas.map((s, i) => (
          <div key={s.fim.getTime()} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-6 rounded-t bg-coral transition group-hover:bg-coral-700"
              style={{ height: `${(s.total / maximo) * 100}%` }}
            />
            <span
              className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg bg-tinta px-2 py-1 text-xs whitespace-nowrap text-papel group-hover:block ${
                i < 3 ? "left-0" : i >= semanas.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
              }`}
            >
              <strong>{numero(s.total)}</strong> · {formatarDiaMes(s.inicio)} a {formatarDiaMes(s.fim)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-suave">
        <span>{semanas[0] && formatarDiaMes(semanas[0].inicio)}</span>
        <span>
          última semana: <span className="font-semibold text-tinta">{numero(ultima)}</span>
        </span>
      </div>
    </figure>
  );
}

/** Barras horizontais, do maior para o menor: o nome e o valor numa linha, a barra embaixo. Cabe em cartões estreitos. */
export function Barras({ itens, vazio }: { itens: { rotulo: ReactNode; total: number; href?: string; chave: string }[]; vazio: string }) {
  if (itens.length === 0) return <p className="text-sm text-suave">{vazio}</p>;
  const maximo = Math.max(1, ...itens.map((i) => i.total));
  return (
    <ul className="space-y-3 text-sm">
      {itens.map((item) => (
        <li key={item.chave}>
          <span className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              {item.href ? (
                <Link href={item.href} className="hover:text-coral-700 hover:underline">
                  {item.rotulo}
                </Link>
              ) : (
                item.rotulo
              )}
            </span>
            <span className="font-semibold tabular-nums">{numero(item.total)}</span>
          </span>
          <span className="mt-1 block h-1.5 rounded-r bg-coral" style={{ width: `${(item.total / maximo) * 100}%`, minWidth: "2px" }} />
        </li>
      ))}
    </ul>
  );
}
