"use client";

import { catchError } from "next/error";
import Link from "next/link";

// O menu da conta lê a sessão no banco e fica no layout, fora do alcance do
// app/error.tsx. Se a leitura falhar, o cabeçalho mostra o "Entrar" em vez de
// derrubar o layout inteiro.
function SemMenu() {
  return (
    <Link href="/entrar" className="botao botao-pequeno sm:ml-1">
      Entrar
    </Link>
  );
}

export const ProtecaoDoMenu = catchError(SemMenu);
