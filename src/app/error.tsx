"use client";

import Link from "next/link";

// Fica no lugar da página quando algo falha no servidor, como o banco fora do ar.
// O cabeçalho e o rodapé continuam na tela, para a pessoa seguir para as páginas
// que não dependem do banco. Não consulta o banco.
export default function Erro({ error, retry }: { error: unknown; retry: () => void }) {
  // Em produção o Next esconde a mensagem e manda só o digest, que acha o erro nos logs do Vercel.
  const codigo = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <div className="mx-auto max-w-xl px-4 pt-24 text-center sm:px-6">
      <p className="font-serif text-7xl text-coral">Ops</p>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Esta página não abriu agora</h1>
      <p className="mt-2 text-suave">Tivemos um problema do nosso lado. Tente de novo daqui a pouco.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="botao">
          Tentar de novo
        </button>
        <Link href="/" className="botao-claro">
          Voltar para o início
        </Link>
      </div>
      {codigo && <p className="mt-6 text-xs text-suave">Código do erro: {codigo}</p>}
    </div>
  );
}
