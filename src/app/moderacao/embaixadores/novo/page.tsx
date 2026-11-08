import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigirModerador } from "@/lib/auth/sessao";
import { FormEmbaixador } from "../FormEmbaixador";

export const metadata: Metadata = { title: "Novo embaixador · Moderação", robots: { index: false } };

export default function NovoEmbaixador() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<div className="h-[36rem] animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirModerador();
  return (
    <div className="space-y-6">
      <Link href="/moderacao?aba=embaixadores" className="inline-block text-sm text-suave hover:text-tinta">
        ← Embaixadores
      </Link>
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Moderação</p>
        <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Novo embaixador</h1>
        <p className="mt-2 text-suave">Ao cadastrar, o site já busca a foto, os seguidores e a bio no Instagram.</p>
      </div>
      <FormEmbaixador
        embaixador={{
          instagram: "",
          nome: "",
          titulo: "embaixadora",
          sobre: "",
          municipio: "",
          uf: "",
          seguidoresManual: false,
          seguidores: "",
          ordem: "0",
          naInicial: true,
          ativo: true,
        }}
      />
    </div>
  );
}
