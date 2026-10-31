"use client";

import { useActionState } from "react";
import { reenviarConfirmacao } from "@/acoes/conta";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";

/** No lugar de indicar, escrever depoimento e reivindicar, enquanto o e-mail não foi confirmado. */
export function ConfirmarEmail({ email, para, voltar }: { email: string; para: string; voltar: string }) {
  const [estado, acao, pendente] = useActionState(reenviarConfirmacao, undefined);
  return (
    <div className="cartao space-y-4 p-6 sm:p-8">
      <div>
        <p className="font-serif text-2xl">Confirme seu e-mail para {para}</p>
        <p className="mt-2 leading-relaxed text-suave">
          Precisamos saber que <strong className="font-semibold break-all text-tinta">{email}</strong> é seu. Se você
          acabou de criar a conta, o link já está na sua caixa de entrada. Se não está, peça um aqui.
        </p>
      </div>
      {estado?.enviado && <Aviso tipo="sucesso">Mandamos um link novo. Ele vale por 24 horas.</Aviso>}
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <form action={acao}>
        <input type="hidden" name="voltar" value={voltar} />
        <BotaoEnviar pendente={pendente} className="botao-claro" enviando="Enviando…">
          Mandar o link de confirmação
        </BotaoEnviar>
      </form>
    </div>
  );
}
