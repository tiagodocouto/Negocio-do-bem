import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { FotoEmpresa } from "@/components/FotoEmpresa";
import { exigirModerador } from "@/lib/auth/sessao";
import { ACOES_AUDITORIA, METODOS_REIVINDICACAO, STATUS_REIVINDICACAO } from "@/lib/dominio";
import { fichaDaConta, LIMITE_DA_FICHA } from "@/lib/moderacao/consultas";
import { hrefModeracao, lerId } from "@/lib/moderacao/filtros";
import { formatarData, formatarDataHora } from "@/lib/texto";
import { contar, Etiqueta, EtiquetasDoNegocio, numero, type Tom } from "../../Blocos";

export const metadata: Metadata = { title: "Ficha da conta · Moderação", robots: { index: false } };

export default function FichaDaConta(props: PageProps<"/moderacao/contas/[id]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<div className="h-[40rem] animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo params={props.params} />
      </Suspense>
    </div>
  );
}

const TOM_DO_PEDIDO: Record<string, Tom> = { pendente: "atencao", aprovada: "bom", recusada: "alerta" };

async function Conteudo({ params }: Pick<PageProps<"/moderacao/contas/[id]">, "params">) {
  await exigirModerador();
  const id = lerId((await params).id);
  const conta = id ? await fichaDaConta(id) : null;
  if (!conta) notFound();

  const agora = new Date();
  const sessoesAbertas = conta.sessoes.filter((s) => s.expiraEm > agora);
  const numeros = [
    { ancora: "negocios", texto: contar(conta.empresas.length, "negócio como dono", "negócios como dono") },
    { ancora: "indicacoes", texto: contar(conta._count.indicacoes, "indicação", "indicações") },
    { ancora: "depoimentos", texto: contar(conta._count.depoimentos, "depoimento", "depoimentos") },
    { ancora: "denuncias", texto: contar(conta._count.denuncias, "denúncia", "denúncias") },
    { ancora: "pedidos", texto: contar(conta._count.reivindicacoes, "pedido de reivindicação", "pedidos de reivindicação") },
    { ancora: "auditoria", texto: contar(conta._count.registrosAuditoria, "ação na auditoria", "ações na auditoria") },
  ];

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <Link href={hrefModeracao("contas")} className="inline-block text-sm text-suave hover:text-tinta">
          ← Contas
        </Link>
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Ficha da conta</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-serif text-4xl font-semibold tracking-tight">
            {conta.nome}
            {conta.papel === "moderador" && <Etiqueta tom="info">Moderação</Etiqueta>}
          </h1>
          <p className="mt-1 break-all text-suave">{conta.email}</p>
        </div>
        <dl className="cartao grid grid-cols-1 gap-x-6 gap-y-2 p-5 text-sm sm:grid-cols-[11rem_1fr]">
          <dt className="text-suave">Conta criada em</dt>
          <dd>{formatarDataHora(conta.criadoEm)}</dd>
          <dt className="text-suave">E-mail confirmado</dt>
          <dd>{conta.emailConfirmadoEm ? `Em ${formatarDataHora(conta.emailConfirmadoEm)}` : "Ainda não"}</dd>
          <dt className="text-suave">Sessões abertas</dt>
          <dd>
            {sessoesAbertas.length === 0
              ? "Nenhuma"
              : `${numero(sessoesAbertas.length)}, a mais recente aberta em ${formatarDataHora(sessoesAbertas[0]!.criadoEm)}`}
          </dd>
          {conta._count.revisoes > 0 && (
            <>
              <dt className="text-suave">Como moderação</dt>
              <dd>Decidiu {contar(conta._count.revisoes, "pedido de reivindicação", "pedidos de reivindicação")}</dd>
            </>
          )}
        </dl>
        <p className="text-xs text-suave">
          O e-mail só aparece para a moderação. &ldquo;Sair&rdquo; apaga a sessão, então quem saiu não deixa sessão aberta.
        </p>
        <nav aria-label="Resumo da conta" className="flex flex-wrap gap-2">
          {numeros.map((n) => (
            <a key={n.ancora} href={`#${n.ancora}`} className="rounded-full border border-linha bg-superficie px-3.5 py-1.5 text-sm hover:border-tinta/30">
              {n.texto}
            </a>
          ))}
        </nav>
      </div>

      <Secao id="negocios" titulo="Negócios como dono" vazio="Esta conta não é dona de nenhum negócio.">
        {conta.empresas.map(({ empresa, criadoEm }) => (
          <LinhaDeNegocio key={empresa.id} empresa={empresa}>
            Dono desde {formatarData(criadoEm)}
            {empresa._count.membros > 1 && `, com mais ${contar(empresa._count.membros - 1, "pessoa", "pessoas")}`}
          </LinhaDeNegocio>
        ))}
      </Secao>

      <Secao id="indicacoes" titulo="Indicações" total={conta._count.indicacoes} vazio="Não indicou nenhum negócio.">
        {conta.indicacoes.map((empresa) => (
          <LinhaDeNegocio key={empresa.id} empresa={empresa}>
            Indicado em {formatarData(empresa.criadoEm)}
          </LinhaDeNegocio>
        ))}
      </Secao>

      <Secao id="depoimentos" titulo="Depoimentos" total={conta._count.depoimentos} vazio="Não escreveu nenhum depoimento.">
        {conta.depoimentos.map((d) => (
          <li key={d.id} className="space-y-2 p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm text-suave">
              Em{" "}
              <Link href={`/empresas/${d.empresa.instagramUsername}#depoimentos`} className="font-semibold text-tinta hover:text-coral-700 hover:underline">
                {d.empresa.nome}
              </Link>{" "}
              · {formatarDataHora(d.criadoEm)}
              {d.status === "removido" && <Etiqueta tom="alerta">Removido</Etiqueta>}
              {d.status === "publicado" && d.denunciado && <Etiqueta tom="atencao">Denúncia aberta</Etiqueta>}
              {d.resposta && <Etiqueta tom="bom">Respondido</Etiqueta>}
            </p>
            <p className="font-serif whitespace-pre-line">{d.texto}</p>
          </li>
        ))}
      </Secao>

      <Secao
        id="denuncias"
        titulo="Denúncias"
        total={conta._count.denuncias}
        descricao="Denúncias abertas e as que levaram à remoção. Quando a moderação mantém o depoimento, a denúncia é apagada."
        vazio="Nenhuma denúncia guardada."
      >
        {conta.denuncias.map((d) => (
          <li key={d.id} className="space-y-2 p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm text-suave">
              Depoimento de{" "}
              <Link href={`/moderacao/contas/${d.autor.id}`} className="font-semibold text-tinta hover:text-coral-700 hover:underline">
                {d.autor.nome}
              </Link>{" "}
              em {d.empresa.nome}
              {d.status === "removido" ? <Etiqueta tom="alerta">Removido</Etiqueta> : <Etiqueta tom="atencao">Em aberto</Etiqueta>}
            </p>
            <p className="line-clamp-3 font-serif">{d.texto}</p>
            {d.motivoDenuncia && <p className="text-sm text-coral-700">Motivo: {d.motivoDenuncia}</p>}
          </li>
        ))}
      </Secao>

      <Secao id="pedidos" titulo="Pedidos de reivindicação" total={conta._count.reivindicacoes} vazio="Não pediu nenhum negócio.">
        {conta.reivindicacoes.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <Link href={`/moderacao/negocios/${r.empresa.instagramUsername}`} className="font-semibold hover:text-coral-700 hover:underline">
                {r.empresa.nome}
              </Link>
              <p className="text-suave">
                {METODOS_REIVINDICACAO[r.metodo] ?? r.metodo} · pedido em {formatarDataHora(r.criadoEm)}
                {r.revisadoEm && (
                  <>
                    {" · decidido em "}
                    {formatarDataHora(r.revisadoEm)}
                    {r.revisadoPor && (
                      <>
                        {" por "}
                        <Link href={`/moderacao/contas/${r.revisadoPor.id}`} className="hover:text-tinta hover:underline">
                          {r.revisadoPor.nome}
                        </Link>
                      </>
                    )}
                  </>
                )}
              </p>
              {r.motivoRecusa && <p className="mt-1 text-coral-700">Motivo da recusa: {r.motivoRecusa}</p>}
            </div>
            <Etiqueta tom={TOM_DO_PEDIDO[r.status] ?? "neutro"}>{STATUS_REIVINDICACAO[r.status] ?? r.status}</Etiqueta>
          </li>
        ))}
      </Secao>

      <section id="auditoria" className="scroll-mt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-serif text-2xl font-semibold">Auditoria</h2>
          <Link href={hrefModeracao("auditoria", { pessoa: conta.id })} className="link text-sm">
            Tudo o que esta conta fez
          </Link>
        </div>
        {conta.auditoria.length === 0 ? (
          <p className="cartao p-6 text-sm text-suave">Nada registrado por esta conta ou sobre ela.</p>
        ) : (
          <ul className="cartao divide-y divide-linha text-sm">
            {conta.auditoria.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-4 gap-y-1 p-4">
                <span className="w-36 shrink-0 text-suave">{formatarDataHora(r.criadoEm)}</span>
                <span className="min-w-0 flex-1">
                  {r.usuarioId !== conta.id && (
                    <span className="text-suave">{r.usuario ? `${r.usuario.nome}: ` : "Sistema: "}</span>
                  )}
                  {ACOES_AUDITORIA[r.acao] ?? r.acao}
                  {r.alvo && (
                    <>
                      {" · "}
                      <Link href={r.alvo.href} className="hover:text-coral-700 hover:underline">
                        {r.alvo.rotulo}
                      </Link>
                    </>
                  )}
                  {r.detalhes && <span className="block text-suave">{r.detalhes}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Secao({
  id,
  titulo,
  total,
  descricao,
  vazio,
  children,
}: {
  id: string;
  titulo: string;
  total?: number;
  descricao?: string;
  vazio: string;
  children: ReactNode[];
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="font-serif text-2xl font-semibold">{titulo}</h2>
      {descricao && <p className="mt-1 text-sm text-suave">{descricao}</p>}
      {children.length === 0 ? (
        <p className="cartao mt-4 p-6 text-sm text-suave">{vazio}</p>
      ) : (
        <ul className="cartao mt-4 divide-y divide-linha">{children}</ul>
      )}
      {total !== undefined && total > children.length && (
        <p className="mt-2 text-sm text-suave">
          Mostrando os {LIMITE_DA_FICHA} mais recentes de {numero(total)}.
        </p>
      )}
    </section>
  );
}

function LinhaDeNegocio({
  empresa,
  children,
}: {
  empresa: { nome: string; instagramUsername: string; fotoUrl: string | null; cidade: string; uf: string; moderacao: string; oculta: boolean; status: string };
  children: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-4 p-4">
      <FotoEmpresa empresa={empresa} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={`/empresas/${empresa.instagramUsername}`} className="font-serif text-lg font-semibold hover:text-coral-700">
            {empresa.nome}
          </Link>
          <EtiquetasDoNegocio empresa={empresa} />
        </div>
        <p className="text-sm text-suave">
          @{empresa.instagramUsername} · {empresa.cidade}/{empresa.uf} · {children}
        </p>
      </div>
      <Link href={`/moderacao/negocios/${empresa.instagramUsername}`} className="botao-claro botao-pequeno">
        Editar perfil
      </Link>
    </li>
  );
}
