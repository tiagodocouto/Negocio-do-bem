"use client";

import { useSyncExternalStore } from "react";
import { Aviso } from "@/components/Aviso";
import { abertoComoApp } from "@/lib/app";

const semMudancas = () => () => {};

/** Em /instalacao, para quem já está usando o app instalado. */
export function AvisoJaInstalado() {
  const instalado = useSyncExternalStore(semMudancas, abertoComoApp, () => false);
  if (!instalado) return null;

  return (
    <div className="mt-6">
      <Aviso tipo="sucesso">Você já está usando o app instalado. Não precisa fazer mais nada.</Aviso>
    </div>
  );
}
