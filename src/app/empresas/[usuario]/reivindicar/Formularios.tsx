"use client";

import { useActionState } from "react";
import { enviarDocumento } from "@/acoes/reivindicacoes";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { enviarSemLimpar } from "@/components/envio";
import { Campo } from "@/components/Campo";

export function FormDocumento({ empresaId }: { empresaId: string }) {
  const [estado, acao, pendente] = useActionState(enviarDocumento, undefined);
  const valor = (campo: string) => {
    const v = estado?.valores?.[campo];
    return typeof v === "string" ? v : "";
  };
  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="mt-6 space-y-4">
      <input type="hidden" name="empresaId" value={empresaId} />
      <Campo id="relacao" rotulo="Qual é a sua relação com o negócio?" erro={estado?.erros?.relacao}>
        <input id="relacao" name="relacao" required maxLength={120} placeholder="Ex.: sou a fundadora, sou sócio…" defaultValue={valor("relacao")} className="campo" />
      </Campo>
      <Campo id="mensagem" rotulo="Algo mais que devemos saber? (opcional)" erro={estado?.erros?.mensagem}>
        <textarea id="mensagem" name="mensagem" rows={3} maxLength={1000} defaultValue={valor("mensagem")} className="campo" />
      </Campo>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} enviando="Enviando…">Enviar dados</BotaoEnviar>
    </form>
  );
}
