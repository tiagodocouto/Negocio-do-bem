import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { denunciarDepoimento } from "@/acoes/depoimentos";
import { gerarCupomAcao } from "@/acoes/ofertas";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { BotaoCopiarLink } from "@/components/BotaoCopiarLink";
import { CapaDoNegocio } from "@/components/CapaDoNegocio";
import { CausaBadge } from "@/components/CausaBadge";
import { CoracaoFavorito, type EstadoFavorito } from "@/components/CoracaoFavorito";
import { ConfirmarEmail } from "@/components/ConfirmarEmail";
import { EmpresaLinha } from "@/components/EmpresaLinha";
import { Historia } from "@/components/Historia";
import { JsonLd } from "@/components/JsonLd";
import { FotoEmpresa } from "@/components/FotoEmpresa";
import { InstagramIcone, WhatsAppIcone } from "@/components/Icones";
import { LinkInstagram } from "@/components/LinkInstagram";
import { Prazo } from "@/components/Prazo";
import { SeloStatus } from "@/components/SeloStatus";
import { usuarioAtual, type UsuarioSessao } from "@/lib/auth/sessao";
import { buscarCausa, filtrarCausas, GRUPOS, type GrupoCausa } from "@/lib/causas";
import { db } from "@/lib/db";
import { buscarPerfil, coracoesDaLista, ehDono, negociosParecidos, podeVerPerfil } from "@/lib/consultas";
import { hrefCausa, hrefTipo, temPaginaDeTipo } from "@/lib/diretorio";
import { MODERACAO_EMPRESA } from "@/lib/dominio";
import { temInstagram } from "@/lib/endereco";
import { linkPerfil, normalizarEndereco } from "@/lib/instagram";
import { medirContato, type CanalDeContato } from "@/lib/medicao";
import { rotuloDoDesconto, rotuloOndeVale } from "@/lib/ofertas";
import { FORA_DA_BUSCA, jsonLdDoNegocio, metadadosDaPagina, paginaDaCidade } from "@/lib/seo";
import { formatarData, formatarFavoritos, formatarTelefone, tempoDeLeitura } from "@/lib/texto";
import { FormDepoimento } from "./FormDepoimento";
import { seguirEnderecoAntigo } from "@/lib/troca-de-arroba";

