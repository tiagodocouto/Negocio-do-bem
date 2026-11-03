import type { Metadata } from "next";
import Link from "next/link";
import { BotaoInstalarAgora } from "@/components/InstalarApp";
import { metadadosDaPagina } from "@/lib/seo";
import { AvisoJaInstalado } from "../AvisoJaInstalado";
import { CabecaDoTutorial, IconeDoApp, IconeTresPontos, Passo, Passos } from "../Passos";

export const metadata: Metadata = metadadosDaPagina({
  titulo: "Instale o app no Android",
  descricao: "Passo a passo para instalar o Negócio do Bem no celular Android, pelo Chrome.",
  caminho: "/instalacao/android",
});

export default function InstalacaoAndroid() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
      <CabecaDoTutorial aparelho="Android" titulo="Como instalar no Android">
        Use o Chrome, o navegador que já vem na maioria dos celulares Android.
      </CabecaDoTutorial>

      <AvisoJaInstalado />

      <Passos>
        <Passo numero={1} titulo="Abra o site no Chrome">
          <p>
            Abra <strong className="text-tinta">www.negociodobem.com</strong> no Chrome. Se você está lendo isto no Chrome do
            celular, este passo já está feito.
          </p>
        </Passo>
        <Passo numero={2} titulo="Peça para instalar">
          <p>
            Toque nos três pontinhos <IconeTresPontos /> do Chrome, no canto de cima, e escolha{" "}
            <strong className="text-tinta">Instalar app</strong> ou{" "}
            <strong className="text-tinta">Adicionar à tela inicial</strong>.
          </p>
          <BotaoInstalarAgora />
        </Passo>
        <Passo numero={3} titulo="Confirme em “Instalar”">
          <p>
            O Chrome abre uma janela com o nome e o ícone do app. Toque em <strong className="text-tinta">Instalar</strong>.
          </p>
        </Passo>
        <Passo numero={4} titulo="Pronto">
          <p>O ícone aparece na tela inicial ou na lista de aplicativos. Toque nele para abrir.</p>
          <IconeDoApp />
        </Passo>
      </Passos>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-folha-50 p-6">
          <h2 className="font-serif text-lg font-semibold text-folha">Dica: atalhos</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Segure o ícone do app por um segundo. Aparecem atalhos para ir direto a Explorar, Cadastrar ou ao seu Painel.
          </p>
        </div>
        <div className="cartao p-6">
          <h2 className="font-serif text-lg font-semibold">Usa outro navegador?</h2>
          <p className="mt-2 text-sm leading-relaxed text-suave">
            No Samsung Internet e em outros, procure no menu a opção de instalar ou de adicionar à tela inicial. Se não
            encontrar, abra o site no Chrome.
          </p>
        </div>
      </div>

      <p className="mt-10 text-sm text-suave">
        Tem um iPhone?{" "}
        <Link href="/instalacao/iphone" className="link">
          Veja o passo a passo do iPhone
        </Link>
        .
      </p>
    </div>
  );
}
