"use client";

import { useActionState, useState } from "react";
import { salvarEmpresa } from "@/acoes/empresas";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { enviarSemLimpar } from "@/components/envio";
import { Campo } from "@/components/Campo";
import { CampoMunicipio } from "@/components/CampoMunicipio";
import { EditorHistoria } from "@/components/EditorHistoria";
import { Historia } from "@/components/Historia";
import { SeletorCausas } from "@/components/SeletorCausas";
import { CATEGORIAS } from "@/lib/dominio";
import { formatarMunicipio } from "@/lib/texto";

type DadosEmpresa = {
  id: string;
  nome: string;
  resumo: string;
  categoria: string;
  cidade: string;
  uf: string;
  site: string;
  whatsapp: string;
  emailContato: string;
  telefoneComercial: string;
  emailDoDono: string;
  telefoneDoDono: string;
  historia: string;
  causas: string[];
};

/** `voltar` é a página que abre depois de salvar: o painel do dono ou a edição na moderação. */
export function FormEmpresa({ empresa, voltar }: { empresa: DadosEmpresa; voltar: string }) {
  const [estado, acao, pendente] = useActionState(salvarEmpresa, undefined);
  const erros = estado?.erros ?? {};
  const valores = estado?.valores;
  const valor = (campo: keyof DadosEmpresa) => {
    const v = valores?.[campo];
    return typeof v === "string" ? v : String(empresa[campo]);
  };
  const causas = Array.isArray(valores?.causas) ? valores.causas : empresa.causas;
  const [historia, setHistoria] = useState(empresa.historia);
  const [aba, setAba] = useState<"escrever" | "ver">("escrever");

  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="space-y-8">
      <input type="hidden" name="empresaId" value={empresa.id} />
      <input type="hidden" name="voltar" value={voltar} />

      <section className="cartao space-y-5 p-6 sm:p-8">
        <h2 className="font-serif text-2xl font-semibold">Informações</h2>
        <Campo id="nome" rotulo="Nome do negócio" erro={erros.nome}>
          <input id="nome" name="nome" required maxLength={80} defaultValue={valor("nome")} className="campo" />
        </Campo>
        <Campo id="resumo" rotulo="Em uma frase" erro={erros.resumo} ajuda="Aparece nos cards do diretório. Até 160 caracteres.">
          <input id="resumo" name="resumo" required maxLength={160} defaultValue={valor("resumo")} className="campo" />
        </Campo>
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <Campo id="categoria" rotulo="Categoria" erro={erros.categoria}>
            <select id="categoria" name="categoria" defaultValue={valor("categoria")} className="campo">
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Campo>
          <CampoMunicipio
            valorInicial={typeof valores?.municipio === "string" ? valores.municipio : formatarMunicipio(empresa.cidade, empresa.uf)}
            erro={erros.municipio}
          />
        </div>
      </section>

      <section className="cartao space-y-5 p-6 sm:p-8">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Contato</h2>
          <p className="mt-1 text-sm text-suave">O que você preencher vira botão no perfil.</p>
        </div>
        <Campo id="telefoneComercial" rotulo="Telefone comercial" erro={erros.telefoneComercial}>
          <input id="telefoneComercial" name="telefoneComercial" type="tel" maxLength={30} placeholder="(11) 3333-4444" defaultValue={valor("telefoneComercial")} className="campo" />
        </Campo>
        <Campo id="site" rotulo="Site" erro={erros.site}>
          <input id="site" name="site" maxLength={200} placeholder="www.meunegocio.com.br" defaultValue={valor("site")} className="campo" />
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo id="whatsapp" rotulo="WhatsApp" erro={erros.whatsapp}>
            <input id="whatsapp" name="whatsapp" type="tel" maxLength={30} placeholder="(11) 99999-9999" defaultValue={valor("whatsapp")} className="campo" />
          </Campo>
          <Campo id="emailContato" rotulo="E-mail de contato" erro={erros.emailContato}>
            <input id="emailContato" name="emailContato" type="email" maxLength={200} placeholder="contato@meunegocio.com.br" defaultValue={valor("emailContato")} className="campo" />
          </Campo>
        </div>
      </section>

      <section className="cartao space-y-5 p-6 sm:p-8">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Contato do dono</h2>
          <p className="mt-1 text-sm text-suave">Não aparece no perfil: só os donos e a moderação veem.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo id="emailDoDono" rotulo="E-mail" erro={erros.emailDoDono}>
            <input id="emailDoDono" name="emailDoDono" type="email" maxLength={200} placeholder="voce@email.com" defaultValue={valor("emailDoDono")} className="campo" />
          </Campo>
          <Campo id="telefoneDoDono" rotulo="Telefone" erro={erros.telefoneDoDono}>
            <input id="telefoneDoDono" name="telefoneDoDono" type="tel" maxLength={30} placeholder="(11) 99999-9999" defaultValue={valor("telefoneDoDono")} className="campo" />
          </Campo>
        </div>
      </section>

      <section className="cartao space-y-4 p-6 sm:p-8">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Causas que vocês abraçam</h2>
          <p className="mt-1 text-sm text-suave">Elas viram selos no perfil e filtros na busca. Marque só o que é verdade no dia a dia.</p>
        </div>
        <SeletorCausas key={causas.join()} selecionadas={causas} />
      </section>

      <section className="cartao p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Nossa história</h2>
            <p className="mt-1 text-sm text-suave">Como tudo começou, o que move vocês, quem faz acontecer.</p>
          </div>
          <div className="flex rounded-full bg-papel p-1 text-sm" role="tablist">
            {(["escrever", "ver"] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                role="tab"
                aria-selected={aba === opcao}
                onClick={() => setAba(opcao)}
                className={`rounded-full px-4 py-1.5 font-medium transition ${aba === opcao ? "bg-superficie shadow-sm" : "text-suave"}`}
              >
                {opcao === "escrever" ? "Escrever" : "Pré-visualizar"}
              </button>
            ))}
          </div>
        </div>

        <input type="hidden" name="historia" value={historia} />
        {/* Escondido, e não desmontado, para não perder o desfazer ao ir e voltar da pré-visualização. */}
        <div className={`mt-5 ${aba === "escrever" ? "" : "hidden"}`}>
          <EditorHistoria empresaId={empresa.id} valorInicial={empresa.historia} aoMudar={setHistoria} />
        </div>
        {aba === "ver" && (
          <div className="mt-5 min-h-48 rounded-2xl border border-linha p-6">
            {historia.trim() ? <Historia markdown={historia} /> : <p className="text-suave italic">Nada escrito ainda.</p>}
          </div>
        )}
        {erros.historia && <p className="erro-campo">{erros.historia}</p>}
        <p className="ajuda">
          Selecione um trecho e use a barra para títulos, negrito, links e citações. As fotos entram onde está o cursor,
          e a legenda vai logo embaixo delas. O ✦ separa capítulos.
        </p>
      </section>

      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado?.erros && Object.keys(estado.erros).length > 0 && <Aviso tipo="erro">Confira os campos destacados acima.</Aviso>}

      <div className="sticky bottom-4 z-10 flex justify-end">
        <BotaoEnviar pendente={pendente} className="botao-coral px-8 py-3 text-base shadow-lg shadow-coral/20" enviando="Salvando…">
          Salvar alterações
        </BotaoEnviar>
      </div>
    </form>
  );
}
