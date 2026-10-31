import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { denunciarDepoimento } from "@/acoes/depoimentos";
import { AvisoDaUrl } from "@/components/Avisos";
import { CausaBadge } from "@/components/CausaBadge";
import { ConfirmarEmail } from "@/components/ConfirmarEmail";
import { Historia } from "@/components/Historia";
import { JsonLd } from "@/components/JsonLd";
import { FotoEmpresa } from "@/components/FotoEmpresa";
import { SeloStatus } from "@/components/SeloStatus";
import { usuarioAtual, type UsuarioSessao } from "@/lib/auth/sessao";
import { buscarCausa, filtrarCausas } from "@/lib/causas";
import { buscarPerfil, ehDono, podeVerPerfil } from "@/lib/consultas";
import { hrefCausa, hrefTipo, temPaginaDeTipo } from "@/lib/diretorio";
import { MODERACAO_EMPRESA } from "@/lib/dominio";
import { linkPerfil, normalizarUsername } from "@/lib/instagram";
import { FORA_DA_BUSCA, jsonLdDoNegocio, metadadosDaPagina, paginaDaCidade } from "@/lib/seo";
import { formatarData, formatarWhatsapp, tempoDeLeitura } from "@/lib/texto";
import { FormDepoimento } from "./FormDepoimento";

export async function generateMetadata(props: PageProps<"/empresas/[usuario]">): Promise<Metadata> {
  const username = normalizarUsername((await props.params).usuario);
  const empresa = username ? await buscarPerfil(username) : null;
  if (!empresa || empresa.moderacao !== "aprovada" || empresa.oculta) return { title: "Perfil", robots: FORA_DA_BUSCA };
  // "Café da Ana — Café e padaria em Salvador, BA": o que as pessoas buscam é o tipo e a cidade.
  const onde = `${empresa.cidade}, ${empresa.uf}`;
  return metadadosDaPagina({
    titulo: empresa.categoria === "Outros" ? `${empresa.nome} em ${onde}` : `${empresa.nome} — ${empresa.categoria} em ${onde}`,
    descricao: empresa.resumo,
    caminho: `/empresas/${empresa.instagramUsername}`,
  });
}

