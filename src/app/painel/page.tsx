import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AvisoDaUrl } from "@/components/Avisos";
import { ConfirmarEmail } from "@/components/ConfirmarEmail";
import { FormTrocarSenha, PedirLinkDeSenhaNova } from "@/components/FormulariosConta";
import { Monograma } from "@/components/Monograma";
import { SeloStatus } from "@/components/SeloStatus";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { METODOS_REIVINDICACAO, MODERACAO_EMPRESA, STATUS_REIVINDICACAO } from "@/lib/dominio";
import { rotuloDoInstagram } from "@/lib/endereco";
import { formatarData } from "@/lib/texto";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Meu painel", robots: FORA_DA_BUSCA };

export default function Painel(props: PageProps<"/painel">) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Meu painel</h1>
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const CORES_STATUS: Record<string, string> = {
  pendente: "bg-amber-50 text-amber-800",
  aprovada: "bg-folha-50 text-folha",
  recusada: "bg-coral-50 text-coral-700",
  expirada: "bg-papel text-suave",
  cancelada: "bg-papel text-suave",
  rejeitada: "bg-coral-50 text-coral-700",
};

function Etiqueta({ status, texto }: { status: string; texto: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CORES_STATUS[status] ?? ""}`}>{texto}</span>;
}

async function Conteudo({ searchParams }: Pick<PageProps<"/painel">, "searchParams">) {
  const { aviso } = await searchParams;
  const usuario = await exigirUsuario("/painel");
  const [empresas, reivindicacoes, indicacoes, conta] = await Promise.all([
    db.empresaMembro.findMany({
      where: { usuarioId: usuario.id },
      include: { empresa: true },
      orderBy: { criadoEm: "asc" },
    }),
    db.reivindicacao.findMany({
      where: { usuarioId: usuario.id, status: { not: "cancelada" } },
      include: { empresa: { select: { nome: true, instagramUsername: true } } },
      orderBy: { criadoEm: "desc" },
      take: 20,
    }),
    db.empresa.findMany({
      where: { indicadaPorId: usuario.id },
      orderBy: { criadoEm: "desc" },
      take: 30,
    }),
    db.usuario.findUnique({ where: { id: usuario.id }, select: { senhaHash: true } }),
  ]);

  return (
    <div className="mt-2 space-y-12">
      <p className="text-suave">Olá, {usuario.nome.split(" ")[0]}! Aqui você cuida dos seus negócios e acompanha suas indicações.</p>

      <AvisoDaUrl codigo={aviso} />

      {!usuario.emailConfirmado && (
        <ConfirmarEmail email={usuario.email} para="indicar, deixar depoimentos e assumir negócios" voltar="/painel" />
      )}

      <section>
        <h2 className="font-serif text-2xl font-semibold">Meus negócios</h2>
        {empresas.length === 0 ? (
          <div className="cartao mt-4 p-6 text-suave">
            Você ainda não tem um negócio verificado.{" "}
            <Link href="/participar?dono=sim" className="link">
              Cadastrar meu negócio
            </Link>{" "}
            ou procure por ele no{" "}
            <Link href="/explorar" className="link">
              diretório
            </Link>{" "}
            e clique em &ldquo;Sou o dono&rdquo;.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {empresas.map(({ empresa }) => (
              <div key={empresa.id} className="cartao flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <Monograma nome={empresa.nome} chave={empresa.instagramUsername} />
                  <div className="min-w-0">
                    <p className="truncate font-serif text-xl font-semibold">{empresa.nome}</p>
                    <p className="text-sm text-suave">{rotuloDoInstagram(empresa.instagramUsername)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SeloStatus status={empresa.status} />
                  {empresa.oculta && <Etiqueta status="expirada" texto="Oculto do diretório" />}
                  {!empresa.historia.trim() && <Etiqueta status="pendente" texto="Falta contar a história" />}
                </div>
                <div className="mt-5 flex gap-2">
                  <Link href={`/painel/${empresa.instagramUsername}`} className="botao botao-pequeno">
                    Editar perfil
                  </Link>
                  <Link href={`/empresas/${empresa.instagramUsername}`} className="botao-claro botao-pequeno">
                    Ver perfil
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {reivindicacoes.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl font-semibold">Minhas solicitações de reivindicação</h2>
          <ul className="cartao mt-4 divide-y divide-linha">
            {reivindicacoes.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/empresas/${r.empresa.instagramUsername}/reivindicar`} className="font-medium hover:text-coral-700">
                    {r.empresa.nome}
                  </Link>
                  <p className="text-sm text-suave">
                    {METODOS_REIVINDICACAO[r.metodo]} · {formatarData(r.criadoEm)}
                  </p>
                  {r.status === "recusada" && r.motivoRecusa && (
                    <p className="mt-1 text-sm text-coral-700">Motivo: {r.motivoRecusa}</p>
                  )}
                </div>
                <Etiqueta status={r.status} texto={STATUS_REIVINDICACAO[r.status] ?? r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-serif text-2xl font-semibold">Minhas indicações</h2>
        {indicacoes.length === 0 ? (
          <p className="mt-4 text-suave">
            Você ainda não indicou nenhum negócio.{" "}
            <Link href="/participar" className="link">
              Indicar agora
            </Link>
          </p>
        ) : (
          <ul className="cartao mt-4 divide-y divide-linha">
            {indicacoes.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 p-4">
                <Link href={`/empresas/${e.instagramUsername}`} className="min-w-0 truncate font-medium hover:text-coral-700">
                  {e.nome} <span className="font-normal text-suave">{rotuloDoInstagram(e.instagramUsername)}</span>
                </Link>
                <Etiqueta status={e.moderacao} texto={MODERACAO_EMPRESA[e.moderacao] ?? e.moderacao} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Minha conta</h2>
        <div className="cartao mt-4 space-y-6 p-6">
          {conta?.senhaHash ? (
            <>
              <div>
                <h3 className="font-medium">Trocar a senha</h3>
                <p className="mt-1 text-sm text-suave">Ao salvar, os outros aparelhos saem da sua conta.</p>
              </div>
              <FormTrocarSenha />
              <PedirLinkDeSenhaNova email={usuario.email}>
                Esqueceu a senha atual? Mandamos para o seu e-mail um link para criar uma nova.
              </PedirLinkDeSenhaNova>
            </>
          ) : (
            <>
              <h3 className="font-medium">Criar uma senha</h3>
              <PedirLinkDeSenhaNova email={usuario.email}>
                Sua conta ainda não tem senha: você entra pelo Google ou por um link no e-mail. Para entrar também com
                e-mail e senha, mandamos para o seu e-mail um link para criar uma.
              </PedirLinkDeSenhaNova>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
