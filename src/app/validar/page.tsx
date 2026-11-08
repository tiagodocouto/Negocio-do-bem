import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AvisoDaUrl } from "@/components/Avisos";
import { CupomConferido } from "@/components/CupomConferido";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { negociosDoClube } from "@/lib/navegacao";
import { normalizarCodigo } from "@/lib/ofertas";
import { FORA_DA_BUSCA } from "@/lib/seo";
import { formatarDataHora } from "@/lib/texto";

export const metadata: Metadata = { title: "Validar cupom", robots: FORA_DA_BUSCA };

export default function Validar(props: PageProps<"/validar">) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-8 sm:px-6 sm:pt-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/validar">, "searchParams">) {
  const usuario = await exigirUsuario("/validar");
  const { negocio: negocioDaUrl, codigo: codigoDaUrl, aviso } = await searchParams;
  const negocios = await negociosDoClube(usuario.id);

  if (negocios.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Validar cupom</h1>
        <div className="cartao space-y-3 p-6">
          <p className="font-serif text-2xl">Só para negócios do Clube do Bem</p>
          <p className="text-suave">
            Quando o seu negócio estiver verificado, é aqui que você confere o código que o cliente mostra e marca o cupom como usado.
          </p>
          <Link href="/clube-do-bem#para-negocios" className="botao-coral">
            Como entrar no Clube do Bem
          </Link>
        </div>
      </div>
    );
  }

  const negocio = negocios.find((n) => n.instagramUsername === negocioDaUrl) ?? negocios[0]!;
  const codigo = typeof codigoDaUrl === "string" ? normalizarCodigo(codigoDaUrl) : "";
  const [cupom, recentes] = await Promise.all([
    codigo ? db.cupom.findUnique({ where: { codigo }, include: { oferta: true, usuario: { select: { nome: true } } } }) : null,
    db.cupom.findMany({
      where: { usadoEm: { not: null }, oferta: { empresaId: negocio.id } },
      orderBy: { usadoEm: "desc" },
      take: 5,
      select: { id: true, codigo: true, usadoEm: true, usuario: { select: { nome: true } } },
    }),
  ]);
  const cupomDaqui = cupom && cupom.oferta.empresaId === negocio.id ? cupom : null;
  const agora = new Date();
  const avisoDaValidacao = typeof aviso === "string" && aviso.startsWith("cupom_") ? aviso : undefined;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-suave">{negocio.nome}</p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Validar cupom</h1>
      </div>

      {negocios.length > 1 && (
        <ul aria-label="Negócio" className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {negocios.map((n) => (
            <li key={n.id} className="shrink-0">
              <Link
                href={`/validar?negocio=${n.instagramUsername}`}
                aria-current={n.id === negocio.id ? "true" : undefined}
                className={`block rounded-full border px-3.5 py-1.5 text-sm transition ${
                  n.id === negocio.id ? "border-tinta bg-tinta text-papel" : "border-linha bg-superficie text-suave hover:text-tinta"
                }`}
              >
                {n.nome}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action="/validar" method="get" className="space-y-3">
        <input type="hidden" name="negocio" value={negocio.instagramUsername} />
        <label htmlFor="codigo" className="rotulo">
          Código do cliente
        </label>
        <input
          id="codigo"
          name="codigo"
          required
          autoFocus={!codigo}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={codigo}
          placeholder="7K3P9Q"
          className="campo rounded-3xl border-2 border-coral py-5 text-center font-mono text-3xl tracking-[0.2em] uppercase sm:text-3xl"
        />
        <button type="submit" className="botao-coral w-full py-3">
          Validar
        </button>
        <p className="text-sm text-suave">
          Peça ao cliente para abrir <strong>Cupons › Meus cupons</strong> e mostrar o código.
        </p>
      </form>

      {avisoDaValidacao !== "cupom_usado" && <AvisoDaUrl codigo={avisoDaValidacao} />}
      {codigo &&
        (!cupomDaqui ? (
          <p className="cartao p-5 text-sm text-coral-700">Não achamos um cupom com esse código neste negócio. Confira as letras.</p>
        ) : (
          <CupomConferido cupom={cupomDaqui} empresaId={negocio.id} agora={agora} usadoAgora={avisoDaValidacao === "cupom_usado"} origem="validar" />
        ))}

      {recentes.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-xl font-semibold">Últimos cupons usados</h2>
          <ul className="cartao divide-y divide-linha text-sm">
            {recentes.map((recente) => (
              <li key={recente.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-mono tracking-[0.15em]">{recente.codigo}</p>
                  <p className="text-suave">{recente.usuario.nome.split(" ")[0]}</p>
                </div>
                <p className="text-suave">{recente.usadoEm && formatarDataHora(recente.usadoEm)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
