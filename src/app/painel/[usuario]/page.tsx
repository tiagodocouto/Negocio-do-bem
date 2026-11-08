import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { alternarVisibilidade } from "@/acoes/empresas";
import { responderDepoimento } from "@/acoes/depoimentos";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { MODERACAO_EMPRESA } from "@/lib/dominio";
import { rotuloDoInstagram } from "@/lib/endereco";
import { normalizarEndereco } from "@/lib/instagram";
import { formatarData, formatarFavoritos } from "@/lib/texto";
import { EdicaoEmpresa } from "./EdicaoEmpresa";
import { FORA_DA_BUSCA } from "@/lib/seo";
import { seguirEnderecoAntigo } from "@/lib/troca-de-arroba";

export const metadata: Metadata = { title: "Editar perfil", robots: FORA_DA_BUSCA };

export default function EditarEmpresa(props: PageProps<"/painel/[usuario]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<div className="h-[40rem] animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/painel/[usuario]">, "params" | "searchParams">) {
  const username = normalizarEndereco((await params).usuario);
  if (!username) notFound();
  const usuario = await exigirUsuario(`/painel/${username}`);
  const empresa = await db.empresa.findUnique({
    where: { instagramUsername: username },
    include: {
      membros: { select: { usuarioId: true } },
      causas: { select: { causa: true } },
      _count: { select: { favoritos: true } },
      depoimentos: {
        where: { status: "publicado" },
        orderBy: { criadoEm: "desc" },
        include: { autor: { select: { nome: true } } },
      },
    },
  });
  if (!empresa) await seguirEnderecoAntigo(username, (atual) => `/painel/${atual}`);
  if (!empresa || !empresa.membros.some((m) => m.usuarioId === usuario.id)) notFound();
  const { aviso } = await searchParams;
  const liberacao = await db.liberacaoClube.findUnique({
    where: { empresaId_usuarioId: { empresaId: empresa.id, usuarioId: usuario.id } },
    select: { status: true },
  });

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <Link href="/painel" className="text-sm text-suave hover:text-tinta">
          ← Meu painel
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight">{empresa.nome}</h1>
            <p className="text-suave">
              {rotuloDoInstagram(empresa.instagramUsername)} · {empresa.oculta ? "Oculto do diretório" : MODERACAO_EMPRESA[empresa.moderacao]} ·{" "}
              {formatarFavoritos(empresa._count.favoritos)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/painel/${empresa.instagramUsername}/clube`} className="botao-claro botao-pequeno">
              Clube do Bem
            </Link>
            <Link href={`/empresas/${empresa.instagramUsername}`} className="botao-claro botao-pequeno">
              Ver perfil público ↗
            </Link>
          </div>
        </div>
        <AvisoDaUrl codigo={aviso} />
        <ChamadaDoClube username={empresa.instagramUsername} status={liberacao?.status} />
      </div>

      <EdicaoEmpresa empresa={empresa} voltar={`/painel/${empresa.instagramUsername}`} />

      <section id="depoimentos" className="scroll-mt-24">
        <h2 className="font-serif text-2xl font-semibold">Depoimentos</h2>
        <p className="mt-1 text-sm text-suave">
          Você pode responder a cada depoimento. Para manter a confiança da comunidade, donos não apagam depoimentos:
          se algum for ofensivo, use &ldquo;Denunciar&rdquo; no perfil público e a moderação avalia.
        </p>
        <div className="mt-4 space-y-4">
          {empresa.depoimentos.length === 0 && <p className="text-suave italic">Nenhum depoimento ainda.</p>}
          {empresa.depoimentos.map((d) => (
            <div key={d.id} className="cartao p-5">
              <p className="font-serif text-lg leading-relaxed whitespace-pre-line">{d.texto}</p>
              <p className="mt-2 text-sm text-suave">
                {d.autor.nome} · {formatarData(d.criadoEm)}
              </p>
              <form action={responderDepoimento} className="mt-4 space-y-2">
                <input type="hidden" name="depoimentoId" value={d.id} />
                <label htmlFor={`resposta-${d.id}`} className="sr-only">
                  Sua resposta
                </label>
                <textarea
                  id={`resposta-${d.id}`}
                  name="resposta"
                  rows={2}
                  maxLength={1000}
                  defaultValue={d.resposta ?? ""}
                  placeholder="Escreva uma resposta (opcional)…"
                  className="campo sm:text-sm"
                />
                <BotaoEnviar className="botao-claro botao-pequeno" enviando="Salvando…">
                  {d.resposta ? "Atualizar resposta" : "Responder"}
                </BotaoEnviar>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="cartao p-6">
        <h2 className="font-serif text-2xl font-semibold">Aparecer no diretório</h2>
        <p className="mt-1 text-sm leading-relaxed text-suave">
          {empresa.oculta
            ? "Seu negócio está oculto: ninguém encontra o perfil no diretório nem pelo link."
            : "Se preferir, você pode tirar seu negócio do diretório a qualquer momento. O perfil fica guardado e você pode voltar quando quiser."}
        </p>
        <form action={alternarVisibilidade} className="mt-4">
          <input type="hidden" name="empresaId" value={empresa.id} />
          <input type="hidden" name="ocultar" value={empresa.oculta ? "nao" : "sim"} />
          <BotaoEnviar className={empresa.oculta ? "botao-coral" : "botao-claro"} enviando="Salvando…">
            {empresa.oculta ? "Voltar a aparecer no diretório" : "Ocultar meu negócio"}
          </BotaoEnviar>
        </form>
      </section>
    </div>
  );
}

/** O convite do Clube do Bem para o dono que ainda não foi verificado, ou o pedido em análise. */
function ChamadaDoClube({ username, status }: { username: string; status?: string }) {
  if (status === "liberada") return null;
  if (status === "pendente") {
    return (
      <p className="cartao p-4 text-sm text-suave">
        🎟️ A verificação do seu negócio para o Clube do Bem está em análise. A resposta aparece no{" "}
        <Link href={`/painel/${username}/clube`} className="link">
          painel do clube
        </Link>
        .
      </p>
    );
  }
  const deNovo = status === "recusada" || status === "suspensa";
  return (
    <div className="cartao flex flex-col gap-4 border-coral/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-serif text-xl font-semibold">🎟️ Verifique a sua empresa e seja Parceiro do Clube do Bem</p>
        <p className="mt-1 text-sm leading-relaxed text-suave">
          {deNovo
            ? "A liberação do seu negócio não está valendo. Veja o motivo e peça a verificação de novo."
            : "Com o CNPJ, o seu nome completo e o seu CPF, a nossa equipe confere o negócio. Verificado, o perfil ganha o selo e você divulga promoções e cupons no perfil. É de graça."}
        </p>
      </div>
      <Link href={`/painel/${username}/clube#verificar`} className="botao-coral botao-pequeno whitespace-nowrap">
        Verificar meu negócio
      </Link>
    </div>
  );
}
