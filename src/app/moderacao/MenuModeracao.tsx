import Link from "next/link";
import { ABAS, hrefModeracao, type Aba } from "@/lib/moderacao/filtros";

const GRUPOS: { titulo: string; abas: Aba[] }[] = [
  { titulo: "Painel", abas: ["visao-geral"] },
  { titulo: "Filas", abas: ["reivindicacoes", "indicacoes", "denuncias"] },
  { titulo: "Cadastros", abas: ["negocios", "contas", "depoimentos"] },
  { titulo: "Registros", abas: ["auditoria", "sistema"] },
];

/** O menu das seções: em linha no celular e na lateral em telas largas. As filas mostram quantos itens esperam. */
export function MenuModeracao({ aba, pendentes }: { aba: Aba; pendentes: Partial<Record<Aba, number>> }) {
  return (
    <nav
      aria-label="Seções da moderação"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:gap-6 lg:self-start lg:overflow-visible lg:px-0"
    >
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="contents lg:block">
          <p className="hidden px-3 pb-1.5 text-xs font-semibold tracking-[0.15em] text-suave uppercase lg:block">{grupo.titulo}</p>
          {grupo.abas.map((chave) => {
            const ativa = aba === chave;
            const total = pendentes[chave];
            return (
              <Link
                key={chave}
                href={hrefModeracao(chave)}
                aria-current={ativa ? "page" : undefined}
                className={`flex shrink-0 items-center justify-between gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition lg:rounded-xl lg:px-3 ${
                  ativa ? "bg-tinta text-papel" : "bg-superficie text-suave hover:text-tinta lg:bg-transparent lg:hover:bg-superficie"
                }`}
              >
                {ABAS[chave]}
                {!!total && (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${ativa ? "bg-superficie/20" : "bg-coral-50 text-coral-700"}`}>
                    {total}
                    <span className="sr-only"> esperando</span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
