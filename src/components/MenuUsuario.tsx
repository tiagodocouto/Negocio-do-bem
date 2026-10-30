import Link from "next/link";
import { sair } from "@/acoes/conta";
import { usuarioAtual } from "@/lib/auth/sessao";

export async function MenuUsuario({ modo = "menu" }: { modo?: "menu" | "painel" } = {}) {
  const usuario = await usuarioAtual();

  if (modo === "painel") {
    return <section className="menu-conta-direta" aria-label="Sua conta">
      {usuario ? <>
        <div className="menu-conta-identidade"><span aria-hidden="true">{usuario.nome[0]?.toUpperCase()}</span><div><strong>{usuario.nome}</strong><p>{usuario.email}</p></div></div>
        <nav aria-label="Opções da conta"><Link href="/painel">Meu painel <span aria-hidden="true">↗</span></Link>{usuario.moderador && <Link href="/moderacao">Moderação <span aria-hidden="true">↗</span></Link>}<form action={sair}><button type="submit">Sair da conta <span aria-hidden="true">↗</span></button></form></nav>
      </> : <><h2>Sua conta</h2><p>Entre para indicar, compartilhar experiências e cuidar do seu negócio.</p><div className="menu-conta-acesso"><Link href="/entrar" className="botao">Entrar</Link><Link href="/cadastrar" className="botao-claro">Criar conta</Link></div></>}
    </section>;
  }

  if (!usuario) {
    return (
      <Link href="/entrar" className="botao botao-pequeno ml-1 focus-visible:outline-tinta">
        Entrar
      </Link>
    );
  }

  const primeiroNome = usuario.nome.split(" ")[0];
  return (
    <details className="group relative ml-1">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-linha bg-superficie py-1 pr-1 pl-1 text-sm font-semibold transition hover:border-tinta/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta sm:pr-3 [&::-webkit-details-marker]:hidden">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-amarelo font-display text-sm font-extrabold text-sobre-amarelo">
          {primeiroNome?.[0]?.toUpperCase()}
        </span>
        <span className="hidden max-w-24 truncate sm:inline">{primeiroNome}</span>
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-2xl border border-linha bg-superficie p-1.5 text-sm shadow-[0_12px_32px_-12px] shadow-tinta/25">
        <p className="truncate px-3 pt-2 pb-1 text-xs text-suave">{usuario.email}</p>
        <Link href="/painel" className="block rounded-xl px-3 py-2 font-medium hover:bg-papel">
          Meu painel
        </Link>
        {usuario.moderador && (
          <Link href="/moderacao" className="block rounded-xl px-3 py-2 font-medium hover:bg-papel">
            Moderação
          </Link>
        )}
        <form action={sair}><button type="submit" className="block w-full rounded-xl px-3 py-2 text-left text-suave hover:bg-papel hover:text-tinta">Sair da conta</button></form>
      </div>
    </details>
  );
}
