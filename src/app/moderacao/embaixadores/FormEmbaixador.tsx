"use client";

import { useActionState, useState } from "react";
import { salvarEmbaixador } from "@/acoes/embaixadores";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Campo } from "@/components/Campo";
import { CampoMunicipio } from "@/components/CampoMunicipio";
import { enviarSemLimpar } from "@/components/envio";
import { NOMES_UF, TITULOS_EMBAIXADOR, UFS } from "@/lib/dominio";

const MAXIMO_DO_SOBRE = 600; // o mesmo de src/lib/embaixadores.ts, que é só do servidor

export type ValoresDoEmbaixador = {
  id?: string;
  instagram: string;
  nome: string;
  titulo: string;
  sobre: string;
  /** "Cidade, UF", ou vazio para quem cobre o estado. */
  municipio: string;
  uf: string;
  seguidoresManual: boolean;
  seguidores: string;
  ordem: string;
  naInicial: boolean;
  ativo: boolean;
};

/** Cadastro e edição de um embaixador, na moderação. */
export function FormEmbaixador({ embaixador }: { embaixador: ValoresDoEmbaixador }) {
  const [estado, acao, pendente] = useActionState(salvarEmbaixador, undefined);
  const erros = estado?.erros ?? {};
  const valores = estado?.valores;
  const valor = (campo: "instagram" | "nome" | "titulo" | "sobre" | "municipio" | "uf" | "seguidores" | "ordem") => {
    const v = valores?.[campo];
    return typeof v === "string" ? v : embaixador[campo];
  };
  const [porEstado, setPorEstado] = useState(embaixador.id ? !embaixador.municipio : false);
  const [manual, setManual] = useState(embaixador.seguidoresManual);

  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="cartao space-y-6 p-6 sm:p-8">
      {embaixador.id && <input type="hidden" name="embaixadorId" value={embaixador.id} />}

      <Campo
        id="instagram"
        rotulo="@ do Instagram"
        erro={erros.instagram}
        ajuda="A foto e os seguidores vêm da API da Meta, que só lê contas comerciais e de criador."
      >
        <input id="instagram" name="instagram" required maxLength={60} placeholder="@fulana" defaultValue={valor("instagram")} className="campo" />
      </Campo>

      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        <Campo id="nome" rotulo="Nome que aparece no site" erro={erros.nome}>
          <input id="nome" name="nome" required maxLength={60} defaultValue={valor("nome")} className="campo" />
        </Campo>
        <Campo id="titulo" rotulo="Como chamar" erro={erros.titulo} ajuda='Na página da cidade: "Embaixadora em Salvador".'>
          <select id="titulo" name="titulo" defaultValue={valor("titulo")} className="campo">
            {Object.entries(TITULOS_EMBAIXADOR).map(([chave, rotulo]) => (
              <option key={chave} value={chave}>
                {rotulo}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo
        id="sobre"
        rotulo="Sobre"
        erro={erros.sobre}
        ajuda={
          embaixador.id
            ? "Aparece na página do embaixador. Vazio, a bio do Instagram entra no lugar ao clicar em “Atualizar pelo Instagram agora”."
            : "Aparece na página do embaixador. Deixe em branco para começar com a bio do Instagram e ajustar depois."
        }
      >
        <textarea id="sobre" name="sobre" rows={4} maxLength={MAXIMO_DO_SOBRE} defaultValue={valor("sobre")} className="campo" />
      </Campo>

      <fieldset className="space-y-3">
        <legend className="rotulo">Onde atua</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { valor: "cidade", rotulo: "Uma cidade", ativo: !porEstado },
            { valor: "estado", rotulo: "Um estado inteiro", ativo: porEstado },
          ].map((opcao) => (
            <label
              key={opcao.valor}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border bg-superficie px-4 text-sm font-medium ${
                opcao.ativo ? "border-coral" : "border-linha"
              }`}
            >
              <input
                type="radio"
                name="abrangencia"
                value={opcao.valor}
                checked={opcao.ativo}
                onChange={() => setPorEstado(opcao.valor === "estado")}
                className="accent-coral"
              />
              {opcao.rotulo}
            </label>
          ))}
        </div>
        {porEstado ? (
          <Campo
            id="uf"
            rotulo="Estado"
            erro={erros.uf}
            ajuda="Aparece na página de todas as cidades do estado, e o cartão leva ao diretório filtrado pelo estado."
          >
            <select id="uf" name="uf" defaultValue={valor("uf")} className="campo">
              <option value="">Escolha o estado</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {NOMES_UF[uf]}
                </option>
              ))}
            </select>
          </Campo>
        ) : (
          <div>
            <CampoMunicipio valorInicial={valor("municipio")} erro={erros.municipio} />
            {!erros.municipio && (
              <p className="ajuda">O cartão leva para a página da cidade. Cidade ainda sem negócios no diretório leva para “Indicar um negócio”.</p>
            )}
          </div>
        )}
      </fieldset>

      <div className="space-y-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="seguidoresManual"
            value="sim"
            checked={manual}
            onChange={(evento) => setManual(evento.target.checked)}
            className="h-4 w-4 accent-coral"
          />
          Digitar o número de seguidores à mão
        </label>
        <p className="ajuda -mt-2">
          Só para conta pessoal ou privada, que a API da Meta não lê. O número digitado não se atualiza sozinho.
        </p>
        {manual && (
          <div className="max-w-56">
            <Campo id="seguidores" rotulo="Seguidores" erro={erros.seguidores}>
              <input id="seguidores" name="seguidores" inputMode="numeric" maxLength={14} placeholder="48.231" defaultValue={valor("seguidores")} className="campo" />
            </Campo>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-t border-linha pt-5">
        <div className="w-32">
          <Campo id="ordem" rotulo="Ordem" erro={erros.ordem}>
            <input id="ordem" name="ordem" type="number" min={0} max={999} defaultValue={valor("ordem")} className="campo" />
          </Campo>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium">
          <input type="checkbox" name="naInicial" value="sim" defaultChecked={embaixador.naInicial} className="h-4 w-4 accent-coral" />
          Na faixa da página inicial
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium">
          <input type="checkbox" name="ativo" value="sim" defaultChecked={embaixador.ativo} className="h-4 w-4 accent-coral" />
          Aparece no site
        </label>
      </div>
      <p className="ajuda -mt-3">Do menor para o maior, na faixa e em /embaixadores. Empate vai pelo nome.</p>

      {estado?.erro && <p className="erro-campo">{estado.erro}</p>}
      <BotaoEnviar className="botao-coral" pendente={pendente} enviando="Salvando…">
        {embaixador.id ? "Salvar alterações" : "Cadastrar embaixador"}
      </BotaoEnviar>
    </form>
  );
}
