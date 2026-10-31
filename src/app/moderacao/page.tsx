import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  aprovarReivindicacao,
  aprovarReivindicacoesSemDono,
  decidirDenuncia,
  moderarEmpresa,
  publicarIndicacoesPendentes,
  recusarReivindicacao,
} from "@/acoes/moderacao";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { CausaBadge } from "@/components/CausaBadge";
import { LinkInstagram } from "@/components/LinkInstagram";
import { exigirModerador } from "@/lib/auth/sessao";
import { consultarCnpj, formatarCnpj } from "@/lib/cnpj";
import { db } from "@/lib/db";
import { METODOS_REIVINDICACAO } from "@/lib/dominio";
import { perfilOficial } from "@/lib/instagram";
import { ABAS, lerFiltros, type Aba } from "@/lib/moderacao/filtros";
import { formatarDataHora, formatarTelefone } from "@/lib/texto";
import { Auditoria } from "./Auditoria";
import { Contas } from "./Contas";
import { Depoimentos } from "./Depoimentos";
import { MenuModeracao } from "./MenuModeracao";
import { Negocios } from "./Negocios";
import { Sistema } from "./Sistema";
import { VisaoGeral } from "./VisaoGeral";

export const metadata: Metadata = { title: "Moderação", robots: { index: false } };

export default function Moderacao(props: PageProps<"/moderacao">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Painel da moderação</p>
      <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Moderação</h1>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/moderacao">, "searchParams">) {
  await exigirModerador();
  const params = await searchParams;
  const filtros = lerFiltros(params);

  const [reivindicacoes, indicacoes, denuncias] = await Promise.all([
    db.reivindicacao.count({ where: { status: "pendente" } }),
    db.empresa.count({ where: { moderacao: "pendente" } }),
    db.depoimento.count({ where: { denunciado: true, status: "publicado" } }),
  ]);
  const pendentes: Partial<Record<Aba, number>> = { reivindicacoes, indicacoes, denuncias };

  return (
    <div className="mt-8 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
      <MenuModeracao aba={filtros.aba} pendentes={pendentes} />

      <div className="mt-6 min-w-0 space-y-6 lg:mt-0">
        <h2 className="font-serif text-2xl font-semibold">{ABAS[filtros.aba]}</h2>
        <AvisoDaUrl codigo={params.aviso} />

        {filtros.aba === "visao-geral" && <VisaoGeral />}
        {filtros.aba === "reivindicacoes" && <Reivindicacoes />}
        {filtros.aba === "indicacoes" && <Indicacoes />}
        {filtros.aba === "denuncias" && <Denuncias />}
        {filtros.aba === "negocios" && <Negocios filtros={filtros} />}
        {filtros.aba === "contas" && <Contas filtros={filtros} />}
        {filtros.aba === "depoimentos" && <Depoimentos filtros={filtros} />}
        {filtros.aba === "auditoria" && <Auditoria filtros={filtros} />}
        {filtros.aba === "sistema" && <Sistema />}
      </div>
    </div>
  );
}

