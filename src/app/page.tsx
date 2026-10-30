import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { BuscaDiretorio } from "@/components/BuscaDiretorio";
import { Cortejo } from "@/components/cortejo/Cortejo";
import { personagensDoCortejo } from "@/components/cortejo/dados";
import { JsonLd } from "@/components/JsonLd";
import { FAIXAS_DE_CAUSAS } from "@/lib/cortejo";
import { CATEGORIAS } from "@/lib/dominio";
import { hrefDiretorio, hrefTipo, temPaginaDeTipo } from "@/lib/diretorio";
import { listarCidades, recentesComFoto, resumoDoDiretorio } from "@/lib/consultas";
import { DESCRICAO_DO_SITE, jsonLdDoSite, metadadosDaPagina } from "@/lib/seo";
import { CortejoInicial } from "./inicio/CortejoInicial";
import { EntradaAnimada, Laco, SeloDoConvite } from "./inicio/MovimentoInicio";
import "./inicio/inicio.css";

export const metadata: Metadata = metadadosDaPagina({ descricao: DESCRICAO_DO_SITE, caminho: "/" });

const TECNICAS = ["pintura", "xilogravura", "barro", "azulejo"];

export default function Inicio() {
  return (
    <div className="inicio-cortejo">
      <JsonLd dados={jsonLdDoSite()} />
      <section className="inicio-entrada" aria-labelledby="titulo-inicio">
        <EntradaAnimada>
          <div className="inicio-cartaz">
            <h1 id="titulo-inicio" className="inicio-titulo">
              <span>Compre de quem </span>
              <span>faz o bem.</span>
            </h1>
            <ul className="inicio-etiquetas" aria-label="Um movimento independente">
              <li>feito pela comunidade</li>
              <li>sem anúncio</li>
              <li>de graça</li>
            </ul>
          </div>

          <div className="inicio-palco">
            <Suspense fallback={<><p className="inicio-total" aria-hidden="true">&nbsp;</p><CortejoInicial /></>}>
              <CortejoComNegocios />
            </Suspense>
          </div>

          <div className="inicio-busca" id="encontrar">
            <Suspense fallback={<BuscaDiretorio cidades={[]} />}>
              <BuscaComCidades />
            </Suspense>
            <p>Gente e negócios que cuidam das pessoas, da comunidade e do planeta.</p>
          </div>
        </EntradaAnimada>
      </section>

      <Suspense fallback={<NegociosCarregando />}>
        <QuemFazOBem />
      </Suspense>

      <section className="inicio-descoberta" aria-labelledby="titulo-tipos">
        <h2 id="titulo-tipos">O que você procura?</h2>
        <p>Encontre seu próximo café, um serviço perto de casa ou um negócio para conhecer.</p>
        <nav aria-label="Todos os tipos de negócio" className="inicio-tipos">
          {CATEGORIAS.map(categoria => <Link key={categoria} href={temPaginaDeTipo(categoria) ? hrefTipo(categoria) : hrefDiretorio({ tipos: [categoria] })} rel={temPaginaDeTipo(categoria) ? undefined : "nofollow"}>{categoria}<span aria-hidden="true">↗</span></Link>)}
        </nav>
        <Link href="/cidades" className="link">Prefere encontrar pela cidade?</Link>
      </section>

      <section className="inicio-causas" aria-labelledby="titulo-causas">
        <div className="inicio-cabecalhoCausas">
          <h2 id="titulo-causas">O que a gente fortalece.</h2>
          <p>Cada escolha pode fazer diferença.</p>
        </div>
        {FAIXAS_DE_CAUSAS.map((faixa) => (
          <Laco key={faixa.grupo} className="inicio-faixa" tinta={faixa.tinta}>
            <div className="inicio-faixaMiolo">
              <h3>{faixa.nome}</h3>
              <div className="inicio-letreiro">
                <div className="inicio-letreiroTrilho">
                  <ul aria-label={faixa.nome}>
                    {faixa.causas.map((causa) => (
                      <li key={causa.slug}>
                        <Link href={causa.href}>{causa.nome}</Link>
                      </li>
                    ))}
                  </ul>
                  <ul aria-hidden="true" inert>
                    {faixa.causas.map((causa) => (
                      <li key={causa.slug}>
                        <span>{causa.nome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Laco>
        ))}
      </section>

      <Laco className="inicio-convite">
        <div>
          <h2>Seu negócio faz o bem?<br />Tem lugar pra ele aqui.</h2>
          <p>Conte sua história, mostre o que vocês vivem e encontre sua comunidade.</p>
          <Link href="/sobre#dono" className="inicio-botaoConvite">
            Quero fazer parte <Seta />
          </Link>
        </div>
        <SeloDoConvite />
      </Laco>
    </div>
  );
}

async function CortejoComNegocios() {
  const { porCategoria, total } = await resumoDoDiretorio();
  return <><p className="inicio-total"><Link href="/explorar"><strong>{total.toLocaleString("pt-BR")}</strong> {total === 1 ? "negócio para conhecer" : "negócios para conhecer"}<span aria-hidden="true"> ↗</span></Link></p><Cortejo personagens={personagensDoCortejo(porCategoria)} tecnicas={TECNICAS} /></>;
}

async function BuscaComCidades() {
  return <BuscaDiretorio cidades={await listarCidades()} />;
}

async function QuemFazOBem() {
  const negocios = await recentesComFoto(4);
  if (negocios.length === 0) return null;

  return (
    <section className="inicio-comunidade" aria-labelledby="titulo-comunidade">
      <div className="inicio-cabecalhoComunidade">
        <div>
          <h2 id="titulo-comunidade">Quem faz o bem.</h2>
          <p>Conheça quem já está nessa com a gente.</p>
        </div>
        <Link href="/explorar" className="inicio-linkEditorial">
          Ver todos os negócios <Seta />
        </Link>
      </div>
      <ul className="inicio-retratos" aria-label="Negócios da comunidade">
        {negocios.map((negocio) => (
          <li key={negocio.instagramUsername} style={{ "--tinta-negocio": `var(--color-${negocio.tinta})`, "--texto-negocio": `var(--color-${negocio.tinta}-texto)` } as CSSProperties}>
            <article>
              <Link href={`/empresas/${negocio.instagramUsername}`} className="inicio-retrato" aria-label={`Conhecer ${negocio.nome}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={negocio.fotoUrl} alt="" width={800} height={800} loading="lazy" />
              </Link>
              <p className="inicio-local">{negocio.cidade}, {negocio.uf}</p>
              <h3><Link href={`/empresas/${negocio.instagramUsername}`}>{negocio.nome}</Link></h3>
              {negocio.recomendacao ? (
                <blockquote className="inicio-bilhete">
                  <span>por que indiquei</span>
                  <p>{negocio.recomendacao.motivo}</p>
                  {negocio.recomendacao.indicadoPor && <cite>{negocio.recomendacao.indicadoPor}</cite>}
                </blockquote>
              ) : (
                <p className="inicio-resumo">{negocio.resumo}</p>
              )}
              <Link href={`/empresas/${negocio.instagramUsername}`} className="inicio-linkHistoria">
                Conhecer a história <Seta />
              </Link>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NegociosCarregando() {
  return (
    <div className="inicio-carregando" aria-busy="true" aria-label="Carregando os negócios da comunidade">
      <span /><span /><span /><span />
    </div>
  );
}

function Seta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h15M13 5l7 7-7 7" />
    </svg>
  );
}
