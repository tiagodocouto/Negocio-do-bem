import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cancelarReivindicacao } from "@/acoes/reivindicacoes";
import { Aviso } from "@/components/Aviso";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { ConfirmarEmail } from "@/components/ConfirmarEmail";
import { usuarioAtual } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { METODOS_REIVINDICACAO, STATUS_REIVINDICACAO } from "@/lib/dominio";
import { configLogin, configWebhook, normalizarUsername, perfilOficial } from "@/lib/instagram";
import { formatarDataHora } from "@/lib/texto";
import { CopiarCodigo } from "./CopiarCodigo";
import { FormDocumento, FormGerarCodigo } from "./Formularios";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Reivindicar perfil", robots: FORA_DA_BUSCA };

export default function PaginaReivindicar(props: PageProps<"/empresas/[usuario]/reivindicar">) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-superficie" />}>
        <Reivindicar params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Reivindicar({
  params,
  searchParams,
}: Pick<PageProps<"/empresas/[usuario]/reivindicar">, "params" | "searchParams">) {
  const username = normalizarUsername((await params).usuario);
  if (!username) notFound();
  const [empresa, usuario, busca] = await Promise.all([
    db.empresa.findUnique({ where: { instagramUsername: username }, include: { membros: true } }),
    usuarioAtual(),
    searchParams,
  ]);
  if (!empresa || empresa.moderacao === "rejeitada") notFound();

  const caminho = `/empresas/${username}/reivindicar`;
  const conectada = normalizarUsername(busca.conectada);

  const cabecalho = (
    <div className="mb-8 space-y-4">
      <Link href={`/empresas/${username}`} className="text-sm text-suave hover:text-tinta">
        ← Voltar para o perfil
      </Link>
      <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight">
        Este negócio é seu?
      </h1>
      <p className="text-lg leading-relaxed text-suave">
        Envie os dados do negócio para assumir o perfil de{" "}
        <strong className="font-semibold text-tinta">@{username}</strong>. Depois disso, você conta a sua história,
        escolhe as causas e responde à comunidade.
      </p>
      <AvisoDaUrl codigo={busca.aviso} />
      {busca.aviso === "ig_conta_diferente" && conectada && (
        <p className="text-sm text-suave">
          Você entrou como <strong>@{conectada}</strong>, mas este perfil é de <strong>@{username}</strong>.
        </p>
      )}
    </div>
  );

  if (!usuario) {
    return (
      <>
        {cabecalho}
        <div className="cartao p-8 text-center">
          <p className="font-serif text-2xl">Primeiro, entre na sua conta</p>
          <p className="mt-2 text-suave">É nela que o perfil do negócio vai ficar guardado.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/entrar?voltar=${encodeURIComponent(caminho)}`} className="botao">
              Entrar
            </Link>
            <Link href={`/cadastrar?voltar=${encodeURIComponent(caminho)}`} className="botao-claro">
              Criar conta
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (empresa.membros.some((m) => m.usuarioId === usuario.id)) {
    return (
      <>
        {cabecalho}
        <Aviso tipo="sucesso">
          Você já é dono deste perfil.{" "}
          <Link href={`/painel/${username}`} className="font-semibold underline">
            Ir para o painel
          </Link>
        </Aviso>
      </>
    );
  }

  if (!usuario.emailConfirmado) {
    return (
      <>
        {cabecalho}
        <ConfirmarEmail email={usuario.email} para="assumir o perfil" voltar={caminho} />
      </>
    );
  }

  const solicitacoes = await db.reivindicacao.findMany({
    where: { empresaId: empresa.id, usuarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 5,
  });
  const agora = new Date();
  const codigoVigente = solicitacoes.find(
    (r) => r.metodo === "codigo_dm" && r.status === "pendente" && r.expiraEm > agora,
  );
  const outrasPendentes = solicitacoes.filter((r) => r.status === "pendente" && r.id !== codigoVigente?.id);
  const dadosEmAnalise = outrasPendentes.some((r) => r.metodo === "documento");
  const loginDisponivel = !!configLogin();
  const confirmacaoAutomatica = !!configWebhook();
  const oficial = perfilOficial();
  const outrosCaminhos = loginDisponivel || !!oficial;

  return (
    <>
      {cabecalho}

      {empresa.membros.length > 0 && (
        <div className="mb-6">
          <Aviso tipo="info">
            Este perfil já tem um dono. Se você também cuida deste negócio ou se houve troca de responsáveis, envie
            seus dados abaixo: a solicitação vai para a moderação, que decide com cuidado.
          </Aviso>
        </div>
      )}

      {outrasPendentes.length > 0 && (
        <div className="mb-6 space-y-2">
          {outrasPendentes.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-linha bg-superficie px-4 py-3 text-sm">
              <span>
                <strong>{METODOS_REIVINDICACAO[r.metodo]}</strong> · {STATUS_REIVINDICACAO[r.status]} desde{" "}
                {formatarDataHora(r.criadoEm)}
              </span>
              <form action={cancelarReivindicacao}>
                <input type="hidden" name="empresaId" value={empresa.id} />
                <input type="hidden" name="reivindicacaoId" value={r.id} />
                <BotaoEnviar className="text-xs text-suave underline hover:text-coral-700" enviando="…">
                  Cancelar
                </BotaoEnviar>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {loginDisponivel && (
          <section className="cartao p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl font-semibold">Entrar com Instagram</h2>
              <span className="rounded-full bg-folha-50 px-2.5 py-0.5 text-xs font-semibold text-folha">Instantâneo</span>
            </div>
            <p className="mt-2 leading-relaxed text-suave">
              Entre na conta <strong>@{username}</strong> e pronto: o Instagram confirma pra gente que ela é sua. Funciona
              com contas comerciais ou de criador de conteúdo. Só lemos o nome de usuário, nada mais.
            </p>
            <a href={`/api/instagram/entrar?empresa=${empresa.id}`} className="botao mt-5">
              <InstagramIcone /> Continuar com Instagram
            </a>
          </section>
        )}

        {oficial && (
          <section id="codigo" className="cartao scroll-mt-24 p-6 sm:p-8">
            <h2 className="font-serif text-2xl font-semibold">
              {loginDisponivel ? "Ou mande um código por DM" : "Mande um código por DM"}
            </h2>
            <p className="mt-2 leading-relaxed text-suave">
              Funciona com qualquer conta do Instagram, inclusive pessoal.
            </p>

            {codigoVigente?.codigo ? (
              <div className="mt-6 space-y-5">
                <ol className="space-y-4">
                  <Passo numero={1}>
                    Abra o Instagram logado como <strong>@{username}</strong>, a conta do negócio.
                  </Passo>
                  <Passo numero={2}>
                    Envie uma DM para <strong>@{oficial}</strong> só com este código:
                    <CopiarCodigo codigo={codigoVigente.codigo} />
                    <a
                      href={`https://ig.me/m/${oficial}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link mt-3 inline-block text-sm"
                    >
                      Abrir conversa com @{oficial} ↗
                    </a>
                  </Passo>
                  <Passo numero={3}>
                    {confirmacaoAutomatica
                      ? "Pronto! A confirmação é automática e leva poucos minutos. Atualize esta página para ver."
                      : "Pronto! A moderação confere a mensagem e aprova, normalmente em até um dia útil. O resultado aparece no seu painel."}
                  </Passo>
                </ol>
                <Aviso tipo="erro">
                  <strong>Nunca envie um código que outra pessoa te passou.</strong> Quem gerou o código é quem vira dono
                  do perfil.
                </Aviso>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-suave">
                  <span>O código vale até {formatarDataHora(codigoVigente.expiraEm)}.</span>
                  <form action={cancelarReivindicacao}>
                    <input type="hidden" name="empresaId" value={empresa.id} />
                    <input type="hidden" name="reivindicacaoId" value={codigoVigente.id} />
                    <BotaoEnviar className="underline hover:text-coral-700" enviando="Cancelando…">
                      Cancelar código
                    </BotaoEnviar>
                  </form>
                </div>
              </div>
            ) : (
              <FormGerarCodigo empresaId={empresa.id} />
            )}
          </section>
        )}

        {dadosEmAnalise ? (
          <Aviso tipo="info">
            Seus dados estão com a moderação. O resultado aparece no{" "}
            <Link href="/painel" className="font-semibold underline">
              seu painel
            </Link>
            .
          </Aviso>
        ) : outrosCaminhos ? (
          <details className="group cartao p-6 sm:p-8">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block font-serif text-2xl font-semibold">Não tenho acesso ao Instagram do negócio</span>
                <span className="mt-1 block text-suave">Envie os dados do negócio para assumir o perfil.</span>
              </span>
              <span aria-hidden="true" className="text-2xl text-suave transition group-open:rotate-45">
                +
              </span>
            </summary>
            <FormDocumento empresaId={empresa.id} />
          </details>
        ) : (
          <section className="cartao p-6 sm:p-8">
            <h2 className="font-serif text-2xl font-semibold">Envie os dados do negócio</h2>
            <p className="mt-2 leading-relaxed text-suave">
              {empresa.membros.length > 0
                ? "A moderação analisa o pedido e decide. O resultado aparece no seu painel."
                : "Como ninguém assumiu este perfil ainda, ele passa a ser seu assim que você enviar."}
            </p>
            <FormDocumento empresaId={empresa.id} />
          </section>
        )}
      </div>

      <p className="mt-10 text-center text-sm leading-relaxed text-suave">
        Os dados ficam registrados e ajudam a moderação se houver disputa pelo perfil. Dúvidas?{" "}
        <Link href="/sobre#dono" className="link">
          Veja como funciona
        </Link>
        .
      </p>
    </>
  );
}

function Passo({ numero, children }: { numero: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-coral-50 text-sm font-bold text-coral-700">
        {numero}
      </span>
      <div className="pt-0.5 leading-relaxed">{children}</div>
    </li>
  );
}

function InstagramIcone() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