async function Reivindicacoes() {
  const [pendentes, semDono] = await Promise.all([
    db.reivindicacao.findMany({
      where: { status: "pendente" },
      orderBy: { criadoEm: "asc" },
      take: 50,
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        empresa: { include: { membros: { include: { usuario: { select: { id: true, nome: true, email: true } } } } } },
      },
    }),
    // Um negócio por vez: se duas pessoas pediram o mesmo, só a primeira é aprovada.
    db.reivindicacao.findMany({
      where: {
        status: "pendente",
        metodo: "documento",
        empresa: { moderacao: { not: "rejeitada" }, membros: { none: {} } },
      },
      distinct: ["empresaId"],
      select: { id: true },
    }),
  ]);
  const oficial = perfilOficial();
  const agora = new Date();

  return (
    <div className="space-y-4">
      {semDono.length > 0 && (
        <form action={aprovarReivindicacoesSemDono} className="cartao flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-suave">
            Pedidos novos de negócios sem dono já são aprovados na hora. Estes chegaram antes dessa regra.
          </p>
          <BotaoEnviar className="botao botao-pequeno whitespace-nowrap" enviando="Aprovando…">
            Aprovar {semDono.length === 1 ? "o pedido" : `os ${semDono.length} pedidos`} sem dono
          </BotaoEnviar>
        </form>
      )}

      {pendentes.length === 0 && (
        <p className="cartao p-8 text-center text-suave">Nenhuma reivindicação pendente. 🎉</p>
      )}

      {pendentes.map((r) => {
        const expirada = r.expiraEm <= agora;
        const temDono = r.empresa.membros.length > 0;
        return (
          <article key={r.id} className="cartao space-y-4 p-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/empresas/${r.empresa.instagramUsername}`} className="font-serif text-2xl font-semibold hover:text-coral-700">
                  {r.empresa.nome}
                </Link>
                <p className="text-sm text-suave">
                  <LinkInstagram endereco={r.empresa.instagramUsername} />{" "}
                  · {r.empresa.status === "verificada" ? "já verificado" : "sem dono"}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{METODOS_REIVINDICACAO[r.metodo]}</p>
                <p className="text-suave">pedido em {formatarDataHora(r.criadoEm)}</p>
                {expirada && <p className="font-medium text-coral-700">expirado em {formatarDataHora(r.expiraEm)}</p>}
              </div>
            </header>

            <p className="text-sm">
              <span className="text-suave">Solicitante:</span>{" "}
              <Link href={`/moderacao/contas/${r.usuario.id}`} className="font-semibold hover:text-coral-700 hover:underline">
                {r.usuario.nome}
              </Link>{" "}
              ({r.usuario.email})
            </p>

            {r.metodo === "codigo_dm" && r.codigo && (
              <div className="rounded-2xl bg-papel p-4 text-sm leading-relaxed">
                Pedido antigo: o código por DM não é mais oferecido. Confira se{" "}
                <strong>{oficial ? `@${oficial}` : "o perfil oficial"}</strong> recebeu uma DM <strong>de @{r.empresa.instagramUsername}</strong> com o
                código <code className="rounded bg-superficie px-2 py-0.5 font-mono text-base font-bold text-coral-700">{r.codigo}</code>.
                Se a DM veio de outra conta, recuse.
              </div>
            )}

            {r.metodo === "documento" && (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl bg-papel p-4 text-sm sm:grid-cols-[10rem_1fr]">
                <dt className="text-suave">Relação</dt>
                <dd>{r.relacao}</dd>
                <dt className="text-suave">Contato</dt>
                <dd>{r.contato}</dd>
                {r.cnpj && (
                  <>
                    <dt className="text-suave">CNPJ</dt>
                    <dd>
                      {formatarCnpj(r.cnpj)}
                      <Suspense fallback={<span className="block text-suave">Consultando a Receita…</span>}>
                        <DadosCnpj cnpj={r.cnpj} />
                      </Suspense>
                    </dd>
                  </>
                )}
                {r.site && (
                  <>
                    <dt className="text-suave">Site</dt>
                    <dd>
                      <a href={r.site} target="_blank" rel="noopener noreferrer" className="link break-all">
                        {r.site}
                      </a>
                    </dd>
                  </>
                )}
                {r.mensagem && (
                  <>
                    <dt className="text-suave">Mensagem</dt>
                    <dd className="whitespace-pre-line">{r.mensagem}</dd>
                  </>
                )}
              </dl>
            )}

            {r.notas && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm whitespace-pre-line text-amber-900">
                {r.notas}
              </div>
            )}

            {temDono && (
              <p className="text-sm text-suave">
                Donos atuais:{" "}
                {r.empresa.membros.map((m, i) => (
                  <span key={m.usuarioId}>
                    {i > 0 && ", "}
                    <Link href={`/moderacao/contas/${m.usuario.id}`} className="hover:text-tinta hover:underline">
                      {m.usuario.nome}
                    </Link>{" "}
                    ({m.usuario.email})
                  </span>
                ))}
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-linha pt-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <form action={aprovarReivindicacao}>
                  <input type="hidden" name="reivindicacaoId" value={r.id} />
                  <input type="hidden" name="modo" value="adicionar" />
                  <BotaoEnviar className="botao botao-pequeno" enviando="Aprovando…">
                    {temDono ? "Aprovar como co-dono" : "Aprovar"}
                  </BotaoEnviar>
                </form>
                {temDono && (
                  <form action={aprovarReivindicacao}>
                    <input type="hidden" name="reivindicacaoId" value={r.id} />
                    <input type="hidden" name="modo" value="transferir" />
                    <BotaoEnviar className="botao-coral botao-pequeno" enviando="Transferindo…">
                      Aprovar e transferir
                    </BotaoEnviar>
                  </form>
                )}
              </div>
              <form action={recusarReivindicacao} className="flex flex-1 gap-2 sm:max-w-md">
                <input type="hidden" name="reivindicacaoId" value={r.id} />
                <input name="motivo" maxLength={500} placeholder="Motivo da recusa (a pessoa vê)" className="campo py-1.5 sm:text-sm" />
                <BotaoEnviar className="botao-claro botao-pequeno" enviando="…">
                  Recusar
                </BotaoEnviar>
              </form>
            </div>
          </article>
        );
      })}
    </div>
  );
}

