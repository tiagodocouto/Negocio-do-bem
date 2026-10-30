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
import "./perfil.css";
import "./perfil-editorial.css";

export async function generateMetadata(props: PageProps<"/empresas/[usuario]">): Promise<Metadata> {
  const username = normalizarUsername((await props.params).usuario);
  const empresa = username ? await buscarPerfil(username) : null;
  if (!empresa || empresa.moderacao !== "aprovada" || empresa.oculta) return { title: "Perfil", robots: FORA_DA_BUSCA };
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
    <article className={`perfil-editorial perfil-detalhado`}>
      {publico && <JsonLd dados={jsonLdDoNegocio(empresa, causas.map((slug) => buscarCausa(slug)!.nome))} />}
      <header className="perfil-cabecalho">
        <div className="container-editorial">
          <Link href="/explorar" className="perfil-voltar">← Explorar negócios</Link>
          <div className="perfil-avisos">
            <AvisoDaUrl codigo={aviso} />
            {!publico && <p className="cartao p-4 text-sm text-suave">{empresa.oculta
              ? "Este perfil está oculto pelo dono e não aparece no diretório."
              : `${MODERACAO_EMPRESA[empresa.moderacao]}: só você e a moderação veem este perfil por enquanto.`}</p>}
          </div>
          <div className="perfil-apresentacao">
            <div className="perfil-identidade">
              <SeloStatus status={empresa.status} />
              <h1>{empresa.nome}</h1>
              <a href={linkPerfil(empresa.instagramUsername)} target="_blank" rel="noopener noreferrer" className="perfil-instagram">@{empresa.instagramUsername} <span aria-hidden="true">↗</span></a>
              <div className="perfil-localizacao">
                {publico && temPaginaDeTipo(empresa.categoria)
                  ? <Link href={hrefTipo(empresa.categoria)}>{empresa.categoria}</Link>
                  : <span>{empresa.categoria}</span>}
                <span aria-hidden="true">·</span>
                {publico
                  ? <Link href={paginaDaCidade(empresa.cidade, empresa.uf).caminho}>{empresa.cidade}, {empresa.uf}</Link>
                  : <span>{empresa.cidade}, {empresa.uf}</span>}
              </div>
              <p className="perfil-resumo">{empresa.resumo}</p>
              <div className="perfil-acoes">
                <a href="#historia" className="botao-claro">Conheça a história <span aria-hidden="true">↓</span></a>
                {dono ? <Link href={`/painel/${empresa.instagramUsername}`} className="link">Editar meu perfil</Link>
                  : usuario?.moderador && <Link href={`/moderacao/negocios/${empresa.instagramUsername}`} className="link">Editar perfil (moderação)</Link>}
              </div>
            </div>
            <div className="perfil-fotografia"><FotoEmpresa empresa={empresa} tamanho="lg" /></div>
          </div>
        </div>
      </header>
      <div className="container-editorial">
        <nav className="perfil-atalhos" aria-label="Seções do negócio">
          <a href="#historia">História</a>
          {causas.length > 0 && <a href="#causas">Causas <span>{causas.length}</span></a>}
          <a href="#depoimentos">Depoimentos <span>{empresa.depoimentos.length}</span></a>
          <a href="#contatos">Contatos</a>
        </nav>
        <div className="perfil-conteudo">
          <section id="historia" className="perfil-historia" aria-labelledby="titulo-historia">
            <div className="perfil-titulo-secao">
              <h2 id="titulo-historia">A história de quem faz.</h2>
              {empresa.historia.trim() && <p>{tempoDeLeitura(empresa.historia)} min de leitura · atualizada em {formatarData(empresa.atualizadoEm)}</p>}
            </div>
            {empresa.historia.trim() ? <Historia markdown={empresa.historia} /> : <SemHistoria empresa={empresa} dono={dono} />}
          </section>
          <aside className="perfil-lateral" aria-label="Informações do negócio">
            <Contatos empresa={empresa} />
            {causas.length > 0 && <section id="causas" className="perfil-painel" aria-labelledby="titulo-causas">
              <h2 id="titulo-causas">Causas que fazem parte.</h2>
              <ul className="perfil-lista-causas">{causas.map(slug => {
                const causa = buscarCausa(slug)!;
                return <li key={slug}>{publico
                  ? <Link href={hrefCausa(slug)}><CausaBadge slug={slug} grande /><span className="perfil-causa-descricao">{causa.descricao}</span></Link>
                  : <><CausaBadge slug={slug} grande /><span className="perfil-causa-descricao">{causa.descricao}</span></>}
                </li>;
              })}</ul>
              <p className="perfil-nota">Causas declaradas por quem indica ou cuida do negócio. Não representam certificação independente.</p>
            </section>}
          </aside>
        </div>
        <div className="perfil-comunidade">
          {empresa.status !== "verificada" && !dono && <ChamadaReivindicar username={empresa.instagramUsername} />}
          <Depoimentos empresa={empresa} usuario={usuario} dono={dono} publico={publico} />
          {empresa.status === "verificada" && !dono && <p className="mt-10 text-sm text-suave">Este perfil é seu e outra pessoa assumiu? <Link href={`/empresas/${empresa.instagramUsername}/reivindicar`} className="link">Fale com a moderação</Link></p>}
        </div>
      </div>
    </article>
  );
}


