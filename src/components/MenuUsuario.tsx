import Link from "next/link";
import { sair } from "@/acoes/conta";
import { usuarioAtual } from "@/lib/auth/sessao";

export async function MenuUsuario() {
  const usuario = await usuarioAtual();

  if (!usuario) {
    return (
      <Link href="/entrar" className="botao botao-pequeno sm:ml-1">
        Entrar
      </Link>
    );
  }

  const primeiroNome = usuario.nome.split(" ")[0];
  return (
    <details className="group relative sm:ml-1">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-linha bg-superficie py-1 pr-1 pl-1 text-sm sm:pr-3 transition hover:border-tinta/20 [&::-webkit-details-marker]:hidden">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-coral-50 text-xs font-bold text-coral-700">
          {primeiroNome?.[0]?.toUpperCase()}
        </span>
        <span className="hidden max-w-24 truncate sm:inline">{primeiroNome}</span>
      </summary>
      <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-linha bg-superficie p-1.5 text-sm shadow-lg shadow-tinta/5">
        <p className="truncate px-3 pt-2 pb-1 text-xs text-suave">{usuario.email}</p>
        <Link href="/painel" className="block rounded-xl px-3 py-2 hover:bg-papel">
          Meu painel
        </Link>
        <Link href="/favoritos" className="block rounded-xl px-3 py-2 hover:bg-papel">
          Favoritos
        </Link>
        <Link href="/cupons/meus" className="block rounded-xl px-3 py-2 hover:bg-papel">
          Meus cupons
        </Link>
        {usuario.moderador && (
          <Link href="/moderacao" className="block rounded-xl px-3 py-2 hover:bg-papel">
            Moderação
          </Link>
        )}
        <form action={sair}>
          <button type="submit" className="block w-full rounded-xl px-3 py-2 text-left text-suave hover:bg-papel hover:text-tinta">
            Sair
          </button>
        </form>
      </div>
    </details>
  );
}
