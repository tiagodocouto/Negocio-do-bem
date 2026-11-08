import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AvisoDaUrl } from "@/components/Avisos";
import { ICONES_DE_LISTA, ItemDeLista } from "@/components/ItemDeLista";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { condicaoDeOfertaAtiva } from "@/lib/ofertas";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Negócio", robots: FORA_DA_BUSCA };

export default function Negocio(props: PageProps<"/negocio">) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-8 sm:px-6 sm:pt-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/negocio">, "searchParams">) {
  const usuario = await exigirUsuario("/negocio");
  const { negocio: negocioDaUrl, aviso } = await searchParams;
  const membros = await db.empresaMembro.findMany({
    where: { usuarioId: usuario.id },
    select: { empresa: { select: { id: true, nome: true, instagramUsername: true } } },
    orderBy: { criadoEm: "asc" },
  });
  const negocios = membros.map((membro) => membro.empresa);

  if (negocios.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Negócio</h1>
        <div className="cartao space-y-3 p-6">
          <p className="font-serif text-2xl">Você ainda não tem um negócio aqui</p>
          <p className="text-suave">Cadastre o seu, ou assuma o perfil de um negócio que já está no diretório.</p>
          <Link href="/participar" className="botao-coral">
            Cadastrar um negócio
          </Link>
        </div>
      </div>
    );
  }

  const escolhido = negocios.find((n) => n.instagramUsername === negocioDaUrl) ?? (negocios.length === 1 ? negocios[0] : undefined);
  if (!escolhido) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Negócio</h1>
        <p className="text-suave">Escolha qual negócio você quer cuidar.</p>
        <ul className="cartao divide-y divide-linha overflow-hidden">
          {negocios.map((n) => (
            <ItemDeLista key={n.id} href={`/negocio?negocio=${n.instagramUsername}`} icone={ICONES_DE_LISTA.loja} titulo={n.nome} detalhe={`@${n.instagramUsername}`} />
          ))}
        </ul>
      </div>
    );
  }

  const [liberacao, ativa, usados, semResposta] = await Promise.all([
    db.liberacaoClube.findUnique({ where: { empresaId_usuarioId: { empresaId: escolhido.id, usuarioId: usuario.id } }, select: { status: true } }),
    db.oferta.findFirst({ where: { empresaId: escolhido.id, ...condicaoDeOfertaAtiva() }, select: { cuponsGerados: true } }),
    db.cupom.count({ where: { usadoEm: { not: null }, oferta: { empresaId: escolhido.id } } }),
    db.depoimento.count({ where: { empresaId: escolhido.id, status: "publicado", resposta: null } }),
  ]);
  const liberado = liberacao?.status === "liberada";
  const painel = `/painel/${escolhido.instagramUsername}`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-suave">Negócio</p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">{escolhido.nome}</h1>
      </div>
      <AvisoDaUrl codigo={aviso} />

      {negocios.length > 1 && (
        <p className="text-sm">
          <Link href="/negocio" className="link">
            Trocar de negócio
          </Link>
        </p>
      )}

      {liberado ? (
        <div className="space-y-3 rounded-3xl bg-coral p-5 text-white">
          <p className="font-serif text-2xl leading-tight font-semibold">Cliente com cupom?</p>
          <p className="text-sm text-white/90">Digite o código e marque o uso na hora.</p>
          <Link href={`/validar?negocio=${escolhido.instagramUsername}`} className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-coral-700 transition hover:bg-papel">
            Validar cupom
          </Link>
        </div>
      ) : (
        <div className="cartao space-y-3 border-coral/40 p-5">
          <p className="font-serif text-xl font-semibold">🎟️ Seja Parceiro do Clube do Bem</p>
          <p className="text-sm text-suave">Com o negócio verificado, você cria ofertas e valida cupons por aqui.</p>
          <Link href={`${painel}/clube#verificar`} className="botao-coral">
            Verificar meu negócio
          </Link>
        </div>
      )}

      <ul className="cartao divide-y divide-linha overflow-hidden">
        <ItemDeLista
          href={`${painel}/clube`}
          icone={ICONES_DE_LISTA.cupom}
          titulo="Ofertas do Clube"
          detalhe={
            liberado
              ? `${ativa ? `1 valendo, ${ativa.cuponsGerados} ${ativa.cuponsGerados === 1 ? "cupom gerado" : "cupons gerados"}` : "Nenhuma valendo"} · ${usados} ${usados === 1 ? "usado" : "usados"}`
              : "Verificação e ofertas"
          }
        />
        <ItemDeLista href={painel} icone={ICONES_DE_LISTA.lapis} titulo="Editar perfil" detalhe="Fotos, história e contatos" />
        <ItemDeLista
          href={`${painel}#depoimentos`}
          icone={ICONES_DE_LISTA.balao}
          titulo="Depoimentos"
          detalhe={semResposta > 0 ? `${semResposta} sem resposta` : "Tudo respondido"}
        />
        <ItemDeLista href={`/empresas/${escolhido.instagramUsername}`} icone={ICONES_DE_LISTA.link} titulo="Ver perfil público" />
      </ul>
    </div>
  );
}
