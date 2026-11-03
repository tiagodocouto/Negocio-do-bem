import type { Metadata } from "next";
import { metadadosDaPagina } from "@/lib/seo";
import { AvisoJaInstalado } from "./AvisoJaInstalado";
import { EscolhaDoAparelho } from "./EscolhaDoAparelho";

export const metadata: Metadata = metadadosDaPagina({
  titulo: "Instale o app",
  descricao:
    "Instale o Negócio do Bem no seu celular, no iPhone ou no Android. É de graça, leva menos de um minuto e não precisa de loja de aplicativos.",
  caminho: "/instalacao",
});

const VANTAGENS = [
  { titulo: "Um toque para abrir", texto: "O ícone fica na tela de início, como qualquer app." },
  { titulo: "Tela inteira", texto: "Sem a barra de endereço do navegador." },
  { titulo: "Sempre atualizado", texto: "Não precisa baixar nada: ele se atualiza sozinho." },
];

export default function Instalacao() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Instale o app</p>
      <h1 className="mt-2 font-serif text-5xl leading-tight font-semibold tracking-tight text-balance">
        Qual é o seu celular?
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-suave">
        Escolha e veja o passo a passo. É de graça, leva menos de um minuto e não precisa de loja de aplicativos.
      </p>

      <AvisoJaInstalado />
      <EscolhaDoAparelho />

      <ul className="mt-12 grid gap-5 sm:grid-cols-3">
        {VANTAGENS.map(({ titulo, texto }) => (
          <li key={titulo}>
            <p className="font-semibold">{titulo}</p>
            <p className="mt-1 text-sm leading-relaxed text-suave">{texto}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
