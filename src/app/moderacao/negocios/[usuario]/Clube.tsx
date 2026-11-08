import Link from "next/link";
import { recusarPedidoDoClube, suspenderDonoDoClube } from "@/acoes/clube";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { cnpjValido, consultarCnpj, formatarCnpj, limparCnpj } from "@/lib/cnpj";
import { db } from "@/lib/db";
import { comPontoFinal, formatarDataCurta } from "@/lib/texto";
import { DocumentosDoPedido } from "../../DocumentosDoPedido";
import { FichaDaReceita, type NegocioDaFicha } from "../../FichaDaReceita";

/**
 * O Clube do Bem na ficha do negócio, só para a moderação: a liberação de cada dono e a
 * consulta do CNPJ na Receita, com os sócios. A consulta vem do `?cnpj=` da página e nada
 * dela é guardado: só o CNPJ, quando a moderação libera.
 */
export async function Clube({ empresa, cnpjDaUrl, aviso }: { empresa: NegocioDaFicha; cnpjDaUrl?: string; aviso?: string }) {
  const [membros, liberacoes] = await Promise.all([
    db.empresaMembro.findMany({
      where: { empresaId: empresa.id },
      include: { usuario: { select: { id: true, nome: true, email: true } } },
      orderBy: { criadoEm: "asc" },
    }),
    db.liberacaoClube.findMany({ where: { empresaId: empresa.id }, include: { decididoPor: { select: { nome: true } } } }),
  ]);
  const liberacaoDe = new Map(liberacoes.map((liberacao) => [liberacao.usuarioId, liberacao]));
  const cnpj = cnpjDaUrl ? limparCnpj(cnpjDaUrl) : "";
  const ficha = cnpj && cnpjValido(cnpj) ? await consultarCnpj(cnpj) : null;
  // O CNPJ de um pedido na fila vem primeiro, porque é o que a moderação precisa conferir.
  const ultimoCnpj = (liberacoes.find((liberacao) => liberacao.status === "pendente") ?? liberacoes[0])?.cnpj;

  return (
    <section id="clube" className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Clube do Bem</h2>
        <p className="mt-1 text-sm leading-relaxed text-suave">
          Só negócio com CNPJ ativo na Receita (o MEI também tem CNPJ). Confira a ficha e se o nome da conta bate com um dos
          sócios. Cada dono precisa da própria liberação para criar ofertas.
        </p>
      </div>

      <AvisoDaUrl codigo={aviso} />

      {membros.length === 0 ? (
        <p className="cartao p-5 text-sm text-suave">Este negócio ainda não tem dono. Só um dono pode ser liberado.</p>
      ) : (
        <>
          <ul className="cartao divide-y divide-linha">
            {membros.map(({ usuario }) => {
              const liberacao = liberacaoDe.get(usuario.id);
              return (
                <li key={usuario.id} className="space-y-2 p-4 text-sm">
                  <p>
                    <span className="font-medium">{usuario.nome}</span> <span className="text-suave">· {usuario.email}</span>
                  </p>
                  {!liberacao ? (
                    <p className="text-suave">Não liberado. Ainda não pediu a verificação.</p>
                  ) : liberacao.status === "pendente" ? (
                    <>
                      <p className="text-amber-800">
                        Pediu a verificação em {formatarDataCurta(liberacao.decididoEm)}, com o CNPJ {formatarCnpj(liberacao.cnpj)}.{" "}
                        <Link href={`/moderacao/negocios/${empresa.instagramUsername}?cnpj=${liberacao.cnpj}#clube`} className="link">
                          Consultar este CNPJ
                        </Link>
                      </p>
                      <DocumentosDoPedido liberacaoId={liberacao.id} quantidade={liberacao.documentoChaves.length} />
                      {liberacao.motivo && <p className="text-suave">Da última vez: {comPontoFinal(liberacao.motivo)}</p>}
                      <form action={recusarPedidoDoClube} className="flex flex-col gap-2 sm:flex-row">
                        <input type="hidden" name="liberacaoId" value={liberacao.id} />
                        <label htmlFor={`recusa-${liberacao.id}`} className="sr-only">
                          Motivo da recusa
                        </label>
                        <input
                          id={`recusa-${liberacao.id}`}
                          name="motivo"
                          maxLength={500}
                          placeholder="Motivo da recusa (o dono vê)"
                          className="campo py-1.5 sm:text-sm"
                        />
                        <BotaoEnviar className="botao-claro botao-pequeno whitespace-nowrap" enviando="Recusando…">
                          Recusar
                        </BotaoEnviar>
                      </form>
                    </>
                  ) : liberacao.status === "recusada" ? (
                    <p className="text-coral-700">
                      Pedido recusado em {formatarDataCurta(liberacao.decididoEm)}
                      {liberacao.decididoPor && ` por ${liberacao.decididoPor.nome}`}.
                      {liberacao.motivo && ` Motivo: ${comPontoFinal(liberacao.motivo)}`}
                    </p>
                  ) : liberacao.status === "liberada" ? (
                    <>
                      <p className="text-folha">
                        Liberado em {formatarDataCurta(liberacao.decididoEm)}
                        {liberacao.decididoPor && ` por ${liberacao.decididoPor.nome}`} · CNPJ {formatarCnpj(liberacao.cnpj)}
                      </p>
                      <form action={suspenderDonoDoClube} className="flex flex-col gap-2 sm:flex-row">
                        <input type="hidden" name="liberacaoId" value={liberacao.id} />
                        <label htmlFor={`motivo-${liberacao.id}`} className="sr-only">
                          Motivo da suspensão
                        </label>
                        <input
                          id={`motivo-${liberacao.id}`}
                          name="motivo"
                          maxLength={500}
                          placeholder="Motivo da suspensão"
                          className="campo py-1.5 sm:text-sm"
                        />
                        <BotaoEnviar className="botao-claro botao-pequeno whitespace-nowrap" enviando="Suspendendo…">
                          Suspender
                        </BotaoEnviar>
                      </form>
                    </>
                  ) : (
                    <p className="text-coral-700">
                      Suspenso em {formatarDataCurta(liberacao.decididoEm)}
                      {liberacao.decididoPor ? ` por ${liberacao.decididoPor.nome}` : " pelo sistema"}.
                      {liberacao.motivo && ` Motivo: ${comPontoFinal(liberacao.motivo)}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <form action={`/moderacao/negocios/${empresa.instagramUsername}#clube`} method="get" className="cartao space-y-3 p-4">
            <label htmlFor="cnpj-clube" className="rotulo">
              CNPJ do negócio
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="cnpj-clube"
                name="cnpj"
                inputMode="numeric"
                defaultValue={cnpjDaUrl ?? (ultimoCnpj ? formatarCnpj(ultimoCnpj) : "")}
                placeholder="00.000.000/0000-00"
                className="campo"
              />
              <button type="submit" className="botao whitespace-nowrap">
                Consultar na Receita
              </button>
            </div>
          </form>

          {cnpjDaUrl &&
            (!cnpjValido(cnpj) ? (
              <p className="cartao p-4 text-sm text-coral-700">CNPJ inválido. Confira os números.</p>
            ) : !ficha ? (
              <p className="cartao p-4 text-sm text-coral-700">
                Não foi possível consultar a Receita agora, e sem a consulta não há liberação. Tente de novo em alguns minutos.
              </p>
            ) : (
              <FichaDaReceita empresa={empresa} cnpj={cnpj} ficha={ficha} donos={membros.map(({ usuario }) => ({ ...usuario, nomeCompleto: liberacaoDe.get(usuario.id)?.nomeCompleto, cpfMascarado: liberacaoDe.get(usuario.id)?.cpfMascarado }))} />
            ))}
        </>
      )}
    </section>
  );
}
