import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AbasCupons } from "@/components/AbasCupons";
import { AvisoDaUrl } from "@/components/Avisos";
import { Prazo } from "@/components/Prazo";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { condicaoDeOfertaPublica, rotuloDoDesconto, rotuloOndeVale, situacaoDoCupom, type SituacaoCupom } from "@/lib/ofertas";
import { FORA_DA_BUSCA } from "@/lib/seo";
import { formatarDataCurta } from "@/lib/texto";

export const metadata: Metadata = { title: "Meus cupons", robots: FORA_DA_BUSCA };

export default function MeusCupons(props: PageProps<"/cupons/meus">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Cupons do bem</h1>
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const ROTULO: Record<Exclude<SituacaoCupom, "valido">, string> = {
  usado: "Usado",
  vencido: "Vencido",
  suspenso: "Oferta suspensa",
};

async function Conteudo({ searchParams }: Pick<PageProps<"/cupons/meus">, "searchParams">) {
  const { aviso } = await searchParams;
  const usuario = await exigirUsuario("/cupons/meus");
  const cupons = await db.cupom.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 100,
    include: {
      oferta: {
        include: {
          empresa: { select: { nome: true, instagramUsername: true, moderacao: true, oculta: true } },
        },
      },
    },
  });
  const agora = new Date();
  const comSituacao = cupons.map((cupom) => ({ ...cupom, situacao: situacaoDoCupom(cupom, agora) }));
  const validos = comSituacao.filter((cupom) => cupom.situacao === "valido");
  const outros = comSituacao.filter((cupom) => cupom.situacao !== "valido");

  const ofertasValendo = await db.oferta.count({ where: condicaoDeOfertaPublica() });

  return (
    <div className="mt-4 space-y-6">
      <AbasCupons ativa="meus" ofertas={ofertasValendo} meus={validos.length} />
      <AvisoDaUrl codigo={aviso} />
      <p className="text-suave">
        Mostre o código na hora da compra. O Negócio do Bem nunca pede Pix nem pagamento para liberar cupom.{" "}
        <Link href="/clube-do-bem#para-quem-compra" className="link">
          Como funciona
        </Link>
      </p>

      {cupons.length === 0 ? (
        <div className="cartao p-8 text-center">
          <p className="font-serif text-2xl">Você ainda não tem cupons</p>
          <p className="mx-auto mt-2 max-w-md text-suave">
            Escolha uma oferta do Clube do Bem e gere o cupom. Ele aparece aqui, pronto para mostrar no caixa.
          </p>
          <Link href="/cupons" className="botao-coral mt-6">
            Ver as ofertas
          </Link>
        </div>
      ) : (
        <>
          {validos.length > 0 && (
            <ul className="space-y-4">
              {validos.map((cupom) => {
                const { empresa } = cupom.oferta;
                const noDiretorio = empresa.moderacao === "aprovada" && !empresa.oculta;
                return (
                  <li key={cupom.id} className="cartao space-y-2 border-coral/40 p-5">
                    {noDiretorio ? (
                      <Link href={`/empresas/${empresa.instagramUsername}`} className="font-medium hover:text-coral-700">
                        {empresa.nome}
                      </Link>
                    ) : (
                      <>
                        <p className="font-medium">{empresa.nome}</p>
                        <p className="text-sm text-suave">
                          Este negócio saiu do diretório. O cupom vale no balcão até o fim da oferta.
                        </p>
                      </>
                    )}
                    <p className="font-serif text-xl font-semibold">{cupom.oferta.titulo}</p>
                    <p className="text-sm text-suave">
                      {rotuloDoDesconto(cupom.oferta)} · {rotuloOndeVale(cupom.oferta.ondeVale)}
                    </p>
                    {cupom.oferta.condicoes && <p className="text-sm">{cupom.oferta.condicoes}</p>}
                    <p className="font-mono text-3xl tracking-[0.2em]">{cupom.codigo}</p>
                    <Prazo fim={cupom.oferta.fim.toISOString()} className="text-sm font-medium text-coral-700" />
                  </li>
                );
              })}
            </ul>
          )}
          {outros.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-semibold">Usados e vencidos</h2>
              <ul className="cartao mt-4 divide-y divide-linha">
                {outros.map((cupom) => (
                  <li key={cupom.id} className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {cupom.oferta.empresa.nome} · {cupom.oferta.titulo}
                      </p>
                      <p className="font-mono text-suave">{cupom.codigo}</p>
                    </div>
                    <p className="text-suave">
                      {cupom.situacao === "usado" && cupom.usadoEm
                        ? `Usado em ${formatarDataCurta(cupom.usadoEm)}`
                        : ROTULO[cupom.situacao as Exclude<SituacaoCupom, "valido">]}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
