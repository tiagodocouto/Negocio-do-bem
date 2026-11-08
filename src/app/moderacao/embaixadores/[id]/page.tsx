import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { atualizarEmbaixadorAgora, excluirEmbaixador, removerFotoDoEmbaixador, trocarFotoDoEmbaixador } from "@/acoes/embaixadores";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { FormFoto } from "@/components/FormFoto";
import { fotoDe } from "@/components/FotoEmpresa";
import { exigirModerador } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { formatarSeguidores, hrefDoEmbaixador, lugarDoEmbaixador } from "@/lib/embaixadores";
import { linkPerfil } from "@/lib/instagram";
import { lerId } from "@/lib/moderacao/filtros";
import { formatarDataHora, formatarMunicipio } from "@/lib/texto";
import { FormEmbaixador } from "../FormEmbaixador";

export const metadata: Metadata = { title: "Embaixador · Moderação", robots: { index: false } };

export default function EditarEmbaixador(props: PageProps<"/moderacao/embaixadores/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<div className="h-[40rem] animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/moderacao/embaixadores/[id]">, "params" | "searchParams">) {
  await exigirModerador();
  const id = lerId((await params).id);
  const embaixador = id && (await db.embaixador.findUnique({ where: { id } }));
  if (!embaixador) notFound();
  const { aviso } = await searchParams;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link href="/moderacao?aba=embaixadores" className="inline-block text-sm text-suave hover:text-tinta">
          ← Embaixadores
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Embaixador</p>
            <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">{embaixador.nome}</h1>
            <p className="text-suave">
              <a href={linkPerfil(embaixador.instagramUsername)} target="_blank" rel="noopener noreferrer" className="link">
                @{embaixador.instagramUsername} ↗
              </a>{" "}
              · {lugarDoEmbaixador(embaixador)} · {embaixador.ativo ? "no site" : "fora do site"}
            </p>
          </div>
          {embaixador.ativo ? (
            <Link href={hrefDoEmbaixador(embaixador.instagramUsername)} className="botao-claro botao-pequeno">
              Ver a página no site ↗
            </Link>
          ) : (
            <Link href="/embaixadores" className="botao-claro botao-pequeno">
              Ver /embaixadores ↗
            </Link>
          )}
        </div>
        <AvisoDaUrl codigo={aviso} />
      </div>

      <section className="cartao space-y-4 p-6 sm:p-8">
        <h2 className="font-serif text-2xl font-semibold">Foto</h2>
        <FormFoto
          empresa={fotoDe(embaixador)}
          voltar={`/moderacao/embaixadores/${embaixador.id}`}
          acoes={{ trocar: trocarFotoDoEmbaixador, remover: removerFotoDoEmbaixador, campo: "embaixadorId" }}
          ajuda="Sem foto, a foto do Instagram entra sozinha na próxima consulta. A que você enviar nunca é trocada."
        />
      </section>

      <section className="cartao space-y-4 p-6 sm:p-8">
        <h2 className="font-serif text-2xl font-semibold">Seguidores</h2>
        <p className="text-suave">
          {embaixador.seguidores === null ? (
            "Ainda sem número: o cartão aparece sem os seguidores."
          ) : (
            <>
              <strong className="text-tinta">{embaixador.seguidores.toLocaleString("pt-BR")}</strong> (no site:{" "}
              {formatarSeguidores(embaixador.seguidores)}),{" "}
              {embaixador.seguidoresManual
                ? "digitado à mão"
                : embaixador.seguidoresEm
                  ? `pelo Instagram em ${formatarDataHora(embaixador.seguidoresEm)}`
                  : "pelo Instagram"}
              .
            </>
          )}
          {!embaixador.seguidoresManual && embaixador.consultadoEm && ` Última consulta: ${formatarDataHora(embaixador.consultadoEm)}.`}
        </p>
        <p className="text-sm text-suave">
          O site consulta o Instagram uma vez por dia, quando alguém abre a página inicial, /embaixadores ou a página de um
          embaixador. O botão abaixo também traz a bio para o “Sobre”, se ele estiver vazio.
        </p>
        <form action={atualizarEmbaixadorAgora}>
          <input type="hidden" name="embaixadorId" value={embaixador.id} />
          <BotaoEnviar className="botao-claro botao-pequeno" enviando="Consultando…">
            Atualizar pelo Instagram agora
          </BotaoEnviar>
        </form>
      </section>

      <FormEmbaixador
        embaixador={{
          id: embaixador.id,
          instagram: embaixador.instagramUsername,
          nome: embaixador.nome,
          titulo: embaixador.titulo,
          sobre: embaixador.sobre ?? "",
          municipio: embaixador.cidade ? formatarMunicipio(embaixador.cidade, embaixador.uf) : "",
          uf: embaixador.uf,
          seguidoresManual: embaixador.seguidoresManual,
          seguidores: embaixador.seguidoresManual && embaixador.seguidores !== null ? String(embaixador.seguidores) : "",
          ordem: String(embaixador.ordem),
          naInicial: embaixador.naInicial,
          ativo: embaixador.ativo,
        }}
      />

      <section className="cartao flex flex-col gap-3 border-coral-100 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <p className="text-sm text-suave">
          Excluir apaga o cadastro e a foto. Para só tirar do site, desmarque “Aparece no site”.
        </p>
        <form action={excluirEmbaixador} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="embaixadorId" value={embaixador.id} />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="confirmar" required className="h-4 w-4 accent-coral" />
            Confirmo
          </label>
          <BotaoEnviar className="botao-claro botao-pequeno whitespace-nowrap text-coral-700" enviando="Excluindo…">
            Excluir embaixador
          </BotaoEnviar>
        </form>
      </section>
    </div>
  );
}
