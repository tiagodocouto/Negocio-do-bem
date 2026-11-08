"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { abertoComoApp, ehAparelhoApple } from "@/lib/app";
import { enviarEvento } from "@/lib/medicao";

// O Chrome e o Edge (Android e computador) avisam que o site pode ser instalado
// com o evento beforeinstallprompt, que abre a janela de instalação quando a
// pessoa pede. O Safari não tem esse evento: no iPhone, o passo a passo de
// /instalacao/iphone mostra o caminho pelo menu Compartilhar.

type PedidoDeInstalacao = Event & { prompt: () => Promise<void> };

/** O que dá para oferecer: nada, o botão do navegador ou o passo a passo do iPhone. */
type Situacao = "nada" | "botao" | "iphone";

const CHAVE_DISPENSADO = "convite-app-dispensado";

let pedido: PedidoDeInstalacao | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

// Fora do componente, porque o navegador pode mandar o evento antes de a página hidratar.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (evento) => {
    pedido = evento as PedidoDeInstalacao;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    pedido = null;
    avisar();
    enviarEvento("app_instalado", {});
  });
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function situacao(): Situacao {
  if (abertoComoApp()) return "nada";
  if (pedido) return "botao";
  return ehAparelhoApple() ? "iphone" : "nada";
}

function dispensado(): boolean {
  try {
    return localStorage.getItem(CHAVE_DISPENSADO) === "sim";
  } catch {
    return false;
  }
}

function useSituacao() {
  return useSyncExternalStore(assinar, situacao, () => "nada" as Situacao);
}

async function instalar() {
  const atual = pedido;
  if (!atual) return;
  // Cada evento abre a janela uma vez só. Se a pessoa recusar, o navegador manda outro mais tarde.
  pedido = null;
  avisar();
  await atual.prompt();
}

/** Botão "Instalar o app" do rodapé, com um ícone de download: leva a /instalacao. Some quando o site já está aberto como app. */
export function InstalarApp() {
  // No servidor o botão vai na página, para os buscadores acharem /instalacao.
  const instalado = useSyncExternalStore(assinar, abertoComoApp, () => false);
  if (instalado) return null;

  return (
    <div>
      <Link href="/instalacao" className="botao-coral">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
        Instalar o app
      </Link>
    </div>
  );
}

/** Botão que abre a janela de instalação do navegador. Só aparece quando o navegador oferece. */
export function BotaoInstalarAgora() {
  const estado = useSituacao();
  if (estado !== "botao") return null;

  return (
    <div>
      <p>Ou, mais rápido, toque aqui. O botão já abre a instalação:</p>
      <button type="button" onClick={instalar} className="botao-coral mt-3">
        Instalar agora
      </button>
    </div>
  );
}

/** Cartão do painel que convida a instalar o app. Some com "Agora não" e quando o app já está instalado. */
export function ConviteParaInstalar({ className = "" }: { className?: string }) {
  const estado = useSituacao();
  const fechado = useSyncExternalStore(assinar, dispensado, () => true);

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "sim");
    } catch {
      // Sem localStorage, o cartão volta na próxima visita.
    }
    avisar();
  }

  if (estado === "nada" || fechado) return null;

  return (
    <div className={`cartao flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div>
        <h3 className="font-medium">Use como app</h3>
        <p className="mt-1 text-sm text-suave">
          {estado === "iphone"
            ? "No iPhone, a instalação é pelo menu Compartilhar do Safari. Leva menos de um minuto."
            : "Seu painel fica a um toque, direto da tela de início."}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {estado === "botao" ? (
          <button type="button" onClick={instalar} className="botao botao-pequeno">
            Instalar
          </button>
        ) : (
          <Link href="/instalacao/iphone" className="botao botao-pequeno">
            Ver como instalar
          </Link>
        )}
        <button type="button" onClick={dispensar} className="botao-claro botao-pequeno">
          Agora não
        </button>
      </div>
    </div>
  );
}