export default function PaginaEmpresa(props: PageProps<"/empresas/[usuario]">) {
  return (
    <Suspense fallback={<PerfilCarregando />}>
      <Perfil params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

type Perfil = NonNullable<Awaited<ReturnType<typeof buscarPerfil>>>;

async function Perfil({ params, searchParams }: Pick<PageProps<"/empresas/[usuario]">, "params" | "searchParams">) {
  const username = normalizarUsername((await params).usuario);
  if (!username) notFound();
  const [empresa, usuario, { aviso }] = await Promise.all([buscarPerfil(username), usuarioAtual(), searchParams]);
  if (!empresa || !podeVerPerfil(empresa, usuario)) notFound();

  const dono = ehDono(empresa, usuario);
  const causas = filtrarCausas(empresa.causas.map((c) => c.causa));
  const publico = empresa.moderacao === "aprovada" && !empresa.oculta;

  return (
    <article>
      {publico && <JsonLd dados={jsonLdDoNegocio(empresa, causas.map((slug) => buscarCausa(slug)!.nome))} />}
      <header className="border-b border-linha bg-gradient-to-b from-superficie to-papel">
        <div className="mx-auto max-w-3xl px-4 pt-12 pb-10 sm:px-6">
          <div className="mb-6 space-y-3">
            <AvisoDaUrl codigo={aviso} />
            {!publico && (
              <p className="rounded-2xl border border-linha bg-superficie px-4 py-3 text-sm text-suave">
                {empresa.oculta
                  ? "Este perfil está oculto pelo dono e não aparece no diretório."
                  : `${MODERACAO_EMPRESA[empresa.moderacao]}: só você e a moderação veem este perfil por enquanto.`}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <FotoEmpresa empresa={empresa} tamanho="lg" />
            <div className="min-w-0 space-y-2">
              <SeloStatus status={empresa.status} />
              <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
                {empresa.nome}
              </h1>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-suave">
                <a href={linkPerfil(empresa.instagramUsername)} target="_blank" rel="noopener noreferrer" className="link">
                  @{empresa.instagramUsername}
                </a>
                <span aria-hidden="true">·</span>
                {publico && temPaginaDeTipo(empresa.categoria) ? (
                  <Link href={hrefTipo(empresa.categoria)} className="hover:text-tinta hover:underline">
                    {empresa.categoria}
                  </Link>
                ) : (
                  <span>{empresa.categoria}</span>
                )}
                <span aria-hidden="true">·</span>
                {publico ? (
                  <Link href={paginaDaCidade(empresa.cidade, empresa.uf).caminho} className="hover:text-tinta hover:underline">
                    {empresa.cidade}, {empresa.uf}
                  </Link>
                ) : (
                  <span>
                    {empresa.cidade}, {empresa.uf}
                  </span>
                )}
              </p>
            </div>
          </div>

          <Contatos empresa={empresa} />

          <p className="mt-8 font-serif text-2xl leading-snug text-tinta/80 italic text-pretty">{empresa.resumo}</p>

          {causas.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {causas.map((slug) =>
                publico ? (
                  <Link key={slug} href={hrefCausa(slug)} className="transition hover:opacity-80">
                    <CausaBadge slug={slug} grande />
                  </Link>
                ) : (
                  <CausaBadge key={slug} slug={slug} grande />
                ),
              )}
            </div>
          )}

          {dono ? (
            <Link href={`/painel/${empresa.instagramUsername}`} className="botao mt-8">
              Editar meu perfil
            </Link>
          ) : (
            usuario?.moderador && (
              <Link href={`/moderacao/negocios/${empresa.instagramUsername}`} className="botao mt-8">
                Editar perfil (moderação)
              </Link>
            )
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <section className="py-12">
          {empresa.historia.trim() ? (
            <>
              <p className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Nossa história</span>
                <span className="text-sm text-suave">
                  {tempoDeLeitura(empresa.historia)} min de leitura · atualizada em {formatarData(empresa.atualizadoEm)}
                </span>
              </p>
              <Historia markdown={empresa.historia} />
            </>
          ) : (
            <SemHistoria empresa={empresa} dono={dono} />
          )}
        </section>

        {empresa.status !== "verificada" && !dono && <ChamadaReivindicar username={empresa.instagramUsername} />}

        <Depoimentos empresa={empresa} usuario={usuario} dono={dono} publico={publico} />

        {empresa.status === "verificada" && !dono && (
          <p className="mt-12 text-center text-sm text-suave">
            Este perfil é seu e outra pessoa assumiu?{" "}
            <Link href={`/empresas/${empresa.instagramUsername}/reivindicar`} className="link">
              Fale com a moderação
            </Link>
          </p>
        )}
      </div>
    </article>
  );
}

function Contatos({ empresa }: { empresa: Perfil }) {
  if (!empresa.whatsapp && !empresa.site && !empresa.emailContato) return null;
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {empresa.whatsapp && (
        <a href={`https://wa.me/${empresa.whatsapp}`} target="_blank" rel="noopener noreferrer" className="botao botao-pequeno">
          WhatsApp {formatarWhatsapp(empresa.whatsapp)}
        </a>
      )}
      {empresa.site && (
        <a href={empresa.site} target="_blank" rel="noopener noreferrer nofollow" className="botao-claro botao-pequeno">
          {new URL(empresa.site).hostname.replace(/^www\./, "")} ↗
        </a>
      )}
      {empresa.emailContato && (
        // break-all: um e-mail comprido quebra em vez de passar da largura do celular.
        <a href={`mailto:${empresa.emailContato}`} className="botao-claro botao-pequeno max-w-full break-all">
          {empresa.emailContato}
        </a>
      )}
    </div>
  );
}

function SemHistoria({ empresa, dono }: { empresa: Perfil; dono: boolean }) {
  if (dono) {
    return (
      <div className="cartao p-8 text-center">
        <p className="font-serif text-2xl">Conte a história do seu negócio</p>
        <p className="mx-auto mt-2 max-w-md text-suave">
          Como tudo começou, o que move vocês, quem faz acontecer. É aqui que a comunidade conhece vocês de verdade.
        </p>
        <Link href={`/painel/${empresa.instagramUsername}`} className="botao-coral mt-6">
          Escrever nossa história
        </Link>
      </div>
    );
  }
  if (empresa.motivoIndicacao) {
    return (
      <figure className="cartao p-8">
        <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Por que foi indicado</p>
        <blockquote className="font-serif text-2xl leading-relaxed text-tinta/85">“{empresa.motivoIndicacao}”</blockquote>
        {empresa.indicadaPor && (
          <figcaption className="mt-4 text-sm text-suave">— indicado por {empresa.indicadaPor.nome}</figcaption>
        )}
      </figure>
    );
  }
  return <p className="text-center font-serif text-xl text-suave italic">A história deste negócio ainda vai ser contada.</p>;
}

function ChamadaReivindicar({ username }: { username: string }) {
  return (
    <aside className="mb-12 flex flex-col gap-4 rounded-3xl border border-dashed border-coral/40 bg-coral-50/60 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">Este negócio é seu?</p>
        <p className="text-sm text-suave">
          Reivindique o perfil para contar a sua história, escolher suas causas e responder à comunidade.
        </p>
      </div>
      <Link href={`/empresas/${username}/reivindicar`} className="botao-coral shrink-0">
        Sou o dono
      </Link>
    </aside>
  );
}

function Depoimentos({
  empresa,
  usuario,
  dono,
  publico,
}: {
  empresa: Perfil;
  usuario: UsuarioSessao | null;
  dono: boolean;
  publico: boolean;
}) {
  const jaEscreveu = !!usuario && empresa.depoimentos.some((d) => d.autorId === usuario.id);
  return (
    <section id="depoimentos" className="scroll-mt-24 border-t border-linha pt-12">
      <h2 className="font-serif text-3xl font-semibold">Depoimentos da comunidade</h2>
      <p className="mt-1 text-suave">Experiências reais de quem conhece este negócio.</p>

      {publico && !dono && !jaEscreveu && (
        <div className="mt-8">
          {usuario?.emailConfirmado ? (
            <FormDepoimento empresaId={empresa.id} nomeEmpresa={empresa.nome} />
          ) : usuario ? (
            <ConfirmarEmail
              email={usuario.email}
              para="deixar seu depoimento"
              voltar={`/empresas/${empresa.instagramUsername}#depoimentos`}
            />
          ) : (
            <p className="cartao p-5 text-sm text-suave">
              <Link href={`/entrar?voltar=${encodeURIComponent(`/empresas/${empresa.instagramUsername}#depoimentos`)}`} className="link">
                Entre
              </Link>{" "}
              para deixar seu depoimento.
            </p>
          )}
        </div>
      )}

      <div className="mt-8 space-y-4">
        {empresa.depoimentos.length === 0 && (
          <p className="text-suave italic">Ainda não há depoimentos. Que tal ser a primeira pessoa?</p>
        )}
        {empresa.depoimentos.map((depoimento) => (
          <figure key={depoimento.id} className="cartao p-6">
            <blockquote className="font-serif text-lg leading-relaxed whitespace-pre-line text-tinta/90">
              {depoimento.texto}
            </blockquote>
            <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-suave">
              <span>
                <span className="font-medium text-tinta">{depoimento.autor.nome}</span> · {formatarData(depoimento.criadoEm)}
              </span>
              {usuario && usuario.id !== depoimento.autorId && !depoimento.denunciado && (
                <details className="text-xs">
                  <summary className="cursor-pointer list-none text-suave hover:text-coral-700 [&::-webkit-details-marker]:hidden">
                    Denunciar
                  </summary>
                  <form action={denunciarDepoimento} className="mt-2 flex gap-2">
                    <input type="hidden" name="depoimentoId" value={depoimento.id} />
                    <input name="motivo" placeholder="O que há de errado?" className="campo py-1.5 sm:text-xs" maxLength={300} />
                    <button type="submit" className="botao-claro botao-pequeno">
                      Enviar
                    </button>
                  </form>
                </details>
              )}
            </figcaption>
            {depoimento.resposta && (
              <div className="mt-4 rounded-2xl bg-papel p-4 text-sm leading-relaxed">
                <p className="mb-1 font-semibold text-tinta">Resposta de {empresa.nome}</p>
                <p className="whitespace-pre-line text-suave">{depoimento.resposta}</p>
              </div>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

function PerfilCarregando() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-4 pt-12 sm:px-6" aria-busy="true">
      <div className="flex items-center gap-6">
        <div className="h-24 w-24 rounded-full bg-superficie" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-40 rounded-full bg-superficie" />
          <div className="h-10 w-3/4 rounded-full bg-superficie" />
        </div>
      </div>
      <div className="mt-10 space-y-3">
        <div className="h-4 rounded-full bg-superficie" />
        <div className="h-4 w-5/6 rounded-full bg-superficie" />
        <div className="h-4 w-2/3 rounded-full bg-superficie" />
      </div>
    </div>
  );
}
