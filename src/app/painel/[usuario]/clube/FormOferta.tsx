"use client";

import { useActionState } from "react";
import { criarOfertaAcao } from "@/acoes/ofertas";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Campo } from "@/components/Campo";
import { enviarSemLimpar } from "@/components/envio";

const TIPOS = [
  { valor: "percentual", rotulo: "Desconto em %" },
  { valor: "valor", rotulo: "Desconto em reais" },
  { valor: "brinde", rotulo: "Brinde" },
];
const LUGARES = [
  { valor: "local", rotulo: "No local" },
  { valor: "whatsapp", rotulo: "Pelo WhatsApp" },
  { valor: "site", rotulo: "Pelo site" },
];

/** A oferta nova do negócio. `hoje`, `ultimoDiaPadrao` e `ultimoDiaMaximo` vêm do servidor, no dia de Brasília. */
export function FormOferta({
  empresaId,
  hoje,
  ultimoDiaPadrao,
  ultimoDiaMaximo,
}: {
  empresaId: string;
  hoje: string;
  ultimoDiaPadrao: string;
  ultimoDiaMaximo: string;
}) {
  const [estado, acao, pendente] = useActionState(criarOfertaAcao, undefined);
  const valor = (campo: string) => {
    const enviado = estado?.valores?.[campo];
    return typeof enviado === "string" ? enviado : undefined;
  };
  const tipo = valor("tipo") ?? "percentual";
  const lugares = estado?.valores?.ondeVale;
  const marcado = (lugar: string) => (Array.isArray(lugares) ? lugares.includes(lugar) : lugares ? lugares === lugar : lugar === "local");
  const erro = (campo: string) => estado?.erros?.[campo];

  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="cartao space-y-5 p-6">
      <input type="hidden" name="empresaId" value={empresaId} />
      <div>
        <h2 className="font-serif text-2xl font-semibold">Criar uma oferta</h2>
        <p className="mt-1 text-sm text-suave">
          Ela aparece no perfil do negócio até o último dia. Depois de criada, não muda: para trocar, encerre e crie outra.
        </p>
      </div>

      <Campo id="titulo" rotulo="Título" erro={erro("titulo")} ajuda='Curto e claro, como "15% em qualquer pão".'>
        <input id="titulo" name="titulo" required minLength={5} maxLength={60} defaultValue={valor("titulo")} className="campo" />
      </Campo>

      <fieldset>
        <legend className="rotulo">Tipo</legend>
        <div className="flex flex-wrap gap-4">
          {TIPOS.map((opcao) => (
            <label key={opcao.valor} className="flex items-center gap-2 text-sm">
              <input type="radio" name="tipo" value={opcao.valor} defaultChecked={tipo === opcao.valor} />
              {opcao.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <Campo id="valor" rotulo="Quanto" erro={erro("valor")} ajuda="Desconto de 1% a 100%, ou o valor em reais. No brinde, deixe em branco.">
        <input id="valor" name="valor" inputMode="numeric" defaultValue={valor("valor")} className="campo max-w-40" />
      </Campo>

      <Campo id="condicoes" rotulo="Condições (opcional)" erro={erro("condicoes")} ajuda="Sem links, telefones nem Pix: o contato é sempre o do perfil.">
        <textarea id="condicoes" name="condicoes" rows={2} maxLength={300} defaultValue={valor("condicoes")} className="campo" />
      </Campo>

      <fieldset>
        <legend className="rotulo">Onde vale</legend>
        <div className="flex flex-wrap gap-4">
          {LUGARES.map((opcao) => (
            <label key={opcao.valor} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ondeVale" value={opcao.valor} defaultChecked={marcado(opcao.valor)} />
              {opcao.rotulo}
            </label>
          ))}
        </div>
        {erro("ondeVale") && <p className="erro-campo">{erro("ondeVale")}</p>}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="ultimoDia" rotulo="Último dia" erro={erro("ultimoDia")} ajuda="Até 15 dias, contando hoje. Termina às 23h59.">
          <input
            id="ultimoDia"
            name="ultimoDia"
            type="date"
            required
            min={hoje}
            max={ultimoDiaMaximo}
            defaultValue={valor("ultimoDia") ?? ultimoDiaPadrao}
            className="campo"
          />
        </Campo>
        <Campo id="limite" rotulo="Limite de cupons (opcional)" erro={erro("limite")} ajuda='Por exemplo, "os 50 primeiros".'>
          <input id="limite" name="limite" inputMode="numeric" defaultValue={valor("limite")} className="campo" />
        </Campo>
      </div>

      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} enviando="Publicando…" className="botao-coral">
        Publicar a oferta
      </BotaoEnviar>
    </form>
  );
}
