import type { Metadata } from "next";
import Link from "next/link";
import { metadadosDaPagina } from "@/lib/seo";
import { AvisoJaInstalado } from "../AvisoJaInstalado";
import { CabecaDoTutorial, IconeAdicionar, IconeCompartilhar, IconeDoApp, IconeTresPontos, Passo, Passos } from "../Passos";

export const metadata: Metadata = metadadosDaPagina({
  titulo: "Instale o app no iPhone",
  descricao: "Passo a passo para instalar o Negócio do Bem no iPhone e no iPad, pelo Safari.",
  caminho: "/instalacao/iphone",
});

export default function InstalacaoIphone() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
      <CabecaDoTutorial aparelho="iPhone e iPad" titulo="Como instalar no iPhone">
        No iPhone e no iPad, o app é instalado pelo menu Compartilhar do Safari.
      </CabecaDoTutorial>

      <AvisoJaInstalado />

      <Passos>
        <Passo numero={1} titulo="Abra o site no Safari">
          <p>
            Abra <strong className="text-tinta">www.negociodobem.com</strong> no Safari. Se você está lendo isto no Safari
            do iPhone, este passo já está feito.
          </p>
        </Passo>
        <Passo
          numero={2}
          titulo={
            <>
              Toque em Compartilhar <IconeCompartilhar />
            </>
          }
        >
          <p>
            É o quadrado com uma seta para cima, na barra do Safari. Em algumas versões do iPhone, ele fica dentro do
            botão <IconeTresPontos deitado /> da barra.
          </p>
        </Passo>
        <Passo
          numero={3}
          titulo={
            <>
              Toque em “Adicionar à Tela de Início” <IconeAdicionar />
            </>
          }
        >
          <p>Se a opção não aparecer de cara, role a lista para baixo.</p>
        </Passo>
        <Passo numero={4} titulo="Toque em “Adicionar”">
          <p>
            Confira o nome, <strong className="text-tinta">Negócio do Bem</strong>, e toque em Adicionar, no canto de cima.
            O ícone aparece na tela de início.
          </p>
          <IconeDoApp />
        </Passo>
      </Passos>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-coral-50 p-6">
          <h2 className="font-serif text-lg font-semibold text-coral-700">Importante: entre na sua conta de novo</h2>
          <p className="mt-2 text-sm leading-relaxed">
            No iPhone, o app guarda o login separado do Safari. Na primeira vez que abrir o app, entre na sua conta outra
            vez, pelo Google ou com e-mail e senha. O “link por e-mail” sempre abre no Safari.
          </p>
        </div>
        <div className="cartao p-6">
          <h2 className="font-serif text-lg font-semibold">Usa outro navegador?</h2>
          <p className="mt-2 text-sm leading-relaxed text-suave">
            No Chrome do iPhone, o caminho é parecido: Compartilhar, na barra de endereço, e depois Adicionar à Tela de
            Início. Se não encontrar, abra o site no Safari.
          </p>
        </div>
      </div>

      <p className="mt-10 text-sm text-suave">
        Tem um Android?{" "}
        <Link href="/instalacao/android" className="link">
          Veja o passo a passo do Android
        </Link>
        .
      </p>
    </div>
  );
}