async function DadosCnpj({ cnpj }: { cnpj: string }) {
  const dados = await consultarCnpj(cnpj);
  if (!dados) return <span className="block text-suave">Não foi possível consultar a Receita agora.</span>;
  return (
    <span className="block text-suave">
      {dados.razaoSocial}
      {dados.nomeFantasia && ` (${dados.nomeFantasia})`} · {dados.situacao ?? "situação desconhecida"}
      {dados.municipio && ` · ${dados.municipio}/${dados.uf}`}
    </span>
  );
}

async function Indicacoes() {
  const pendentes = await db.empresa.findMany({
    where: { moderacao: "pendente" },
    orderBy: { criadoEm: "asc" },
    take: 50,
    include: { causas: true, indicadaPor: { select: { id: true, nome: true } } },
  });
  if (pendentes.length === 0) return <p className="cartao p-8 text-center text-suave">Nenhuma indicação esperando. 🎉</p>;

  return (
    <div className="space-y-4">
      <form action={publicarIndicacoesPendentes} className="cartao flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-suave">
          Indicações novas já entram publicadas. Estas chegaram antes dessa regra. Para tirar um negócio do ar depois, use
          a aba Negócios.
        </p>
        <BotaoEnviar className="botao botao-pequeno whitespace-nowrap" enviando="Publicando…">
          Publicar todas
        </BotaoEnviar>
      </form>

      {pendentes.map((e) => (
        <article key={e.id} className="cartao space-y-3 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href={`/empresas/${e.instagramUsername}`} className="font-serif text-2xl font-semibold hover:text-coral-700">
                {e.nome}
              </Link>
              <p className="text-sm text-suave">
                <LinkInstagram endereco={e.instagramUsername} seta />{" "}
                · {e.categoria} · {e.cidade}/{e.uf}
              </p>
            </div>
            <p className="text-right text-sm text-suave">
              por{" "}
              {e.indicadaPor ? (
                <Link href={`/moderacao/contas/${e.indicadaPor.id}`} className="hover:text-tinta hover:underline">
                  {e.indicadaPor.nome}
                </Link>
              ) : (
                "conta removida"
              )}
              <br />
              {formatarDataHora(e.criadoEm)}
            </p>
          </div>
          <p>{e.resumo}</p>
          {e.motivoIndicacao && <p className="text-sm text-suave italic">“{e.motivoIndicacao}”</p>}
          {(e.telefoneComercial || e.site || e.whatsapp || e.emailContato) && (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-suave">
              {e.telefoneComercial && <span>Telefone {formatarTelefone(e.telefoneComercial)}</span>}
              {e.site && (
                <a href={e.site} target="_blank" rel="noopener noreferrer nofollow" className="link break-all">
                  {e.site}
                </a>
              )}
              {e.whatsapp && <span>WhatsApp {formatarTelefone(e.whatsapp)}</span>}
              {e.emailContato && <span>{e.emailContato}</span>}
            </p>
          )}
          {(e.emailDoDono || e.telefoneDoDono) && (
            <p className="text-sm text-suave">
              Contato do dono:{" "}
              {[e.emailDoDono, e.telefoneDoDono && formatarTelefone(e.telefoneDoDono)].filter(Boolean).join(" · ")}
            </p>
          )}
          {e.causas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {e.causas.map((c) => (
                <CausaBadge key={c.causa} slug={c.causa} />
              ))}
            </div>
          )}
          <div className="flex gap-2 border-t border-linha pt-4">
            <form action={moderarEmpresa}>
              <input type="hidden" name="empresaId" value={e.id} />
              <input type="hidden" name="de" value="pendente" />
              <input type="hidden" name="decisao" value="aprovar" />
              <BotaoEnviar className="botao botao-pequeno" enviando="…">
                Publicar
              </BotaoEnviar>
            </form>
            <form action={moderarEmpresa}>
              <input type="hidden" name="empresaId" value={e.id} />
              <input type="hidden" name="de" value="pendente" />
              <input type="hidden" name="decisao" value="rejeitar" />
              <BotaoEnviar className="botao-claro botao-pequeno" enviando="…">
                Não publicar
              </BotaoEnviar>
            </form>
            <Link href={`/moderacao/negocios/${e.instagramUsername}`} className="botao-claro botao-pequeno ml-auto">
              Editar perfil
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

async function Denuncias() {
  const denunciados = await db.depoimento.findMany({
    where: { denunciado: true, status: "publicado" },
    orderBy: { criadoEm: "asc" },
    take: 50,
    include: {
      autor: { select: { id: true, nome: true, email: true } },
      denunciadoPor: { select: { id: true, nome: true } },
      empresa: { select: { nome: true, instagramUsername: true } },
    },
  });
  if (denunciados.length === 0) return <p className="cartao p-8 text-center text-suave">Nenhuma denúncia aberta. 🎉</p>;

  return (
    <div className="space-y-4">
      {denunciados.map((d) => (
        <article key={d.id} className="cartao space-y-3 p-6">
          <p className="text-sm text-suave">
            Em{" "}
            <Link href={`/empresas/${d.empresa.instagramUsername}#depoimentos`} className="link">
              {d.empresa.nome}
            </Link>{" "}
            · por{" "}
            <Link href={`/moderacao/contas/${d.autor.id}`} className="hover:text-tinta hover:underline">
              {d.autor.nome}
            </Link>{" "}
            ({d.autor.email}) · {formatarDataHora(d.criadoEm)}
          </p>
          <blockquote className="font-serif text-lg whitespace-pre-line">{d.texto}</blockquote>
          <p className="rounded-2xl bg-coral-50 p-3 text-sm text-coral-700">
            Denunciado por{" "}
            {d.denunciadoPor ? (
              <Link href={`/moderacao/contas/${d.denunciadoPor.id}`} className="font-semibold hover:underline">
                {d.denunciadoPor.nome}
              </Link>
            ) : (
              "conta removida"
            )}
            : {d.motivoDenuncia}
          </p>
          <div className="flex gap-2 border-t border-linha pt-4">
            <form action={decidirDenuncia}>
              <input type="hidden" name="depoimentoId" value={d.id} />
              <input type="hidden" name="decisao" value="manter" />
              <BotaoEnviar className="botao-claro botao-pequeno" enviando="…">
                Manter no ar
              </BotaoEnviar>
            </form>
            <form action={decidirDenuncia}>
              <input type="hidden" name="depoimentoId" value={d.id} />
              <input type="hidden" name="decisao" value="remover" />
              <BotaoEnviar className="botao-coral botao-pequeno" enviando="…">
                Remover
              </BotaoEnviar>
            </form>
          </div>
        </article>
      ))}
    </div>
  );
}