function Contatos({ empresa }: { empresa: Perfil }) {
  return (
    <section id="contatos" className="perfil-painel perfil-contatos" aria-labelledby="titulo-contatos">
      <h2 id="titulo-contatos">Fale com o negócio.</h2>
      <p>Consulte horários, serviços e outras informações diretamente com quem cuida do negócio.</p>
      <div className="perfil-contatos-links">
      {empresa.whatsapp && (
        <a href={`https://wa.me/${empresa.whatsapp}`} target="_blank" rel="noopener noreferrer" className="botao botao-pequeno">
          <span>Conversar pelo WhatsApp<small>{formatarWhatsapp(empresa.whatsapp)}</small></span><span aria-hidden="true">↗</span>
        </a>
      )}
      <a href={linkPerfil(empresa.instagramUsername)} target="_blank" rel="noopener noreferrer" className="botao-claro">
        <span>Instagram<small>@{empresa.instagramUsername}</small></span><span aria-hidden="true">↗</span>
      </a>
      {empresa.site && (
        <a href={empresa.site} target="_blank" rel="noopener noreferrer nofollow" className="botao-claro botao-pequeno">
          <span>Visitar site<small>{new URL(empresa.site).hostname.replace(/^www\./, "")}</small></span><span aria-hidden="true">↗</span>
        </a>
      )}
      {empresa.emailContato && (
        // break-all: um e-mail comprido quebra em vez de passar da largura do celular.
        <a href={`mailto:${empresa.emailContato}`} className="botao-claro botao-pequeno max-w-full break-all">
          <span>Enviar e-mail<small>{empresa.emailContato}</small></span><span aria-hidden="true">↗</span>
        </a>
      )}
      </div>
    </section>
  );
}

function SemHistoria({ empresa, dono }: { empresa: Perfil; dono: boolean }) {
  if (dono) return (
    <div className={"cortejo-perfil-conviteHistoria"}>
      <h2>Conte a história do seu negócio</h2>
      <p>Como tudo começou, o que move vocês, quem faz acontecer. É aqui que a comunidade conhece vocês de verdade.</p>
      <Link href={`/painel/${empresa.instagramUsername}`} className="botao-coral">Escrever nossa história</Link>
    </div>
  );
  if (empresa.motivoIndicacao) return (
    <figure className={"cortejo-perfil-bilhete"}>
      <h2>Por que foi indicado</h2>
      <blockquote>“{empresa.motivoIndicacao}”</blockquote>
      {empresa.indicadaPor && <figcaption>Indicado por {empresa.indicadaPor.nome}</figcaption>}
    </figure>
  );
  return <p className={"cortejo-perfil-semHistoria"}>A história deste negócio ainda vai ser contada.</p>;
}

function ChamadaReivindicar({ username }: { username: string }) {
  return (
    <aside className={"cortejo-perfil-assumir"}>
      <div>
        <p>Este negócio é seu?</p>
        <p>Assuma o perfil para contar a sua história, escolher suas causas e responder à comunidade.</p>
      </div>
      <Link href={`/empresas/${username}/reivindicar`} className="botao-coral">É meu negócio</Link>
    </aside>
  );
}

function Depoimentos({ empresa, usuario, dono, publico }: { empresa: Perfil; usuario: UsuarioSessao | null; dono: boolean; publico: boolean }) {
  const jaEscreveu = !!usuario && empresa.depoimentos.some((d) => d.autorId === usuario.id);
  return (
    <section id="depoimentos" className={"cortejo-perfil-depoimentos"}>
      <h2>Depoimentos da comunidade</h2>
      <p>Experiências reais de quem conhece este negócio.</p>
      {publico && !dono && !jaEscreveu && (
        <div className={"cortejo-perfil-formularioDepoimento"}>
          {usuario?.emailConfirmado ? (
            <FormDepoimento empresaId={empresa.id} nomeEmpresa={empresa.nome} />
          ) : usuario ? (
            <ConfirmarEmail
              email={usuario.email}
              para="deixar seu depoimento"
              voltar={`/empresas/${empresa.instagramUsername}#depoimentos`}
            />
          ) : (
            <div className={"cortejo-perfil-entrar"}>
              <Link href={`/entrar?voltar=${encodeURIComponent(`/empresas/${empresa.instagramUsername}#depoimentos`)}`} className="botao-claro">Entrar para deixar um depoimento</Link>
              <p>Sua experiência ajuda outras pessoas a conhecer este negócio.</p>
            </div>
          )}
        </div>
      )}
      <div className={"cortejo-perfil-listaDepoimentos"}>
        {empresa.depoimentos.length === 0 && <p className="text-suave italic">Ainda não há depoimentos. Que tal ser a primeira pessoa?</p>}
        {empresa.depoimentos.map((depoimento) => (
          <figure key={depoimento.id} className={"cortejo-perfil-depoimento"}>
            <blockquote>{depoimento.texto}</blockquote>
            <figcaption>
              <span><strong>{depoimento.autor.nome}</strong> · <time dateTime={depoimento.criadoEm.toISOString()}>{formatarData(depoimento.criadoEm)}</time></span>
              {usuario && usuario.id !== depoimento.autorId && !depoimento.denunciado && (
                <details className={"cortejo-perfil-denuncia"}>
                  <summary>Denunciar</summary>
                  <form action={denunciarDepoimento}>
                    <input type="hidden" name="depoimentoId" value={depoimento.id} />
                    <input name="motivo" aria-label="Motivo da denúncia" placeholder="O que há de errado?" className="campo" maxLength={300} />
                    <button type="submit" className="botao-claro botao-pequeno">Enviar</button>
                  </form>
                </details>
              )}
            </figcaption>
            {depoimento.resposta && (
              <div className={"cortejo-perfil-resposta"}>
                <p>Resposta de {empresa.nome}</p>
                <p>{depoimento.resposta}</p>
              </div>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

function PerfilCarregando() {
  return <div className={`cortejo-perfil-conteudo cortejo-perfil-carregando`} aria-busy="true" aria-label="Carregando perfil"><div /></div>;
}
