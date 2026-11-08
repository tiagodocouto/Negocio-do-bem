"use client";

import Link from "next/link";
import { useActionState } from "react";
import { pedirVerificacaoAcao } from "@/acoes/clube";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Campo } from "@/components/Campo";
import { enviarSemLimpar } from "@/components/envio";

/**
 * O pedido de verificação: CNPJ do negócio, nome completo e CPF de quem pede, com a
 * autorização para a moderação usá-los. `cnpj` vem preenchido quando já se conhece.
 */
export function FormVerificacao({ empresaId, cnpj, nome, deNovo }: { empresaId: string; cnpj?: string; nome?: string; deNovo: boolean }) {
  const [estado, acao, pendente] = useActionState(pedirVerificacaoAcao, undefined);
  const enviado = estado?.valores?.cnpj;
  const nomeEnviado = estado?.valores?.nomeCompleto;

  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="space-y-4">
      <input type="hidden" name="empresaId" value={empresaId} />
      <Campo id="cnpj" rotulo="CNPJ do negócio" ajuda="O MEI também tem CNPJ. Só a moderação vê este número.">
        <input
          id="cnpj"
          name="cnpj"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="00.000.000/0000-00"
          defaultValue={typeof enviado === "string" ? enviado : cnpj}
          className="campo max-w-xs"
        />
      </Campo>
      <Campo id="nomeCompleto" rotulo="Seu nome completo" ajuda="Como está no documento. Só a moderação vê.">
        <input
          id="nomeCompleto"
          name="nomeCompleto"
          required
          maxLength={120}
          autoComplete="name"
          defaultValue={typeof nomeEnviado === "string" ? nomeEnviado : nome}
          className="campo max-w-md"
        />
      </Campo>
      <Campo id="cpf" rotulo="Seu CPF" ajuda="Não guardamos o número inteiro: só os 6 dígitos do meio, para comparar com a Receita.">
        <input id="cpf" name="cpf" required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" className="campo max-w-xs" />
      </Campo>
      <Campo
        id="documentos"
        rotulo="Foto do seu RG ou da sua CNH"
        ajuda="Frente e verso, até 2 arquivos de 5 MB (JPG, PNG, WebP ou PDF). Só a moderação vê, e o arquivo é apagado quando ela decide."
      >
        <input id="documentos" name="documentos" type="file" multiple required accept="image/jpeg,image/png,image/webp,application/pdf" className="campo max-w-md" />
      </Campo>
      <label className="flex cursor-pointer items-start gap-2 text-sm leading-relaxed">
        <input type="checkbox" name="consentimento" value="sim" required className="mt-1 h-4 w-4 shrink-0 accent-coral" />
        <span>
          Autorizo o Negócio do Bem a usar o meu nome, o meu CPF e a foto do meu documento só para conferir que sou dono deste negócio.{" "}
          <Link href="/sobre#privacidade" className="link">
            Privacidade
          </Link>
        </span>
      </label>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} enviando="Enviando…" className="botao-coral">
        {deNovo ? "Pedir de novo" : "Pedir a verificação"}
      </BotaoEnviar>
    </form>
  );
}
