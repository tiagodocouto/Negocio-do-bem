import "@fontsource-variable/bricolage-grotesque/standard.css";
import "@fontsource-variable/figtree";
import "@fontsource-variable/figtree/wght-italic.css";
import "./globals.css";
import "./identidade.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Abertura } from "@/components/Abertura";
import { CortinaDePagina } from "@/components/cortina/CortinaDePagina";
import { AlternarTema } from "@/components/AlternarTema";
import { Logo } from "@/components/Logo";
import { MenuUsuario } from "@/components/MenuUsuario";
import { ProtecaoDoMenu } from "@/components/ProtecaoDoMenu";
import { MenuMobile } from "@/components/MenuMobile";
import { REPOSITORIO } from "@/lib/dominio";
import { DESCRICAO_DO_SITE, ENDERECO_DO_SITE, NOME_DO_SITE, TITULO_DO_SITE } from "@/lib/seo";
import { SCRIPT_TEMA } from "@/lib/tema";

// A imagem de compartilhamento vem de opengraph-image.tsx (o perfil de cada
// negócio tem a sua), e os ícones de icon.svg, favicon.ico e apple-icon.png.
export const metadata: Metadata = {
  metadataBase: new URL(ENDERECO_DO_SITE),
  title: {
    default: TITULO_DO_SITE,
    template: "%s · Negócio do Bem",
  },
  description: DESCRICAO_DO_SITE,
  applicationName: NOME_DO_SITE,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: NOME_DO_SITE,
  },
  twitter: { card: "summary_large_image" },
  // Códigos dos painéis do Google Search Console e do Bing Webmaster Tools.
  // Vazios, as meta tags não aparecem.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

// Cor da barra do navegador no celular: o papel do tema claro ou do escuro.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f3eb" },
    { media: "(prefers-color-scheme: dark)", color: "#17130f" },
  ],
};

// Só a produção do Vercel define o ID; no seu computador e em cópias do projeto
// o Analytics não carrega.
const ID_ANALYTICS = process.env.NEXT_PUBLIC_GA_ID;

const LINK_DO_TOPO =
  "rounded-full px-3 py-1.5 text-tinta/80 transition hover:bg-superficie hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta";
const LINK_DO_RODAPE =
  "underline decoration-transparent underline-offset-4 transition hover:decoration-current focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // O script do <head> troca o data-tema antes da primeira pintura; o
    // suppressHydrationWarning deixa o React aceitar essa diferença.
    <html lang="pt-BR" className="h-full" data-tema="claro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#conteudo" className="pular-conteudo" data-sem-cortina>Pular para o conteúdo</a>
        {/* Primeiro no <body>: o script da abertura roda antes da primeira pintura. Só age em "/". */}
        <Abertura />
        <Suspense fallback={null}><CortinaDePagina /></Suspense>

        <header className="sticky top-0 z-30 border-b border-linha bg-papel">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
            <Link
              href="/"
              className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta"
              aria-label="Negócio do Bem - início"
            >
              <Logo />
            </Link>
            <nav aria-label="Principal" className="hidden items-center gap-0.5 text-sm font-semibold sm:flex sm:gap-1.5 sm:text-[15px]">
              <Link href="/explorar" className={`hidden sm:block ${LINK_DO_TOPO}`}>
                Explorar
              </Link>
              <Link href="/sobre" className={`hidden sm:block ${LINK_DO_TOPO}`}>
                Como funciona
              </Link>
              <Link href="/indicar" className={`px-2 sm:px-3 ${LINK_DO_TOPO}`}>
                Indicar
              </Link>
              <AlternarTema />
              <Suspense fallback={<div className="ml-1 h-8 w-[4.25rem] rounded-full bg-linha/70" />}>
                <ProtecaoDoMenu>
                  <MenuUsuario />
                </ProtecaoDoMenu>
              </Suspense>
            </nav>
            <div className="flex items-center gap-2 sm:hidden">
              <Link href="/explorar" className="atalho-busca-mobile">Explorar</Link>
              <MenuMobile><Suspense fallback={<span role="status">Carregando conta…</span>}><ProtecaoDoMenu><MenuUsuario modo="painel" /></ProtecaoDoMenu></Suspense></MenuMobile>
            </div>
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className="flex-1">{children}</main>

        <footer className="mt-24 bg-verde-escuro text-sobre-verde-escuro">
          <div className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
            {/* Uma frase por linha: no celular, cada metade quebra sozinha e não sobra um "a" no fim. */}
            <p className="font-display text-[clamp(2.6rem,8vw,5.5rem)] leading-[0.9] font-extrabold uppercase">
              <span className="block text-balance">Feito pela comunidade,</span>
              <span className="block text-balance">para a comunidade.</span>
            </p>
            <div className="mt-12 grid grid-cols-1 gap-10 border-t border-sobre-verde-escuro/20 pt-10 text-[15px] sm:grid-cols-[2fr_1fr_1fr]">
              <div className="space-y-4">
                <Logo versao="creme" className="h-11" />
                <p className="max-w-sm leading-relaxed text-sobre-verde-escuro/85">
                  Um movimento independente para fortalecer negócios que cuidam das pessoas, da comunidade e do planeta.
                </p>
                <a href={REPOSITORIO} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 font-semibold ${LINK_DO_RODAPE}`}>
                  Código aberto no GitHub
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 11 11 5M6 5h5v5" />
                  </svg>
                  <span className="sr-only">(abre em outra aba)</span>
                </a>
              </div>
              <nav aria-label="Comunidade" className="space-y-2.5">
                <p className="font-display text-xl font-bold uppercase">Comunidade</p>
                <Link href="/explorar" className={`block w-fit ${LINK_DO_RODAPE}`}>Explorar negócios</Link>
                <Link href="/cidades" className={`block w-fit ${LINK_DO_RODAPE}`}>Negócios por cidade</Link>
                <Link href="/indicar" className={`block w-fit ${LINK_DO_RODAPE}`}>Indicar um negócio</Link>
              </nav>
              <nav aria-label="Para negócios" className="space-y-2.5">
                <p className="font-display text-xl font-bold uppercase">Para negócios</p>
                <Link href="/sobre#dono" className={`block w-fit ${LINK_DO_RODAPE}`}>Tenho um negócio</Link>
                <Link href="/sobre#privacidade" className={`block w-fit ${LINK_DO_RODAPE}`}>Privacidade e remoção</Link>
              </nav>
            </div>
          </div>
        </footer>
      </body>
      {ID_ANALYTICS && <GoogleAnalytics gaId={ID_ANALYTICS} />}
    </html>
  );
}
