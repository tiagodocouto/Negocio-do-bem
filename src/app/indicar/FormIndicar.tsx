"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { indicarEmpresa } from "@/acoes/empresas";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { enviarSemLimpar } from "@/components/envio";
import { Campo } from "@/components/Campo";
import { CampoMunicipio } from "@/components/CampoMunicipio";
import { SeletorCausas } from "@/components/SeletorCausas";
import { CATEGORIAS } from "@/lib/dominio";

export function FormIndicar() {
  const [estado, acao, pendente] = useActionState(indicarEmpresa, undefined);
  const erros = estado?.erros ?? {};
  const valores = estado?.valores ?? {};
  const valor = (campo: string) => (typeof valores[campo] === "string" ? (valores[campo] as string) : "");
  const causas = Array.isArray(valores.causas) ? valores.causas : [];
  const [souDono, setSouDono] = useState(valor("souDono") === "sim");

  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="cartao space-y-6 p-6 sm:p-8">
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-papel p-4">
        <input
          type="checkbox"
          name="souDono"
          value="sim"
          checked={souDono}
          onChange={(e) => setSouDono(e.target.checked)}
          className="mt-1 h-4 w-4 accent-coral"
        />
        <span>
          <span className="block font-medium">Este negócio é meu</span>
          <span className="block text-sm text-suave">
            Depois de cadastrar, você envia os dados do negócio e já pode editar o perfil.
          </span>
        </span>
      </label>

      <Campo rotulo="@ do Instagram" erro={erros.instagram} id="instagram">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-suave">@</span>
          <input id="instagram" name="instagram" required maxLength={80} placeholder="padariadobairro" defaultValue={valor("instagram")} className="campo pl-8" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </div>
      </Campo>
      {estado?.existente && (
        <p className="-mt-3 text-sm">
          <Link href={`/empresas/${estado.existente}`} className="link">
            Ver o perfil de @{estado.existente} →
          </Link>
        </p>
      )}

      <Campo rotulo="Nome do negócio" erro={erros.nome} id="nome">
        <input id="nome" name="nome" required maxLength={80} defaultValue={valor("nome")} className="campo" />
      </Campo>

      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        <Campo rotulo="Categoria" erro={erros.categoria} id="categoria">
          <select id="categoria" name="categoria" required defaultValue={valor("categoria")} className="campo">
            <option value="" disabled>
              Escolha…
            </option>
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Campo>
        <CampoMunicipio valorInicial={valor("municipio")} erro={erros.municipio} />
      </div>

      <Campo rotulo="Em uma frase, o que este negócio faz?" erro={erros.resumo} id="resumo" ajuda="Até 160 caracteres.">
        <input id="resumo" name="resumo" required maxLength={160} placeholder="Padaria artesanal que contrata gente do próprio bairro" defaultValue={valor("resumo")} className="campo" />
      </Campo>

      <div className="space-y-4">
        <div>
          <p className="rotulo">Contato (opcional)</p>
          <p className="ajuda mt-0">Os canais públicos do negócio, como aparecem no site ou no Instagram. Viram botões no perfil.</p>
        </div>
        <Campo rotulo="Site" erro={erros.site} id="site">
          <input id="site" name="site" maxLength={200} placeholder="www.negocio.com.br" defaultValue={valor("site")} className="campo" />
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo rotulo="WhatsApp" erro={erros.whatsapp} id="whatsapp">
            <input id="whatsapp" name="whatsapp" type="tel" maxLength={30} placeholder="(11) 99999-9999" defaultValue={valor("whatsapp")} className="campo" />
          </Campo>
          <Campo rotulo="E-mail" erro={erros.emailContato} id="emailContato">
            <input id="emailContato" name="emailContato" type="email" maxLength={200} placeholder="contato@negocio.com.br" defaultValue={valor("emailContato")} className="campo" />
          </Campo>
        </div>
      </div>

      {!souDono && (
        <Campo rotulo="Por que você indica? (opcional)" erro={erros.motivo} id="motivo" ajuda="Aparece no perfil até o dono contar a própria história.">
          <textarea id="motivo" name="motivo" rows={3} maxLength={600} defaultValue={valor("motivo")} className="campo" />
        </Campo>
      )}

      <div>
        <p className="rotulo">Quais causas este negócio abraça?</p>
        <p className="ajuda mt-0 mb-3">Marque só o que você sabe que é verdade. O dono pode ajustar depois.</p>
        <SeletorCausas selecionadas={causas} />
      </div>

      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <BotaoEnviar pendente={pendente} className="botao-coral w-full py-3 text-base" enviando="Enviando…">
        {souDono ? "Cadastrar e verificar meu negócio" : "Enviar indicação"}
      </BotaoEnviar>
    </form>
  );
}
