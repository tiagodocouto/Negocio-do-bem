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
      <Campo id="cnpj" rotulo="CNPJ ou MEI (opcional)" erro={estado?.erros?.cnpj} ajuda="Ajuda a moderação a conferir o registro do negócio.">
        <input id="cnpj" name="cnpj" maxLength={20} placeholder="00.000.000/0000-00" defaultValue={valor("cnpj")} className="campo" />
      </Campo>
      <Campo id="site" rotulo="Site do negócio (opcional)" erro={estado?.erros?.site}>
        <input id="site" name="site" maxLength={200} placeholder="www.meunegocio.com.br" defaultValue={valor("site")} className="campo" autoCapitalize="none" />
      </Campo>
      <Campo id="contato" rotulo="Como a moderação fala com você?" erro={estado?.erros?.contato}>
        <input id="contato" name="contato" required maxLength={160} placeholder="WhatsApp ou e-mail do negócio" defaultValue={valor("contato")} className="campo" />
      </Campo>
      <Campo id="mensagem" rotulo="Algo mais que devemos saber? (opcional)" erro={estado?.erros?.mensagem}>
        <textarea id="mensagem" name="mensagem" rows={3} maxLength={1000} defaultValue={valor("mensagem")} className="campo" />
      </Campo>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} enviando="Enviando…">Enviar dados</BotaoEnviar>
    </form>
  );
}
