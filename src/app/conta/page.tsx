import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { sair } from "@/acoes/conta";
import { AlternarTema } from "@/components/AlternarTema";
import { ICONES_DE_LISTA, ItemDeLista } from "@/components/ItemDeLista";
import { usuarioAtual } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Conta", robots: FORA_DA_BUSCA };

export default function Conta() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-8 sm:px-6 sm:pt-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Conta</h1>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

async function Conteudo() {
  const usuario = await usuarioAtual();
  const negocios = usuario ? await db.empresaMembro.count({ where: { usuarioId: usuario.id } }) : 0;

  return (
    <div className="mt-6 space-y-5">
      {usuario ? (
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-coral-50 text-lg font-bold text-coral-700" aria-hidden="true">
            {usuario.nome[0]?.toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{usuario.nome}</p>
            <p className="truncate text-sm text-suave">{usuario.email}</p>
          </div>
        </div>
      ) : (
        <div className="cartao space-y-3 p-5">
          <p className="font-serif text-2xl leading-snug">Entre para favoritar, gerar cupons e cuidar do seu negócio</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/entrar?voltar=%2Fconta" className="botao-coral">
              Entrar
            </Link>
            <Link href="/participar" className="botao-claro">
              Cadastrar um negócio
            </Link>
          </div>
        </div>
      )}

      {usuario && (
        <ul className="cartao divide-y divide-linha overflow-hidden">
          {negocios > 0 && <ItemDeLista href="/negocio" icone={ICONES_DE_LISTA.loja} titulo="Negócio" detalhe={negocios === 1 ? "Painel do seu negócio" : `${negocios} negócios`} />}
          <ItemDeLista href="/painel" icone={ICONES_DE_LISTA.painel} titulo="Meu painel" detalhe="Negócios, indicações e senha" />
          <ItemDeLista href="/favoritos" icone={ICONES_DE_LISTA.coracao} titulo="Favoritos" />
          <ItemDeLista href="/cupons/meus" icone={ICONES_DE_LISTA.cupom} titulo="Meus cupons" />
          {usuario.moderador && <ItemDeLista href="/moderacao" icone={ICONES_DE_LISTA.escudo} titulo="Moderação" />}
        </ul>
      )}

      <ul className="cartao divide-y divide-linha overflow-hidden">
        <li className="flex items-center gap-3 px-4 py-3.5">
          <span className="text-coral-700" aria-hidden="true">
            {ICONES_DE_LISTA.lua}
          </span>
          <span className="flex-1 font-medium">Modo escuro</span>
          <AlternarTema />
        </li>
        <ItemDeLista href="/instalacao" icone={ICONES_DE_LISTA.baixar} titulo="Instalar o app" detalhe="Passo a passo para a tela de início" />
        <ItemDeLista href="/sobre" icone={ICONES_DE_LISTA.ajuda} titulo="Como funciona" />
        <ItemDeLista href="/clube-do-bem" icone={ICONES_DE_LISTA.cupom} titulo="Clube do Bem" />
      </ul>

      {usuario && (
        <form action={sair}>
          <button type="submit" className="botao-claro w-full py-3 text-suave">
            Sair
          </button>
        </form>
      )}
    </div>
  );
}
