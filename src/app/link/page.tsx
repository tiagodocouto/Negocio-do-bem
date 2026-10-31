import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { usarLinkDoEmail } from "@/acoes/conta";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { FormSenhaNova } from "@/components/FormulariosConta";
import { CONFIRMACAO_DE_EMAIL_LIGADA, COOKIE_LINK, lerLink } from "@/lib/auth/links";
import { caminhoSeguro, usuarioAtual } from "@/lib/auth/sessao";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Link por e-mail", robots: FORA_DA_BUSCA };

/** Aonde leva o link do e-mail, depois de /api/link: um clique confirma o e-mail ou entra, ou a pessoa cria uma senha nova. */
export default function PaginaLink(props: PageProps<"/link">) {
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function Moldura({ titulo, texto, children }: { titulo: string; texto: ReactNode; children: ReactNode }) {
  return (
    <>
      <h1 className="text-center font-serif text-4xl font-semibold tracking-tight">{titulo}</h1>
      <div className="cartao mt-8 space-y-6 p-6 sm:p-8">
        <p className="leading-relaxed text-suave">{texto}</p>
        {children}
      </div>
    </>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/link">, "searchParams">) {
  const busca = await searchParams;
  if (busca.confirmado) {
    const voltar = caminhoSeguro(busca.voltar);
    const usuario = await usuarioAtual();
    return (
      <Moldura
        titulo="E-mail confirmado"
        texto="Pronto! Agora você pode indicar negócios, deixar depoimentos e assumir o perfil do seu negócio."
      >
        <Link href={usuario ? voltar : `/entrar?voltar=${encodeURIComponent(voltar)}`} className="botao w-full">
          {usuario ? "Continuar" : "Entrar"}
        </Link>
      </Moldura>
    );
  }

  const link = await lerLink((await cookies()).get(COOKIE_LINK)?.value ?? "");
  if (!link) {
    return (
      <Moldura
        titulo="Este link não vale mais"
        texto="Ele venceu ou já foi usado. Cada link vale uma vez só: o de entrar, por 15 minutos, o de senha nova, por 1 hora, e o de confirmar o e-mail, por 24 horas."
      >
        <div className="space-y-3 text-center">
          <Link href="/entrar/link" className="botao w-full">
            Pedir um link para entrar
          </Link>
          <Link href="/esqueci-a-senha" className="link block text-sm">
            Pedir um link de senha nova
          </Link>
          {CONFIRMACAO_DE_EMAIL_LIGADA && (
            <p className="text-sm text-suave">
              Para confirmar o e-mail, peça um link novo no{" "}
              <Link href="/painel" className="link">
                seu painel
              </Link>
              .
            </p>
          )}
        </div>
      </Moldura>
    );
  }

  const { usuario } = link;
  // Quem está logado também vê o formulário: quem desconfia de invasão abre o link na conta
  // aberta e precisa chegar à senha nova.
  if (link.finalidade === "redefinir") {
    return (
      <Moldura
        titulo="Crie uma senha nova"
        texto={
          <>
            Para a conta de <strong className="font-semibold text-tinta">{usuario.nome}</strong> (
            <span className="break-all">{usuario.email}</span>). Ao salvar, você entra neste aparelho e os outros saem da
            conta.
          </>
        }
      >
        <FormSenhaNova />
      </Moldura>
    );
  }
  if (link.finalidade === "entrar") {
    return (
      <Moldura
        titulo="Entrar"
        texto={
          <>
            Você vai entrar na conta de <strong className="font-semibold text-tinta">{usuario.nome}</strong> (
            <span className="break-all">{usuario.email}</span>).
          </>
        }
      >
        <form action={usarLinkDoEmail}>
          <BotaoEnviar className="botao w-full" enviando="Entrando…">
            Entrar
          </BotaoEnviar>
        </form>
      </Moldura>
    );
  }
  return (
    <Moldura
      titulo="Confirme seu e-mail"
      texto={
        <>
          Confirme que <strong className="font-semibold break-all text-tinta">{usuario.email}</strong> é o e-mail da
          conta de {usuario.nome}.
        </>
      }
    >
      <form action={usarLinkDoEmail}>
        <BotaoEnviar className="botao w-full" enviando="Confirmando…">
          Confirmar meu e-mail
        </BotaoEnviar>
      </form>
      <p className="text-center text-sm text-suave">Não criou esta conta? É só fechar esta página.</p>
    </Moldura>
  );
}
