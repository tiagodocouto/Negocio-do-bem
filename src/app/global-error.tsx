"use client";

import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader";
import "./globals.css";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SCRIPT_TEMA } from "@/lib/tema";

// Último recurso, para quando o próprio layout falha: substitui a página inteira,
// sem o cabeçalho e o rodapé. Por isso traz o <html>, as fontes, o CSS e o tema.
// Não consulta o banco.
export default function ErroGeral({ error, retry }: { error: unknown; retry: () => void }) {
  const codigo = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <html lang="pt-BR" className="h-full" data-tema="claro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        <title>Negócio do Bem</title>
      </head>
      <body className="flex min-h-full flex-col items-center px-4 pt-24 text-center">
        <Link href="/" aria-label="Negócio do Bem — início">
          <Logo className="h-12" />
        </Link>
        <h1 className="mt-10 font-serif text-3xl font-semibold">O site não abriu agora</h1>
        <p className="mt-2 max-w-md text-suave">Tivemos um problema do nosso lado. Tente de novo daqui a pouco.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="botao">
            Tentar de novo
          </button>
          <Link href="/" className="botao-claro">
            Voltar para o início
          </Link>
        </div>
        {codigo && <p className="mt-6 text-xs text-suave">Código do erro: {codigo}</p>}
      </body>
    </html>
  );
}
