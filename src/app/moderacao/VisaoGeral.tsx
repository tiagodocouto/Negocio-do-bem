import Link from "next/link";
import type { ReactNode } from "react";
import { buscarCausa } from "@/lib/causas";
import { hrefCausa, hrefDiretorio, hrefTipo, rotuloEstado, temPaginaDeTipo } from "@/lib/diretorio";
import { NOMES_UF, UFS, type Uf } from "@/lib/dominio";
import { hrefModeracao, type Semana } from "@/lib/moderacao/filtros";
import { atividadeSemanal, distribuicaoDoDiretorio, resumoDoPainel, saudeDosDados, type Contagem } from "@/lib/moderacao/indicadores";
import { formatarDiaMes } from "@/lib/texto";
import { Barras, Colunas, contar, Detalhes, numero, Numero, TituloDoBloco } from "./Blocos";

const NA_LISTA = 8;

export async function VisaoGeral() {
  const agora = new Date();
  const [resumo, atividade, distribuicao, saude] = await Promise.all([
    resumoDoPainel(agora),
    atividadeSemanal(agora),
    distribuicaoDoDiretorio(),
    saudeDosDados(agora),
  ]);
  const { negocios, contas, depoimentos, reivindicacoes } = resumo;
  const negociosEm = (situacao: string) => hrefModeracao("negocios", { situacao });
  const contasEm = (situacao: string) => hrefModeracao("contas", { situacao });
  const depoimentosEm = (situacao: string) => hrefModeracao("depoimentos", { situacao });

  const filas = [
    { total: reivindicacoes.pendentes, texto: ["pedido de reivindicação", "pedidos de reivindicação"], href: hrefModeracao("reivindicacoes") },
    { total: negocios.pendentes, texto: ["indicação antiga", "indicações antigas"], href: hrefModeracao("indicacoes") },
    { total: depoimentos.denunciados, texto: ["denúncia aberta", "denúncias abertas"], href: hrefModeracao("denuncias") },
  ].filter((f) => f.total > 0);

  return (
    <div className="space-y-12">
      <section aria-label="Filas esperando a moderação">
        {filas.length === 0 ? (
          <p className="cartao flex items-center gap-3 p-5 text-sm">
            <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-folha-50 font-bold text-folha">
              ✓
            </span>
            Nenhuma fila esperando a moderação.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {filas.map((f) => (
              <Link key={f.href} href={f.href} className="cartao flex items-center gap-4 border-coral/30 bg-coral-50 p-5 transition hover:border-coral">
                <span className="text-3xl font-semibold text-coral-700">{numero(f.total)}</span>
                <span className="text-sm font-medium">{f.total === 1 ? f.texto[0] : f.texto[1]} esperando →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <TituloDoBloco titulo="Números do projeto" descricao="Tudo o que está no banco, inclusive o que não aparece para o público." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="cartao p-5">
            <Numero valor={negocios.noDiretorio} rotulo={`negócios no diretório, de ${contar(negocios.total, "cadastrado", "cadastrados")}`} href={negociosEm("diretorio")} />
            <Detalhes
              itens={[
                { rotulo: "Verificados pelo dono", valor: negocios.verificados, href: negociosEm("verificados") },
                { rotulo: "Sem dono", valor: negocios.semDono, href: negociosEm("sem-dono") },
                { rotulo: "Tirados do ar", valor: negocios.foraDoAr, href: negociosEm("fora-do-ar") },
                { rotulo: "Ocultos pelo dono", valor: negocios.ocultos, href: negociosEm("ocultos") },
                { rotulo: "Indicados nos últimos 7 dias", valor: negocios.novos },
              ]}
            />
          </div>
          <div className="cartao p-5">
            <Numero valor={contas.total} rotulo="contas cadastradas" href={hrefModeracao("contas")} />
            <Detalhes
              itens={[
                { rotulo: "Donos de negócio", valor: contas.donos, href: contasEm("donos") },
                { rotulo: "Moderação", valor: contas.moderacao, href: contasEm("moderacao") },
                { rotulo: "Com sessão aberta", valor: contas.comSessao },
                { rotulo: "Sem atividade", valor: contas.semAtividade, href: contasEm("sem-atividade") },
                { rotulo: "Criadas nos últimos 7 dias", valor: contas.novas, href: contasEm("novas") },
              ]}
            />
          </div>
          <div className="cartao p-5">
            <Numero valor={depoimentos.publicados} rotulo="depoimentos publicados" href={depoimentosEm("publicados")} />
            <Detalhes
              itens={[
                { rotulo: "Com resposta do dono", valor: depoimentos.respondidos },
                { rotulo: "Sem resposta", valor: depoimentos.publicados - depoimentos.respondidos, href: depoimentosEm("sem-resposta") },
                { rotulo: "Com denúncia aberta", valor: depoimentos.denunciados, href: depoimentosEm("denunciados") },
                { rotulo: "Removidos", valor: depoimentos.removidos, href: depoimentosEm("removidos") },
                { rotulo: "Escritos nos últimos 7 dias", valor: depoimentos.novos },
              ]}
            />
          </div>
          <div className="cartao p-5">
            <Numero valor={reivindicacoes.total} rotulo="pedidos de reivindicação" />
            <Detalhes
              itens={[
                { rotulo: "Aprovados", valor: reivindicacoes.aprovadas },
                { rotulo: "Recusados", valor: reivindicacoes.recusadas },
                { rotulo: "Em análise", valor: reivindicacoes.pendentes, href: hrefModeracao("reivindicacoes") },
                { rotulo: "Cancelados ou expirados", valor: reivindicacoes.total - reivindicacoes.aprovadas - reivindicacoes.recusadas - reivindicacoes.pendentes },
              ]}
            />
          </div>
        </div>
      </section>

      <section>
        <TituloDoBloco titulo="Atividade" descricao="O que entrou em cada semana. Cada semana são 7 dias corridos, até hoje." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Colunas titulo="Negócios indicados" semanas={atividade.negocios} />
          <Colunas titulo="Contas criadas" semanas={atividade.contas} />
          <Colunas titulo="Depoimentos" semanas={atividade.depoimentos} />
          <Colunas titulo="Pedidos de reivindicação" semanas={atividade.reivindicacoes} />
        </div>
        <TabelaDaAtividade atividade={atividade} />
      </section>

      <section>
        <TituloDoBloco titulo="O diretório" descricao="Só os negócios que o público vê. Os links abrem as páginas públicas." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Distribuicao titulo="Por estado" lista={distribuicao.porUf} vazio="Nenhum negócio no diretório.">
            {(c) => ({
              rotulo: (UFS as readonly string[]).includes(c.chave) ? NOMES_UF[c.chave as Uf] : c.chave,
              href: (UFS as readonly string[]).includes(c.chave) ? hrefDiretorio({ onde: rotuloEstado(c.chave as Uf) }) : undefined,
            })}
          </Distribuicao>
          <Distribuicao titulo="Por tipo" lista={distribuicao.porCategoria} vazio="Nenhum negócio no diretório.">
            {(c) => ({ rotulo: c.chave, href: temPaginaDeTipo(c.chave) ? hrefTipo(c.chave) : undefined })}
          </Distribuicao>
          <Distribuicao titulo="Por causa" lista={distribuicao.porCausa} vazio="Nenhum negócio marcou uma causa.">
            {(c) => {
              const causa = buscarCausa(c.chave);
              return { rotulo: causa ? `${causa.emoji} ${causa.nome}` : c.chave, href: causa ? hrefCausa(causa.slug) : undefined };
            }}
          </Distribuicao>
        </div>
      </section>

      <section>
        <TituloDoBloco titulo="Saúde dos dados" descricao="O que está incompleto ou fora do padrão." />
        <ul className="cartao divide-y divide-linha">
          <Saude total={saude.semFoto} href={hrefModeracao("negocios", { situacao: "sem-foto" })}>
            {contar(saude.semFoto, "negócio do diretório", "negócios do diretório")} sem foto
          </Saude>
          <Saude total={saude.semContato} href={hrefModeracao("negocios", { situacao: "sem-contato" })}>
            {contar(saude.semContato, "negócio do diretório", "negócios do diretório")} sem site, WhatsApp nem e-mail
          </Saude>
          <Saude total={saude.semHistoria} href={hrefModeracao("negocios", { situacao: "sem-historia" })}>
            {contar(saude.semHistoria, "negócio do diretório", "negócios do diretório")} sem história
          </Saude>
          <Saude total={saude.cidadesForaDaLista.length}>
            {contar(saude.cidadesForaDaLista.length, "cidade gravada", "cidades gravadas")} com um nome diferente do oficial do IBGE
            {saude.cidadesForaDaLista.length > 0 && (
              <>
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-suave">
                  {saude.cidadesForaDaLista.slice(0, 12).map((c) => (
                    <Link key={`${c.cidade}/${c.uf}`} href={hrefModeracao("negocios", { q: c.cidade })} className="hover:text-tinta hover:underline">
                      {c.cidade}/{c.uf} {c.oficial ? `→ ${c.oficial}` : "(fora da lista)"} · {c.total}
                    </Link>
                  ))}
                  {saude.cidadesForaDaLista.length > 12 && <span>e mais {saude.cidadesForaDaLista.length - 12}</span>}
                </span>
                {saude.cidadesForaDaLista.some((c) => c.oficial) && (
                  <span className="mt-1 block text-xs text-suave">
                    Quem cuida do projeto grava os nomes oficiais com <code className="font-mono">npm run cidades:corrigir</code>.
                  </span>
                )}
              </>
            )}
          </Saude>
          <Saude total={saude.pedidosVencidos} href={hrefModeracao("reivindicacoes")}>
            {contar(saude.pedidosVencidos, "pedido em análise", "pedidos em análise")} com o prazo vencido
          </Saude>
          <Saude total={saude.sessoesVencidas} informativo>
            {contar(saude.sessoesVencidas, "sessão vencida guardada", "sessões vencidas guardadas")} no banco. Elas não dão acesso a nada.
          </Saude>
        </ul>
      </section>
    </div>
  );
}

function Distribuicao({
  titulo,
  lista,
  vazio,
  children,
}: {
  titulo: string;
  lista: Contagem[];
  vazio: string;
  children: (c: Contagem) => { rotulo: string; href?: string };
}) {
  const resto = lista.slice(NA_LISTA);
  return (
    <div className="cartao p-5">
      <h4 className="mb-4 font-semibold">{titulo}</h4>
      <Barras vazio={vazio} itens={lista.slice(0, NA_LISTA).map((c) => ({ chave: c.chave, total: c.total, ...children(c) }))} />
      {resto.length > 0 && (
        <p className="mt-3 text-xs text-suave">
          e mais {resto.length}, com {numero(resto.reduce((soma, c) => soma + c.total, 0))} no total
        </p>
      )}
    </div>
  );
}

/** Uma linha da saúde dos dados: zero é bom; acima de zero merece uma olhada. */
function Saude({ total, href, informativo, children }: { total: number; href?: string; informativo?: boolean; children: ReactNode }) {
  const ok = total === 0;
  return (
    <li className="flex items-start gap-3 p-4 text-sm">
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
          ok ? "bg-folha-50 text-folha" : informativo ? "bg-papel text-suave" : "bg-amber-50 text-amber-800"
        }`}
      >
        {ok ? "✓" : informativo ? "i" : "!"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="sr-only">{ok ? "Tudo certo: " : informativo ? "Para saber: " : "Para olhar: "}</span>
        {children}
      </span>
      {href && !ok && (
        <Link href={href} className="link shrink-0 text-sm">
          Ver
        </Link>
      )}
    </li>
  );
}

function TabelaDaAtividade({ atividade }: { atividade: Record<"negocios" | "contas" | "depoimentos" | "reivindicacoes", Semana[]> }) {
  const series = [
    ["Negócios", atividade.negocios],
    ["Contas", atividade.contas],
    ["Depoimentos", atividade.depoimentos],
    ["Pedidos", atividade.reivindicacoes],
  ] as const;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-suave hover:text-tinta">Ver os números de cada semana</summary>
      <div className="cartao mt-3 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-linha text-xs tracking-wide text-suave uppercase">
            <tr>
              <th className="p-3 font-semibold">Semana</th>
              {series.map(([nome]) => (
                <th key={nome} className="p-3 text-right font-semibold">
                  {nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-linha tabular-nums">
            {atividade.negocios.map((semana, i) => (
              <tr key={semana.fim.getTime()}>
                <td className="p-3 whitespace-nowrap text-suave">
                  {formatarDiaMes(semana.inicio)} a {formatarDiaMes(semana.fim)}
                </td>
                {series.map(([nome, lista]) => (
                  <td key={nome} className="p-3 text-right">
                    {numero(lista[i]!.total)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
