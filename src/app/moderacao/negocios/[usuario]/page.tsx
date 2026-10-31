import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EdicaoEmpresa } from "@/app/painel/[usuario]/EdicaoEmpresa";
import { Aviso } from "@/components/Aviso";
import { AvisoDaUrl } from "@/components/Avisos";
import { exigirModerador } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { MODERACAO_EMPRESA } from "@/lib/dominio";
import { rotuloDoInstagram } from "@/lib/endereco";
import { normalizarEndereco } from "@/lib/instagram";

export const metadata: Metadata = { title: "Editar perfil · Moderação", robots: { index: false } };

export default function EditarPelaModeracao(props: PageProps<"/moderacao/negocios/[usuario]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<div className="h-[40rem] animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/moderacao/negocios/[usuario]">, "params" | "searchParams">) {
  await exigirModerador();
  const username = normalizarEndereco((await params).usuario);
  if (!username) notFound();
  const empresa = await db.empresa.findUnique({
    where: { instagramUsername: username },
    include: { causas: { select: { causa: true } }, _count: { select: { membros: true } } },
  });
  if (!empresa) notFound();
  const { aviso } = await searchParams;
  const temDono = empresa._count.membros > 0;

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <Link href="/moderacao?aba=negocios" className="text-sm text-suave hover:text-tinta">
          ← Negócios
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Edição pela moderação</p>
            <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">{empresa.nome}</h1>
            <p className="text-suave">
              {rotuloDoInstagram(empresa.instagramUsername)} · {MODERACAO_EMPRESA[empresa.moderacao]} · {temDono ? "tem dono" : "sem dono"}
              {empresa.oculta && " · oculto pelo dono"}
            </p>
          </div>
          <Link href={`/empresas/${empresa.instagramUsername}`} className="botao-claro botao-pequeno">
            Ver perfil público ↗
          </Link>
        </div>
        <Aviso tipo="info">
          Você está editando como moderação. {temDono && "Este negócio tem dono, então mude só o necessário. "}Cada
          alteração fica registrada na auditoria.
        </Aviso>
        <AvisoDaUrl codigo={aviso} />
      </div>

      <EdicaoEmpresa empresa={empresa} voltar={`/moderacao/negocios/${empresa.instagramUsername}`} />
    </div>
  );
}
