"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Aviso } from "@/components/Aviso";
import { abertoComoApp, ehAparelhoApple } from "@/lib/app";

const semMudancas = () => () => {};

function noAppDoIphone() {
  return abertoComoApp() && ehAparelhoApple();
}

/**
 * Só no app instalado no iPhone ou iPad: o link do e-mail abre no Safari, e o
 * Safari não divide o login com o app. No Android, o app divide o login com o Chrome.
 */
export function AvisoLinkNoIphone({ children }: { children: ReactNode }) {
  const mostrar = useSyncExternalStore(semMudancas, noAppDoIphone, () => false);
  return mostrar ? <Aviso>{children}</Aviso> : null;
}