export async function generateMetadata(props: PageProps<"/empresas/[usuario]">): Promise<Metadata> {
  const username = normalizarEndereco((await props.params).usuario);
  const empresa = username ? await buscarPerfil(username) : null;
  if (!empresa || empresa.moderacao !== "aprovada" || empresa.oculta) return { title: "Perfil", robots: FORA_DA_BUSCA };
  // "Café da Ana — Café e padaria em Salvador, BA": o que as pessoas buscam é o tipo e a cidade.
  const onde = `${empresa.cidade}, ${empresa.uf}`;
  return metadadosDaPagina({
    titulo: empresa.categoria === "Outros" ? `${empresa.nome} em ${onde}` : `${empresa.nome} — ${empresa.categoria} em ${onde}`,
    descricao: empresa.resumo,
    caminho: `/empresas/${empresa.instagramUsername}`,
    imagemPropria: true,
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
  const username = normalizarEndereco((await params).usuario);
  if (!username) notFound();
  const [empresa, usuario, { aviso }] = await Promise.all([buscarPerfil(username), usuarioAtual(), searchParams]);
  if (!empresa) await seguirEnderecoAntigo(username, (atual) => `/empresas/${atual}`, true);
  if (!empresa || !podeVerPerfil(empresa, usuario)) notFound();

  const dono = ehDono(empresa, usuario);
  const causas = filtrarCausas(empresa.causas.map((c) => c.causa));
  const publico = empresa.moderacao === "aprovada" && !empresa.oculta;
  // Os cliques nos contatos contam no Analytics só quando vêm do público, não do dono.
  const contato = publico && !dono ? empresa : undefined;
  // Só um negócio do diretório pode ser favoritado, e o dono não favorita o próprio (sem coração).
  const coracao = publico
    ? (await coracoesDaLista(usuario, [empresa.id], `/empresas/${empresa.instagramUsername}`))(empresa.id)
    : undefined;
  // Parceiro do Clube do Bem: um dono liberado pela moderação, que ainda é dono.
  const parceiro = empresa.liberacoesClube.some((liberacao) => empresa.membros.some((m) => m.usuarioId === liberacao.usuarioId));
  // A hora atual só depois da sessão e dos parâmetros: o Cache Components não deixa antes.
  const oferta = publico && empresa.ofertas[0] && empresa.ofertas[0].fim > new Date() ? empresa.ofertas[0] : undefined;
  const meuCupom =
    oferta && usuario
      ? await db.cupom.findUnique({ where: { ofertaId_usuarioId: { ofertaId: oferta.id, usuarioId: usuario.id } }, select: { codigo: true } })
      : null;

  return (
    <article>
      {publico && <JsonLd dados={jsonLdDoNegocio(empresa, causas.map((slug) => buscarCausa(slug)!.nome))} />}
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <div className="mb-6 space-y-3 empty:hidden">
          <AvisoDaUrl codigo={aviso} />
          {!publico && (
            <p className="rounded-2xl border border-linha bg-superficie px-4 py-3 text-sm text-suave">
              {empresa.oculta
                ? "Este perfil está oculto pelo dono e não aparece no diretório."
                : `${MODERACAO_EMPRESA[empresa.moderacao]}: só você e a moderação veem este perfil por enquanto.`}
            </p>
          )}
        </div>

        <CapaDoNegocio cidade={empresa.cidade} uf={empresa.uf} />

        <header className="flex flex-col gap-5 px-1 sm:flex-row sm:items-start sm:px-6">
          {/* No celular a foto fica abaixo do crédito da capa; a partir do sm, sobre a capa, e o crédito vai para a direita. */}
          <div className="mt-4 shrink-0 self-start sm:-mt-12">
            <FotoEmpresa empresa={empresa} tamanho="lg" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SeloStatus status={empresa.status} verificado={parceiro} />
              {parceiro && (
                <span className="rounded-full bg-coral-50 px-2.5 py-1 text-xs font-semibold text-coral-700">Parceiro do Clube do Bem</span>
              )}
            </div>
            <h1 className="font-serif text-[clamp(1.75rem,5vw,2.625rem)] leading-[1.1] font-semibold tracking-tight text-balance">{empresa.nome}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-suave">
              {/* Sem WhatsApp, o botão principal já leva ao Instagram: não repete o link aqui. */}
              {(empresa.whatsapp || !temInstagram(empresa.instagramUsername)) && (
                <>
                  <LinkInstagram endereco={empresa.instagramUsername} icone contato={contato} />
                  <span aria-hidden="true">·</span>
                </>
              )}
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
            <Acoes empresa={empresa} medir={!!contato} compartilhar={publico} favorito={coracao} />
          </div>
        </header>

        <p className="mx-1 mt-8 max-w-[52ch] border-l-[3px] border-coral py-0.5 pl-4 font-serif text-[1.375rem] leading-snug font-medium text-tinta italic text-pretty sm:mx-6">{empresa.resumo}</p>

        {(dono || usuario?.moderador) && (
          <div className="mt-6 flex flex-wrap items-center gap-3 px-1 sm:px-6">
            {dono ? (
              <>
                <Link href={`/painel/${empresa.instagramUsername}`} className="botao">
                  Editar meu perfil
                </Link>
                {publico && empresa._count.favoritos > 0 && (
                  <span className="text-sm text-suave">{formatarFavoritos(empresa._count.favoritos)}</span>
                )}
              </>
            ) : (
              <Link href={`/moderacao/negocios/${empresa.instagramUsername}`} className="botao">
                Editar perfil (moderação)
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-x-12 gap-y-2 border-t border-linha px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="pt-8 lg:col-start-2 lg:row-start-1 lg:pt-12">
          <div className="space-y-4 lg:sticky lg:top-24">
            {oferta && (
              <OfertaDoClube
                empresa={empresa}
                oferta={oferta}
                logado={!!usuario}
                dono={dono}
                favorito={!!coracao?.favorito}
                meuCupom={meuCupom?.codigo}
              />
            )}
            <CartaoDeContato empresa={empresa} medir={!!contato} lugarComLink={publico} />
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <section className="py-10 lg:py-12">
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

          <Causas causas={causas} link={publico} />

          {empresa.status !== "verificada" && !dono && (
            <div className="border-t border-linha pt-10">
              <ChamadaReivindicar username={empresa.instagramUsername} />
            </div>
          )}

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
      </div>

      {publico && (
        <Suspense fallback={null}>
          <Parecidos empresa={empresa} />
        </Suspense>
      )}
    </article>
  );
}

/**
 * O que a pessoa pode fazer logo no topo: o contato principal, favoritar (com quantas pessoas
 * já favoritaram) e compartilhar. Sem `favorito`, não há coração: o dono não favorita o próprio.
 */
function Acoes({
  empresa,
  medir,
  compartilhar,
  favorito,
}: {
  empresa: Perfil;
  medir: boolean;
  compartilhar: boolean;
  favorito?: EstadoFavorito;
}) {
  const instagram = temInstagram(empresa.instagramUsername);
  const medida = (canal: CanalDeContato) => (medir ? medirContato(canal, empresa) : {});
  if (!empresa.whatsapp && !instagram && !compartilhar && !favorito) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-3">
      {empresa.whatsapp ? (
        <a
          href={`https://wa.me/${empresa.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="botao-coral px-5 py-2.5"
          {...medida("whatsapp")}
        >
          <WhatsAppIcone />
          Chamar no WhatsApp
        </a>
      ) : (
        instagram && (
          <a
            href={linkPerfil(empresa.instagramUsername)}
            target="_blank"
            rel="noopener noreferrer"
            className="botao-coral px-5 py-2.5"
            {...medida("instagram")}
          >
            <InstagramIcone />
            Ver no Instagram
          </a>
        )
      )}
      {compartilhar && (
        <BotaoCopiarLink caminho={`/empresas/${empresa.instagramUsername}`} className="botao-claro px-5 py-2.5">
          Compartilhar
        </BotaoCopiarLink>
      )}
      {favorito && <CoracaoFavorito estado={favorito} nome={empresa.nome} comTexto total={empresa._count.favoritos} />}
    </div>
  );
}

/**
 * A oferta do Clube do Bem que está valendo, na coluna do lado. Quem favoritou gera o cupom
 * com um toque; quem não favoritou, gera e favorita junto. O cupom aparece aqui mesmo.
 */
function OfertaDoClube({
  empresa,
  oferta,
  logado,
  dono,
  favorito,
  meuCupom,
}: {
  empresa: Perfil;
  oferta: Perfil["ofertas"][number];
  logado: boolean;
  dono: boolean;
  favorito: boolean;
  meuCupom?: string;
}) {
  const restam = oferta.limite === null ? null : Math.max(0, oferta.limite - oferta.cuponsGerados);
  const perfil = `/empresas/${empresa.instagramUsername}`;
  return (
    <div id="clube" className="cartao scroll-mt-24 space-y-3 border-coral/40 p-5">
      <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">🎟️ Clube do Bem</p>
      <div>
        <p className="font-serif text-xl leading-snug font-semibold">{oferta.titulo}</p>
        <p className="mt-1 text-sm text-suave">
          {rotuloDoDesconto(oferta)} · {rotuloOndeVale(oferta.ondeVale)}
        </p>
      </div>
      {oferta.condicoes && <p className="text-sm">{oferta.condicoes}</p>}
      <p className="text-sm font-medium text-coral-700">
        <Prazo fim={oferta.fim.toISOString()} />
        {restam !== null && ` · ${restam === 1 ? "resta 1 cupom" : `restam ${restam} cupons`}`}
      </p>
      {meuCupom ? (
        <div className="rounded-2xl bg-papel p-4">
          <p className="text-xs text-suave">Seu cupom</p>
          <p className="font-mono text-3xl tracking-[0.2em]">{meuCupom}</p>
          <p className="mt-1 text-sm text-suave">
            Mostre na hora da compra. Ele também fica em{" "}
            <Link href="/cupons/meus" className="link">
              Meus cupons
            </Link>
            .
          </p>
        </div>
      ) : dono ? (
        <p className="text-sm text-suave">
          É a oferta do seu negócio. Valide os cupons no{" "}
          <Link href={`/painel/${empresa.instagramUsername}/clube`} className="link">
            painel do clube
          </Link>
          .
        </p>
      ) : restam === 0 ? (
        <p className="text-sm text-suave">Os cupons desta oferta acabaram.</p>
      ) : !logado ? (
        <Link href={`/entrar?voltar=${encodeURIComponent(`${perfil}#clube`)}`} className="botao-coral w-full">
          Entre para gerar o cupom
        </Link>
      ) : (
        <form action={gerarCupomAcao} className="space-y-2">
          <input type="hidden" name="ofertaId" value={oferta.id} />
          <BotaoEnviar className="botao-coral w-full" enviando="Gerando…">
            {favorito ? "Gerar cupom" : "Favoritar e gerar cupom"}
          </BotaoEnviar>
          {!favorito && <p className="text-xs text-suave">Ao gerar o cupom, {empresa.nome} entra nos seus favoritos.</p>}
        </form>
      )}
      <p className="text-xs leading-relaxed text-suave">
        O Negócio do Bem nunca pede Pix nem pagamento para liberar cupom. O desconto vale na hora da compra, e quem garante é o
        negócio.{" "}
        <Link href="/clube-do-bem" className="link">
          Como funciona
        </Link>
      </p>
    </div>
  );
}

/**
 * Todos os contatos do negócio, só os preenchidos. WhatsApp, Instagram e site abrem numa aba nova, para a
 * pessoa não sair do site. Com `medir`, cada clique vira o evento `contato_negocio` no Analytics.
 */
function CartaoDeContato({ empresa, medir, lugarComLink }: { empresa: Perfil; medir: boolean; lugarComLink: boolean }) {
  const instagram = temInstagram(empresa.instagramUsername);
  const medida = (canal: CanalDeContato) => (medir ? medirContato(canal, empresa) : {});
  const linha = "block rounded-xl px-3 py-2 transition hover:bg-papel";
  const rotulo = "block text-xs text-suave";
  const onde = `${empresa.cidade}, ${empresa.uf}`;
  return (
    <div className="cartao p-3">
      <h2 className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.2em] text-suave uppercase">Contato</h2>
      <ul className="text-sm">
        {empresa.telefoneComercial && (
          <li>
            <a href={`tel:+${empresa.telefoneComercial}`} className={linha} {...medida("telefone")}>
              <span className={rotulo}>Telefone</span>
              <span className="font-medium">{formatarTelefone(empresa.telefoneComercial)}</span>
            </a>
          </li>
        )}
        {empresa.whatsapp && (
          <li>
            <a href={`https://wa.me/${empresa.whatsapp}`} target="_blank" rel="noopener noreferrer" className={linha} {...medida("whatsapp")}>
              <span className={rotulo}>WhatsApp</span>
              <span className="font-medium">{formatarTelefone(empresa.whatsapp)}</span>
            </a>
          </li>
        )}
        {instagram && (
          <li>
            <a href={linkPerfil(empresa.instagramUsername)} target="_blank" rel="noopener noreferrer" className={linha} {...medida("instagram")}>
              <span className={rotulo}>Instagram</span>
              <span className="font-medium">@{empresa.instagramUsername}</span>
            </a>
          </li>
        )}
        {empresa.site && (
          <li>
            <a href={empresa.site} target="_blank" rel="noopener noreferrer nofollow" className={linha} {...medida("site")}>
              <span className={rotulo}>Site</span>
              <span className="font-medium break-all">{new URL(empresa.site).hostname.replace(/^www\./, "")} ↗</span>
            </a>
          </li>
        )}
        {empresa.emailContato && (
          <li>
            {/* break-all: um e-mail comprido quebra em vez de passar da largura do celular. */}
            <a href={`mailto:${empresa.emailContato}`} className={linha} {...medida("email")}>
              <span className={rotulo}>E-mail</span>
              <span className="font-medium break-all">{empresa.emailContato}</span>
            </a>
          </li>
        )}
        <li>
          {lugarComLink ? (
            <Link href={paginaDaCidade(empresa.cidade, empresa.uf).caminho} className={linha}>
              <span className={rotulo}>Cidade</span>
              <span className="font-medium">{onde}</span>
            </Link>
          ) : (
            <span className={linha}>
              <span className={rotulo}>Cidade</span>
              <span className="font-medium">{onde}</span>
            </span>
          )}
        </li>
      </ul>
    </div>
  );
}

/** As causas do negócio, separadas pelos mesmos grupos do filtro do diretório. */
function Causas({ causas, link }: { causas: string[]; link: boolean }) {
  if (causas.length === 0) return null;
  const grupos = (Object.keys(GRUPOS) as GrupoCausa[])
    .map((grupo) => ({ grupo, slugs: causas.filter((slug) => buscarCausa(slug)?.grupo === grupo) }))
    .filter((g) => g.slugs.length > 0);
  return (
    <section className="border-t border-linha py-10 lg:py-12">
      <h2 className="font-serif text-3xl font-semibold">O que este negócio defende</h2>
      {link && <p className="mt-1 text-suave">Toque em uma causa para ver outros negócios que também a defendem.</p>}
      <div className="mt-6 space-y-5">
        {grupos.map(({ grupo, slugs }) => (
          <div key={grupo}>
            <h3 className="mb-2 text-xs font-semibold tracking-[0.2em] text-suave uppercase">{GRUPOS[grupo]}</h3>
            <div className="flex flex-wrap gap-2">
              {slugs.map((slug) =>
                link ? (
                  <Link key={slug} href={hrefCausa(slug)} className="transition hover:opacity-80">
                    <CausaBadge slug={slug} grande />
                  </Link>
                ) : (
                  <CausaBadge key={slug} slug={slug} grande />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
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
    <section id="depoimentos" className="scroll-mt-24 border-t border-linha py-10 lg:py-12">
      <h2 className="font-serif text-3xl font-semibold">Depoimentos da comunidade</h2>
      <p className="mt-1 text-suave">Experiências reais de quem conhece este negócio.</p>

      <div className="mt-8 space-y-4">
        {empresa.depoimentos.length === 0 && (
          <p className="text-suave italic">
            {dono ? "Ainda não há depoimentos. Peça para quem conhece o seu negócio escrever o primeiro." : "Ainda não há depoimentos. Que tal ser a primeira pessoa?"}
          </p>
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

      {dono && publico && (
        <div className="cartao mt-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-suave">Mande este link para clientes e vizinhos pedirem para escrever um depoimento.</p>
          <BotaoCopiarLink caminho={`/empresas/${empresa.instagramUsername}#depoimentos`} className="botao-claro botao-pequeno shrink-0">
            Copiar link dos depoimentos
          </BotaoCopiarLink>
        </div>
      )}

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
    </section>
  );
}

/** Outros negócios da mesma cidade, para a pessoa continuar explorando. */
async function Parecidos({ empresa }: { empresa: Perfil }) {
  const parecidos = await negociosParecidos(empresa);
  if (parecidos.length === 0) return null;
  const cidade = paginaDaCidade(empresa.cidade, empresa.uf);
  return (
    <section className="border-t border-linha bg-superficie/50 py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="font-serif text-3xl font-semibold">Mais negócios do bem em {empresa.cidade}</h2>
        <div className="mt-6 space-y-3">
          {parecidos.map((outro) => (
            <EmpresaLinha key={outro.instagramUsername} empresa={outro} />
          ))}
        </div>
        <p className="mt-6">
          <Link href={cidade.caminho} className="link">
            Ver todos em {empresa.cidade}, {empresa.uf}
          </Link>
        </p>
      </div>
    </section>
  );
}

function PerfilCarregando() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 pt-6 sm:px-6" aria-busy="true">
      <div className="h-48 rounded-3xl bg-superficie sm:h-64" />
      <div className="flex items-center gap-6 px-6">
        <div className="-mt-12 h-24 w-24 rounded-full bg-superficie ring-4 ring-papel" />
        <div className="h-10 w-1/2 rounded-full bg-superficie" />
      </div>
      <div className="mt-10 space-y-3 px-6">
        <div className="h-4 rounded-full bg-superficie" />
        <div className="h-4 w-5/6 rounded-full bg-superficie" />
        <div className="h-4 w-2/3 rounded-full bg-superficie" />
      </div>
    </div>
  );
}
