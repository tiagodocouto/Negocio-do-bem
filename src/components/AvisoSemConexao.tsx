"use client";

import { useOffline } from "next/offline";

/**
 * Aviso no pé da tela enquanto o aparelho está sem internet. Com o
 * experimental.useOffline do next.config, o que a pessoa pediu (abrir uma
 * página, enviar um formulário) fica esperando e segue sozinho quando a
 * conexão volta.
 */
export function AvisoSemConexao() {
  const semConexao = useOffline();

  // A região fica sempre na página, para o leitor de tela anunciar quando o texto aparece.
  return (
    <div role="status" className="pointer-events-none fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md">
      {semConexao && (
        <p className="rounded-2xl bg-tinta px-4 py-3 text-center text-sm text-papel shadow-lg">
          Sem conexão. O que você pediu continua assim que a internet voltar.
        </p>
      )}
    </div>
  );
}
