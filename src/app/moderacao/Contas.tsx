import Link from "next/link";
import { Paginacao } from "@/components/Paginacao";
import { listarContas } from "@/lib/moderacao/consultas";
import { hrefModeracao, SITUACOES_CONTA, type FiltrosModeracao, type SituacaoConta } from "@/lib/moderacao/filtros";
import { formatarDataCurta } from "@/lib/texto";
import { Busca, contar, Etiqueta, numero, Pilulas, Vazio } from "./Blocos";

/** Todas as contas, com o que cada uma fez no site. O nome leva à ficha da conta. */
export async function Contas({ filtros }: { filtros: FiltrosModeracao }) {
  const resultado = await listarContas({ q: filtros.q, situacao: filtros.contas, pagina: filtros.pagina });
  const href = (mudanca: { situacao?: SituacaoConta; pagina?: number }) =>
    hrefModeracao("contas", { q: filtros.q, situacao: filtros.contas, ...mudanca, pagina: mudanca.pagina ?? 1 });

  return (
    <div className="space-y-4">
      <Busca aba="contas" q={filtros.q} situacao={filtros.contas} rotulo="Buscar por nome ou e-mail" />
      <Pilulas
        rotulo="Filtrar contas"
        opcoes={(Object.keys(SITUACOES_CONTA) as SituacaoConta[]).map((s) => ({
          href: href({ situacao: s }),
          texto: SITUACOES_CONTA[s],
          ativo: filtros.contas === s,
        }))}
      />
      <p className="text-sm text-suave">{contar(resultado.total, "conta encontrada", "contas encontradas")}</p>

      {resultado.itens.length === 0 ? (
        <Vazio>Nenhuma conta encontrada.</Vazio>
      ) : (
        <div className="cartao overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-linha text-xs tracking-wide text-suave uppercase">
              <tr>
                <th className="p-3 font-semibold">Conta</th>
                <th className="p-3 font-semibold">Desde</th>
                <th className="p-3 font-semibold">Sessão aberta</th>
                <th className="p-3 text-right font-semibold">Negócios</th>
                <th className="p-3 text-right font-semibold">Indicações</th>
                <th className="p-3 text-right font-semibold">Depoimentos</th>
                <th className="p-3 text-right font-semibold">Pedidos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {resultado.itens.map((conta) => (
                <tr key={conta.id}>
                  <td className="max-w-72 min-w-48 p-3">
                    <Link href={`/moderacao/contas/${conta.id}`} className="font-semibold hover:text-coral-700 hover:underline">
                      {conta.nome}
                    </Link>{" "}
                    {conta.papel === "moderador" && <Etiqueta tom="info">Moderação</Etiqueta>}
                    <span className="block truncate text-suave" title={conta.email}>
                      {conta.email}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap text-suave">{formatarDataCurta(conta.criadoEm)}</td>
                  <td className="p-3 whitespace-nowrap text-suave">{conta.sessoes[0] ? `desde ${formatarDataCurta(conta.sessoes[0].criadoEm)}` : "—"}</td>
                  <td className="p-3 text-right tabular-nums">{numero(conta._count.empresas)}</td>
                  <td className="p-3 text-right tabular-nums">{numero(conta._count.indicacoes)}</td>
                  <td className="p-3 text-right tabular-nums">{numero(conta._count.depoimentos)}</td>
                  <td className="p-3 text-right tabular-nums">{numero(conta._count.reivindicacoes)}</td>
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
