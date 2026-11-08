import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { gerarCupomAcao } from "@/acoes/ofertas";
import { AbasCupons } from "@/components/AbasCupons";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { FotoEmpresa } from "@/components/FotoEmpresa";
import { Prazo } from "@/components/Prazo";
import { usuarioAtual } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { condicaoDeOfertaPublica, rotuloDoDesconto, rotuloOndeVale } from "@/lib/ofertas";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Cupons do bem", robots: FORA_DA_BUSCA };

export default function Cupons(props: PageProps<"/cupons">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Cupons do bem</h1>
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function enderecoDaCidade(cidade?: string): string {
  return cidade ? `/cupons?cidade=${encodeURIComponent(cidade)}` : "/cupons";
}

async function Conteudo({ searchParams }: Pick<PageProps<"/cupons">, "searchParams">) {
  const { aviso, cidade: cidadeDaUrl } = await searchParams;
  const usuario = await usuarioAtual();
  const [ofertas, meusCupons] = await Promise.all([
    db.oferta.findMany({
      where: condicaoDeOfertaPublica(),
      orderBy: { fim: "asc" },
      take: 100,
      include: {
        empresa: { select: { nome: true, instagramUsername: true, fotoUrl: true, cidade: true, uf: true, membros: { select: { usuarioId: true } } } },
      },
    }),
    usuario
      ? db.cupom.findMany({
          where: { usuarioId: usuario.id },
          select: { codigo: true, ofertaId: true, usadoEm: true, oferta: { select: { fim: true, status: true } } },
        })
      : [],
  ]);

  const agora = new Date();
  const cupomDaOferta = new Map(meusCupons.map((cupom) => [cupom.ofertaId, cupom.codigo]));
  const validos = meusCupons.filter((cupom) => !cupom.usadoEm && cupom.oferta.status !== "suspensa" && cupom.oferta.fim > agora).length;

  const cidades = [...new Set(ofertas.map((oferta) => `${oferta.empresa.cidade}, ${oferta.empresa.uf}`))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const cidade = typeof cidadeDaUrl === "string" && cidades.includes(cidadeDaUrl) ? cidadeDaUrl : undefined;
  const lista = cidade ? ofertas.filter((oferta) => `${oferta.empresa.cidade}, ${oferta.empresa.uf}` === cidade) : ofertas;

  return (
    <div className="mt-4 space-y-6">
      <AbasCupons ativa="ofertas" ofertas={ofertas.length} meus={validos} />
      <AvisoDaUrl codigo={aviso} />
      <p className="text-suave">
        Ofertas de negócios do Clube do Bem. Gere o cupom e mostre o código na hora da compra. O Negócio do Bem nunca pede Pix nem pagamento para liberar cupom.{" "}
        <Link href="/clube-do-bem#para-quem-compra" className="link">
          Como funciona
        </Link>
      </p>

      {cidades.length > 1 && (
        <ul aria-label="Cidade" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[undefined, ...cidades].map((opcao) => (
            <li key={opcao ?? "todas"} className="shrink-0">
              <Link
                href={enderecoDaCidade(opcao)}
                aria-current={opcao === cidade ? "true" : undefined}
                className={`block rounded-full border px-3.5 py-1.5 text-sm transition ${
                  opcao === cidade ? "border-tinta bg-tinta text-papel" : "border-linha bg-superficie text-suave hover:border-tinta/30 hover:text-tinta"
                }`}
              >
                {opcao ?? "Todas as cidades"}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {lista.length === 0 ? (
        <div className="cartao p-8 text-center">
          <p className="font-serif text-2xl">Nenhuma oferta valendo agora</p>
          <p className="mx-auto mt-2 max-w-md text-suave">
            Os negócios do Clube do Bem criam ofertas por poucos dias. Enquanto isso, descubra negócios que fazem o bem.
          </p>
          <Link href="/explorar" className="botao-coral mt-6">
            Explorar o diretório
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {lista.map((oferta) => {
            const perfil = `/empresas/${oferta.empresa.instagramUsername}`;
            const meuCupom = cupomDaOferta.get(oferta.id);
            const restam = oferta.limite === null ? null : Math.max(0, oferta.limite - oferta.cuponsGerados);
            const ehDono = !!usuario && oferta.empresa.membros.some((membro) => membro.usuarioId === usuario.id);
            return (
              <li key={oferta.id} className="cartao space-y-3 p-5">
                <Link href={perfil} className="flex items-center gap-3">
                  <FotoEmpresa empresa={oferta.empresa} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{oferta.empresa.nome}</span>
                    <span className="block truncate text-sm text-suave">
                      {oferta.empresa.cidade}, {oferta.empresa.uf}
                    </span>
                  </span>
                </Link>
                <p className="font-serif text-2xl leading-snug font-semibold">{oferta.titulo}</p>
                <p className="text-sm text-suave">
                  {rotuloDoDesconto(oferta)} · {rotuloOndeVale(oferta.ondeVale)}
                </p>
                {oferta.condicoes && <p className="text-sm">{oferta.condicoes}</p>}
                <p className="text-sm font-medium text-coral-700">
                  <Prazo fim={oferta.fim.toISOString()} />
                  {restam !== null && ` · ${restam === 1 ? "resta 1 cupom" : `restam ${restam} cupons`}`}
                </p>
                {meuCupom ? (
                  <Link href="/cupons/meus" className="botao-claro w-full">
                    Ver meu cupom
                  </Link>
                ) : ehDono ? (
                  <p className="text-sm text-suave">É a oferta do seu negócio.</p>
                ) : restam === 0 ? (
                  <p className="text-sm text-suave">Os cupons desta oferta acabaram.</p>
                ) : !usuario ? (
                  <Link href={`/entrar?voltar=${encodeURIComponent(enderecoDaCidade(cidade))}`} className="botao-coral w-full">
                    Entre para pegar o cupom
                  </Link>
                ) : (
                  <form action={gerarCupomAcao} className="space-y-2">
                    <input type="hidden" name="ofertaId" value={oferta.id} />
                    <input type="hidden" name="origem" value="lista" />
                    <BotaoEnviar className="botao-coral w-full" enviando="Gerando…">
                      Pegar cupom
                    </BotaoEnviar>
                    <p className="text-xs text-suave">Ao pegar o cupom, {oferta.empresa.nome} entra nos seus favoritos.</p>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
