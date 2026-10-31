import { ambiente, integracoes, linhasPorTabela, migracoesAplicadas } from "@/lib/moderacao/sistema";
import { formatarDataHora } from "@/lib/texto";
import { Etiqueta, numero, TituloDoBloco } from "./Blocos";

/** Em que ambiente o site roda, o que está ligado e o estado do banco. Nenhum segredo aparece aqui. */
export async function Sistema() {
  const [migracoes, tabelas] = await Promise.all([migracoesAplicadas(), linhasPorTabela()]);
  const local = ambiente();
  const falhas = migracoes.filter((m) => !m.terminadaEm && !m.desfeitaEm);

  return (
    <div className="space-y-10">
      <section>
        <TituloDoBloco titulo="Ambiente" />
        <dl className="cartao grid grid-cols-1 gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-suave">Ambiente</dt>
          <dd className="font-semibold">{local.nome}</dd>
          <dt className="text-suave">Endereço público</dt>
          <dd className="break-all">{local.endereco}</dd>
          <dt className="text-suave">Buscadores</dt>
          <dd>{local.indexavel ? "Podem indexar o site" : "Bloqueados (só a produção entra na busca)"}</dd>
          {local.branch && (
            <>
              <dt className="text-suave">Branch</dt>
              <dd className="font-mono">{local.branch}</dd>
            </>
          )}
          {local.commit && (
            <>
              <dt className="text-suave">Commit</dt>
              <dd className="font-mono">{local.commit}</dd>
            </>
          )}
          {local.regiao && (
            <>
              <dt className="text-suave">Região</dt>
              <dd className="font-mono">{local.regiao}</dd>
            </>
          )}
        </dl>
      </section>

      <section>
        <TituloDoBloco titulo="Integrações" descricao="Só se cada uma está ligada. Os valores das variáveis nunca aparecem aqui." />
        <ul className="cartao divide-y divide-linha">
          {integracoes().map((i) => (
            <li key={i.nome} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{i.nome}</p>
                <p className="text-suave">{i.ligada ? i.ligadaTexto : i.desligadaTexto}</p>
              </div>
              {i.ligada ? <Etiqueta tom="bom">Ligada</Etiqueta> : <Etiqueta>Desligada</Etiqueta>}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <TituloDoBloco titulo="Banco" descricao="Quantas linhas cada tabela tem." />
          <div className="cartao">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-linha">
                {tabelas.map((t) => (
                  <tr key={t.tabela}>
                    <td className="p-3">
                      {t.rotulo} <span className="font-mono text-xs text-suave">{t.tabela}</span>
                    </td>
                    <td className="p-3 text-right font-semibold tabular-nums">{numero(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <TituloDoBloco titulo="Migrações" descricao={`${numero(migracoes.length)} aplicadas neste banco, da mais nova para a mais antiga.`} />
          {falhas.length > 0 && (
            <p className="mb-3 rounded-2xl border border-coral/25 bg-coral-50 p-3 text-sm text-coral-700">
              {falhas.length === 1 ? "Uma migração começou e não terminou" : `${falhas.length} migrações começaram e não terminaram`}. O
              próximo deploy falha até alguém resolver no banco.
            </p>
          )}
          <ul className="cartao divide-y divide-linha text-sm">
            {migracoes.map((m) => (
              <li key={m.nome} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="font-mono text-xs break-all">{m.nome}</span>
                {m.desfeitaEm ? (
                  <Etiqueta>Desfeita</Etiqueta>
                ) : m.terminadaEm ? (
                  <span className="text-xs text-suave">{formatarDataHora(m.terminadaEm)}</span>
                ) : (
                  <Etiqueta tom="alerta">Não terminou</Etiqueta>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
