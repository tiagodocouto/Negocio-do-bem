import Link from "next/link";
import { Fragment } from "react";
import { moderarEmpresa } from "@/acoes/moderacao";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { FotoEmpresa } from "@/components/FotoEmpresa";
import { Paginacao } from "@/components/Paginacao";
import { listarNegocios } from "@/lib/moderacao/consultas";
import { hrefModeracao, SITUACOES_NEGOCIO, type FiltrosModeracao, type SituacaoNegocio } from "@/lib/moderacao/filtros";
import { rotuloDoInstagram } from "@/lib/endereco";
import { formatarData } from "@/lib/texto";
import { Busca, contar, EtiquetasDoNegocio, Pilulas, Vazio } from "./Blocos";

/** Todos os negócios, em qualquer situação, para a moderação achar, editar e tirar do ar. */
export async function Negocios({ filtros }: { filtros: FiltrosModeracao }) {
  const resultado = await listarNegocios({ q: filtros.q, situacao: filtros.negocios, pagina: filtros.pagina });
  const href = (mudanca: { situacao?: SituacaoNegocio; pagina?: number }) =>
    hrefModeracao("negocios", { q: filtros.q, situacao: filtros.negocios, ...mudanca, pagina: mudanca.pagina ?? 1 });
  // Depois de tirar do ar ou publicar, a moderação volta para esta mesma lista.
  const aqui = href({ pagina: filtros.pagina });

  return (
    <div className="space-y-4">
      <Busca aba="negocios" q={filtros.q} situacao={filtros.negocios} rotulo="Buscar por nome, @, cidade…" />
      <Pilulas
        rotulo="Filtrar negócios"
        opcoes={(Object.keys(SITUACOES_NEGOCIO) as SituacaoNegocio[]).map((s) => ({
          href: href({ situacao: s }),
          texto: SITUACOES_NEGOCIO[s],
          ativo: filtros.negocios === s,
        }))}
      />
      <p className="text-sm text-suave">
        {contar(resultado.total, "negócio encontrado", "negócios encontrados")}, dos atualizados mais recentemente aos mais antigos
      </p>

      {resultado.itens.length === 0 ? (
        <Vazio>Nenhum negócio encontrado.</Vazio>
      ) : (
        <ul className="cartao divide-y divide-linha">
          {resultado.itens.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start gap-4 p-4">
              <FotoEmpresa empresa={e} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/empresas/${e.instagramUsername}`} className="font-serif text-xl font-semibold hover:text-coral-700">
                    {e.nome}
                  </Link>
                  <EtiquetasDoNegocio empresa={e} />
                </div>
                <p className="text-sm text-suave">
                  {rotuloDoInstagram(e.instagramUsername)} · {e.categoria} · {e.cidade}/{e.uf} · {contar(e._count.depoimentos, "depoimento", "depoimentos")}
                </p>
                <p className="text-sm text-suave">
                  {e.membros.length > 0 ? (
                    <>
                      {e.membros.length === 1 ? "Dono: " : "Donos: "}
                      {e.membros.map((m, i) => (
                        <Fragment key={m.usuario.id}>
                          {i > 0 && ", "}
                          <Link href={`/moderacao/contas/${m.usuario.id}`} className="hover:text-tinta hover:underline">
                            {m.usuario.nome}
                          </Link>
                        </Fragment>
                      ))}
                    </>
                  ) : (
                    "Sem dono"
                  )}
                  {" · indicado "}
                  {e.indicadaPor ? (
                    <>
                      por{" "}
                      <Link href={`/moderacao/contas/${e.indicadaPor.id}`} className="hover:text-tinta hover:underline">
                        {e.indicadaPor.nome}
                      </Link>
                    </>
                  ) : (
                    "por uma conta removida"
                  )}{" "}
                  em {formatarData(e.criadoEm)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/moderacao/negocios/${e.instagramUsername}`} className="botao-claro botao-pequeno">
                  Editar perfil
                </Link>
                <Link href={hrefModeracao("auditoria", { alvo: `empresa:${e.id}` })} className="botao-claro botao-pequeno">
                  Histórico
                </Link>
                <form action={moderarEmpresa}>
                  <input type="hidden" name="empresaId" value={e.id} />
                  <input type="hidden" name="aba" value="negocios" />
                  <input type="hidden" name="voltar" value={aqui} />
                  <input type="hidden" name="de" value={e.moderacao} />
                  <input type="hidden" name="decisao" value={e.moderacao === "aprovada" ? "rejeitar" : "aprovar"} />
                  <BotaoEnviar className={`${e.moderacao === "aprovada" ? "botao-claro" : "botao"} botao-pequeno`} enviando="…">
                    {e.moderacao === "aprovada" ? "Tirar do ar" : e.moderacao === "rejeitada" ? "Publicar de novo" : "Publicar"}
                  </BotaoEnviar>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Paginacao atual={filtros.pagina} total={resultado.paginas} href={(pagina) => href({ pagina })} />
    </div>
  );
}
