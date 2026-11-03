import type { Metadata } from "next";
import Link from "next/link";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Confira seu e-mail", robots: FORA_DA_BUSCA };

/** Mesma página com ou sem conta para o e-mail digitado: ela não revela quais e-mails têm conta. */
export default function LinkEnviado() {
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-6">
      <h1 className="text-center font-serif text-4xl font-semibold tracking-tight">Confira seu e-mail</h1>
      <div className="cartao mt-8 space-y-4 p-6 leading-relaxed text-suave sm:p-8">
        <p>
          Se houver uma conta com o e-mail que você digitou, mandamos um link para entrar. Ele vale por 15 minutos e uma
          vez só.
        </p>
        <p>
          Não chegou em alguns minutos? Olhe a caixa de spam ou{" "}
          <Link href="/entrar/link" className="link">
            peça de novo
          </Link>
          .
        </p>
        <p>
          <Link href="/entrar" className="link">
            Entrar com senha
          </Link>
        </p>
      </div>
    </div>
  );
}
