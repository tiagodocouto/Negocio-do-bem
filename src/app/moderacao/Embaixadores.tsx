import Link from "next/link";
import { RostoDoEmbaixador } from "@/components/Embaixadores";
import { db } from "@/lib/db";
import { formatarSeguidores, lugarDoEmbaixador } from "@/lib/embaixadores";
import { formatarDataCurta } from "@/lib/texto";
import { contar, Etiqueta, Vazio } from "./Blocos";

/** Os embaixadores do bem: os no site primeiro, na ordem em que aparecem. O nome leva à edição. */
export async function Embaixadores() {
  const embaixadores = await db.embaixador.findMany({ orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }] });
  const noSite = embaixadores.filter((e) => e.ativo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-suave">
          {contar(noSite.length, "no site", "no site")} · {contar(noSite.filter((e) => e.naInicial).length, "na página inicial", "na página inicial")}
        </p>
        <Link href="/moderacao/embaixadores/novo" className="botao botao-pequeno">
          Novo embaixador
        </Link>
      </div>

      {embaixadores.length === 0 ? (
        <Vazio>Nenhum embaixador cadastrado ainda.</Vazio>
      ) : (
        <div className="cartao overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-linha text-xs tracking-wide text-suave uppercase">
              <tr>
                <th className="p-3 font-semibold">Ordem</th>
                <th className="p-3 font-semibold">Embaixador</th>
                <th className="p-3 font-semibold">Onde</th>
                <th className="p-3 text-right font-semibold">Seguidores</th>
                <th className="p-3 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {embaixadores.map((e) => (
                <tr key={e.id}>
                  <td className="p-3 text-suave tabular-nums">{e.ordem}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <RostoDoEmbaixador embaixador={e} className="h-10 w-10 text-sm" />
                      <div className="min-w-0">
                        <Link href={`/moderacao/embaixadores/${e.id}`} className="font-semibold hover:text-coral-700 hover:underline">
                          {e.nome}
                        </Link>
                        <span className="block truncate text-suave">@{e.instagramUsername}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{lugarDoEmbaixador(e)}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {e.seguidores === null ? (
                      <span className="text-suave">—</span>
                    ) : (
                      <>
                        <span className="tabular-nums">{formatarSeguidores(e.seguidores)}</span>
                        <span className="block text-xs text-suave">
                          {e.seguidoresManual ? "à mão" : e.seguidoresEm ? `Instagram, ${formatarDataCurta(e.seguidoresEm)}` : "Instagram"}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex flex-wrap gap-1.5">
                      {e.ativo ? <Etiqueta tom="bom">No site</Etiqueta> : <Etiqueta tom="alerta">Fora do site</Etiqueta>}
                      {e.ativo && e.naInicial && <Etiqueta tom="info">Página inicial</Etiqueta>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
