"use client";

import { catchError } from "next/error";
import { BarraInferior } from "@/components/BarraInferior";

// Como o menu do topo, a barra fica no layout, fora do alcance do app/error.tsx: se a leitura
// da sessão ou do banco falhar, ela aparece na versão de quem compra, em vez de derrubar a página.
function BarraSemDados() {
  return <BarraInferior perfil={{ tipo: "comprador", ofertas: 0 }} />;
}

export const ProtecaoDaBarra = catchError(BarraSemDados);
