import Form from "next/form";
import Link from "next/link";
import { Paginacao } from "@/components/Paginacao";
import { ACOES_AUDITORIA } from "@/lib/dominio";
import { descreverFiltroDaAuditoria, listarAuditoria } from "@/lib/moderacao/consultas";
import { hrefModeracao, type FiltrosModeracao } from "@/lib/moderacao/filtros";
import { formatarDataHora } from "@/lib/texto";
import { contar, numero, Vazio } from "./Blocos";

/** Quem fez o quê, do mais novo ao mais antigo, com filtros por ação, por pessoa e por alvo. */
export async function Auditoria({ filtros }: { filtros: FiltrosModeracao }) {
  const [resultado, descricao] = await Promise.all([
    listarAuditoria({ acao: filtros.acao, pessoa: filtros.pessoa, alvo: filtros.alvo, pagina: filtros.pagina }),
    descreverFiltroDaAuditoria(filtros),
  ]);
  const alvo = filtros.alvo ? `${filtros.alvo.tipo}:${filtros.alvo.id}` : undefined;
  const href = (mudanca: { acao?: string; pessoa?: string; alvo?: string; pagina?: number }) =>
    hrefModeracao("auditoria", { acao: filtros.acao, pessoa: filtros.pessoa, alvo, ...mudanca, pagina: mudanca.pagina ?? 1 });

  return (
    <div className="space-y-4">
      <Form action="/moderacao" className="cartao flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <input type="hidden" name="aba" value="auditoria" />
        {filtros.pessoa && <input type="hidden" name="pessoa" value={filtros.pessoa} />}
        {alvo && <input type="hidden" name="alvo" value={alvo} />}
        <label htmlFor="acao" className="px-2 text-sm font-medium whitespace-nowrap">
          Ação
        </label>
        <select id="acao" name="acao" defaultValue={filtros.acao} className="campo flex-1">
          <option value="">Todas as ações</option>
          {resultado.acoes.map((a) => (
            <option key={a.acao} value={a.acao}>
              {ACOES_AUDITORIA[a.acao] ?? a.acao} ({numero(a.total)})
            </option>
          ))}
        </select>
        <button type="submit" className="botao">
          Filtrar
        </button>
      </Form>

      {(descricao.pessoa || descricao.alvo || filtros.pessoa || filtros.alvo) && (
        <div className="flex flex-wrap gap-2 text-sm">
          {filtros.pessoa && (
            <Link href={href({ pessoa: "" })} className="rounded-full bg-tinta px-3.5 py-1.5 font-medium text-papel">
              Feito por {descricao.pessoa ?? "conta removida"} <span aria-hidden="true">✕</span>
              <span className="sr-only">(tirar o filtro)</span>
            </Link>
          )}
          {filtros.alvo && (
            <Link href={href({ alvo: "" })} className="rounded-full bg-tinta px-3.5 py-1.5 font-medium text-papel">
              Sobre {descricao.alvo ?? "um registro que não existe mais"} <span aria-hidden="true">✕</span>
              <span className="sr-only">(tirar o filtro)</span>
            </Link>
          )}
        </div>
      )}

      <p className="text-sm text-suave">{contar(resultado.total, "registro", "registros")}, do mais novo ao mais antigo</p>

      {resultado.itens.length === 0 ? (
        <Vazio>Nada registrado com esses filtros.</Vazio>
      ) : (
        <div className="cartao overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-linha text-xs tracking-wide text-suave uppercase">
              <tr>
                <th className="p-3 font-semibold">Quando</th>
                <th className="p-3 font-semibold">Quem</th>
                <th className="p-3 font-semibold">Ação</th>
                <th className="p-3 font-semibold">Alvo</th>
                <th className="p-3 font-semibold">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {resultado.itens.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="p-3 whitespace-nowrap text-suave">{formatarDataHora(r.criadoEm)}</td>
                  <td className="p-3">
                    {r.usuario ? (
                      <Link href={`/moderacao/contas/${r.usuario.id}`} className="hover:text-coral-700 hover:underline">
                        {r.usuario.nome}
                      </Link>
                    ) : (
                      <span className="text-suave italic">sistema</span>
                    )}
                  </td>
                  <td className="p-3">
                    {ACOES_AUDITORIA[r.acao] ?? r.acao}
                    <Link href={href({ acao: r.acao })} className="block font-mono text-xs text-suave hover:text-tinta">
                      {r.acao}
                    </Link>
                  </td>
                  <td className="p-3">
                    {r.alvo ? (
                      <Link href={r.alvo.href} className="hover:text-coral-700 hover:underline">
                        {r.alvo.rotulo}
                      </Link>
                    ) : (
                      <span className="text-suave">removido</span>
                    )}
                    <Link href={href({ alvo: `${r.alvoTipo}:${r.alvoId}` })} className="block text-xs text-suave hover:text-tinta">
                      histórico
                    </Link>
                  </td>
                  <td className="p-3 text-suave">{r.detalhes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacao atual={filtros.pagina} total={resultado.paginas} href={(pagina) => href({ pagina })} />
    </div>
  );
}
