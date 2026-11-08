import Link from "next/link";
import { Paginacao } from "@/components/Paginacao";
import { listarDepoimentos } from "@/lib/moderacao/consultas";
import { hrefModeracao, SITUACOES_DEPOIMENTO, type FiltrosModeracao, type SituacaoDepoimento } from "@/lib/moderacao/filtros";
import { formatarDataHora } from "@/lib/texto";
import { Busca, contar, Etiqueta, Pilulas, Vazio } from "./Blocos";

/** Todos os depoimentos, publicados e removidos. As decisões sobre denúncias continuam na fila "Denúncias". */
export async function Depoimentos({ filtros }: { filtros: FiltrosModeracao }) {
  const resultado = await listarDepoimentos({ q: filtros.q, situacao: filtros.depoimentos, pagina: filtros.pagina });
  const href = (mudanca: { situacao?: SituacaoDepoimento; pagina?: number }) =>
    hrefModeracao("depoimentos", { q: filtros.q, situacao: filtros.depoimentos, ...mudanca, pagina: mudanca.pagina ?? 1 });

  return (
    <div className="space-y-4">
      <Busca aba="depoimentos" q={filtros.q} situacao={filtros.depoimentos} rotulo="Buscar no texto, no autor ou no negócio" />
      <Pilulas
        rotulo="Filtrar depoimentos"
        opcoes={(Object.keys(SITUACOES_DEPOIMENTO) as SituacaoDepoimento[]).map((s) => ({
          href: href({ situacao: s }),
          texto: SITUACOES_DEPOIMENTO[s],
          ativo: filtros.depoimentos === s,
        }))}
      />
      <p className="text-sm text-suave">{contar(resultado.total, "depoimento encontrado", "depoimentos encontrados")}, dos mais novos aos mais antigos</p>

      {resultado.itens.length === 0 ? (
        <Vazio>Nenhum depoimento encontrado.</Vazio>
      ) : (
        <div className="space-y-3">
          {resultado.itens.map((d) => (
            <article key={d.id} className="cartao space-y-3 p-5">
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-suave">
                <span>
                  <Link href={`/moderacao/contas/${d.autor.id}`} className="font-semibold text-tinta hover:text-coral-700 hover:underline">
                    {d.autor.nome}
                  </Link>{" "}
                  em{" "}
                  <Link href={`/empresas/${d.empresa.instagramUsername}#depoimentos`} className="hover:text-tinta hover:underline">
                    {d.empresa.nome}
                  </Link>{" "}
                  · {formatarDataHora(d.criadoEm)}
                </span>
                {d.status === "removido" && <Etiqueta tom="alerta">Removido</Etiqueta>}
                {d.status === "publicado" && d.denunciado && <Etiqueta tom="atencao">Denúncia aberta</Etiqueta>}
                {d.resposta && <Etiqueta tom="bom">Respondido</Etiqueta>}
              </header>
              <blockquote className={`font-serif text-lg whitespace-pre-line ${d.status === "removido" ? "text-suave line-through decoration-suave/40" : ""}`}>
                {d.texto}
              </blockquote>
              {d.resposta && (
                <p className="rounded-2xl bg-papel p-3 text-sm whitespace-pre-line">
                  <span className="font-semibold">Resposta do negócio:</span> {d.resposta}
                </p>
              )}
              {d.status === "publicado" && d.denunciado && (
                <p className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-coral-50 p-3 text-sm text-coral-700">
                  <span>
                    Denunciado por{" "}
                    {d.denunciadoPor ? (
                      <Link href={`/moderacao/contas/${d.denunciadoPor.id}`} className="font-semibold hover:underline">
                        {d.denunciadoPor.nome}
                      </Link>
                    ) : (
                      "conta removida"
                    )}
                    : {d.motivoDenuncia}
                  </span>
                  <Link href={hrefModeracao("denuncias")} className="link">
                    Decidir na fila
                  </Link>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      <Paginacao atual={filtros.pagina} total={resultado.paginas} href={(pagina) => href({ pagina })} />
    </div>
  );
}
