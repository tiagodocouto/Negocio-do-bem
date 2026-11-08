import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Passo, Passos } from "@/components/Passos";
import { EMAIL_DO_PROJETO } from "@/lib/dominio";
import { DIAS_MAXIMOS } from "@/lib/ofertas";
import { metadadosDaPagina } from "@/lib/seo";

export const metadata: Metadata = metadadosDaPagina({
  titulo: "Clube do Bem: como funcionam os cupons",
  descricao:
    "Passo a passo do Clube do Bem: como gerar e usar um cupom de desconto e como o dono cria a oferta e confere o cupom no balcão. De graça, com negócios verificados.",
  caminho: "/clube-do-bem",
});

// Os prints ficam em public/prints/clube-do-bem, em WebP com o dobro da largura em
// que aparecem. Largura e altura daqui são as do print na tela, em CSS.
const PRINTS = {
  "cliente-1-selo-no-diretorio": [358, 291],
  "cliente-2-cartao-do-clube": [358, 309],
  "cliente-3-gerar-cupom": [358, 349],
  "cliente-4-seu-cupom": [358, 397],
  "cliente-5-meus-cupons": [390, 780],
  "dono-0-chamada-no-painel": [358, 192],
  "dono-1-verifique-o-negocio": [358, 465],
  "dono-1b-pedido-em-analise": [358, 260],
  "dono-2-criar-oferta": [358, 1001],
  "dono-3-oferta-no-ar": [358, 300],
  "dono-4-conferir-cupom": [358, 245],
  "dono-5-cupom-usado": [358, 377],
  "dono-6-cupom-repetido": [358, 193],
} as const;

/** Um print da tela. `largura` é a largura máxima na página, menor nos prints compridos. */
function Print({ nome, alt, legenda, largura }: { nome: keyof typeof PRINTS; alt: string; legenda?: string; largura?: number }) {
  const [w, h] = PRINTS[nome];
  return (
    <figure className="pt-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/prints/clube-do-bem/${nome}.webp`}
        alt={alt}
        width={w}
        height={h}
        loading="lazy"
        decoding="async"
        style={{ maxWidth: largura ?? w }}
        className="h-auto w-full rounded-3xl shadow-lg ring-1 shadow-tinta/5 ring-linha"
      />
      {legenda && <figcaption className="mt-2 text-sm text-suave">{legenda}</figcaption>}
    </figure>
  );
}

function Destaque({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-tinta">{children}</strong>;
}

const CAMINHOS = [
  {
    href: "#para-quem-compra",
    titulo: "Quero usar um cupom",
    detalhe: "Para quem compra: como achar, gerar e usar o cupom.",
  },
  {
    href: "#para-negocios",
    titulo: "Tenho um negócio",
    detalhe: "Para donos: como criar a oferta e conferir o cupom no balcão.",
  },
];

const PROTECOES = [
  {
    titulo: "CNPJ conferido na Receita",
    texto: "Só participa negócio com CNPJ ativo. A moderação confere a ficha na Receita e o quadro de sócios antes de liberar.",
  },
  {
    titulo: "Cada dono liberado pelo nome",
    texto: "Quem cria ofertas é liberado um a um, depois de a moderação conferir se o nome da conta bate com a ficha do CNPJ.",
  },
  {
    titulo: "Contato trocado, oferta parada",
    texto:
      "Se o WhatsApp, o telefone, o site ou o e-mail do perfil mudar, as ofertas param até a moderação verificar o negócio de novo. Assim, ninguém assume um perfil para soltar cupom falso.",
  },
  {
    titulo: "Nunca pedimos Pix",
    texto:
      "Nenhum cupom é liberado por pagamento. O desconto vale na hora da compra. Se alguém pedir Pix em nome do clube, é golpe: não pague.",
  },
];

const DUVIDAS = [
  {
    pergunta: "Quanto custa?",
    resposta: "Nada. O Clube do Bem é de graça para quem compra e para quem tem negócio.",
  },
  {
    pergunta: "Preciso de conta para usar um cupom?",
    resposta:
      "Para ver as ofertas, não. Para gerar o cupom, sim: assim cada pessoa gera um só por oferta. Criar a conta é de graça.",
  },
  {
    pergunta: "Posso usar o mesmo cupom duas vezes?",
    resposta: "Não. Cada cupom vale uma vez. Depois de usado, ele vai para “Usados e vencidos”, em Meus cupons.",
  },
  {
    pergunta: "Até quando o cupom vale?",
    resposta: `Até o último dia da oferta, às 23h59 de Brasília. Uma oferta dura no máximo ${DIAS_MAXIMOS} dias. Se o dono encerrar a oferta antes, quem já gerou o cupom ainda pode usar até o último dia previsto.`,
  },
  {
    pergunta: "O que o negócio fica sabendo sobre mim?",
    resposta:
      "Só o seu primeiro nome, quando ele confere o cupom. O seu e-mail e o seu telefone não aparecem para ele. No perfil, o público vê só quantas pessoas favoritaram o negócio, nunca quem.",
  },
  {
    pergunta: "O negócio não aceitou o meu cupom. E agora?",
    resposta: `Confira se a oferta ainda vale e se você está usando onde ela vale: no local, pelo WhatsApp ou pelo site. Se ainda assim não deu certo, escreva para ${EMAIL_DO_PROJETO} contando o que aconteceu.`,
  },
  {
    pergunta: "Meu negócio não tem CNPJ. Posso participar?",
    resposta:
      "Por enquanto, não: o CNPJ é o que permite conferir quem é o dono. Estamos estudando um jeito seguro de verificar autônomos e profissionais liberais.",
  },
  {
    pergunta: "Posso mudar a oferta depois de publicar?",
    resposta:
      "Não. Assim ninguém troca as regras depois que as pessoas geraram o cupom. Para mudar, encerre a oferta e crie outra. Os cupons já gerados continuam valendo até o último dia da oferta encerrada.",
  },
];

export default function ClubeDoBem() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">🎟️ Clube do Bem</p>
      <h1 className="mt-2 font-serif text-5xl leading-tight font-semibold tracking-tight text-balance">
        Cupons de quem faz o bem
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-suave">
        Negócios verificados oferecem descontos por poucos dias para quem chega pelo Negócio do Bem. É de graça, para quem
        compra e para quem vende.
      </p>

      <nav aria-label="Escolha o seu caminho" className="mt-10 grid gap-3 sm:grid-cols-2 sm:gap-5">
        {CAMINHOS.map(({ href, titulo, detalhe }) => (
          <a
            key={href}
            href={href}
            className="cartao flex flex-col p-6 transition hover:border-tinta/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          >
            <span className="font-serif text-2xl font-semibold">{titulo}</span>
            <span className="mt-1 text-sm text-suave">{detalhe}</span>
            <span className="mt-4 text-sm font-semibold text-coral-700">Ver o passo a passo&nbsp;↓</span>
          </a>
        ))}
      </nav>

      <section aria-labelledby="para-quem-compra" className="mt-16">
        <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Para quem compra</p>
        <h2 id="para-quem-compra" className="mt-2 scroll-mt-24 font-serif text-4xl font-semibold tracking-tight">
          Como usar um cupom
        </h2>
        <p className="mt-3 leading-relaxed text-suave">
          Você só precisa de uma conta no Negócio do Bem.{" "}
          <Link href="/entrar" className="link">
            Entre ou crie a sua
          </Link>
          , é de graça.
        </p>

        <Passos>
          <Passo nivel="h3" numero={1} titulo="Ache um negócio com cupom">
            <p>
              No <Link href="/explorar" className="link">Explorar</Link>, os negócios com oferta valendo têm o selo{" "}
              <Destaque>🎟️ Cupom</Destaque>.
            </p>
            <Print nome="cliente-1-selo-no-diretorio" alt="Cartão da Padaria Florescer no Explorar, com o selo Cupom" />
            <p className="pt-3">
              No perfil do negócio, a oferta aparece no cartão <Destaque>Clube do Bem</Destaque>: o desconto, onde ele vale,
              quanto tempo falta e quantos cupons restam.
            </p>
            <Print
              nome="cliente-2-cartao-do-clube"
              alt="Cartão do Clube do Bem no perfil, com a oferta de 15% no pão de fermentação natural e o botão Entre para gerar o cupom"
            />
          </Passo>

          <Passo nivel="h3" numero={2} titulo="Gere o seu cupom">
            <p>
              Já na sua conta, toque em <Destaque>Favoritar e gerar cupom</Destaque>. O negócio entra nos seus favoritos, para
              você acompanhar as próximas ofertas. Cada pessoa gera um cupom por oferta.
            </p>
            <Print nome="cliente-3-gerar-cupom" alt="Cartão da oferta com o botão Favoritar e gerar cupom" />
            <p className="pt-3">Pronto: o seu código aparece na hora, com 6 letras e números.</p>
            <Print nome="cliente-4-seu-cupom" alt="Cartão da oferta mostrando o cupom gerado, com o código FAJ76A" />
          </Passo>

          <Passo nivel="h3" numero={3} titulo="Mostre o código na hora da compra">
            <p>
              Mostre a tela ou diga o código ao negócio, no lugar onde a oferta vale: no local, pelo WhatsApp ou pelo site. O
              negócio confere o código e dá o desconto. Não é preciso pagar nada antes.
            </p>
          </Passo>

          <Passo nivel="h3" numero={4} titulo="Encontre os seus cupons em Meus cupons">
            <p>
              No menu da sua conta, <Destaque>Meus cupons</Destaque> guarda os cupons valendo e, mais abaixo, os já usados e os
              vencidos.
            </p>
            <Print
              nome="cliente-5-meus-cupons"
              alt="Página Meus cupons, com um cupom valendo e dois já usados"
              largura={300}
            />
          </Passo>
        </Passos>

        <div className="mt-10 rounded-3xl bg-folha-50 p-6">
          <h3 className="font-serif text-lg font-semibold text-folha">Bom saber</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            <li>O cupom vale uma vez só, até o último dia da oferta.</li>
            <li>Algumas ofertas têm limite de cupons: quando acabam, acabou.</li>
            <li>Quem garante o desconto é o negócio. O Negócio do Bem nunca pede Pix nem pagamento para liberar cupom.</li>
            <li>Na hora de conferir, o negócio vê só o seu primeiro nome.</li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="para-negocios" className="mt-20">
        <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Para donos de negócio</p>
        <h2 id="para-negocios" className="mt-2 scroll-mt-24 font-serif text-4xl font-semibold tracking-tight">
          Como oferecer cupons
        </h2>
        <p className="mt-3 leading-relaxed text-suave">
          Você cria a oferta, a comunidade gera os cupons e você confere cada um no balcão. Tudo pelo painel do seu negócio,
          de graça.
        </p>

        <Passos>
          <Passo nivel="h3" numero={1} titulo="Verifique o seu negócio com o CNPJ">
            <p>
              Participa negócio com <Destaque>CNPJ ativo na Receita</Destaque>, e o MEI também conta. Antes, é preciso{" "}
              <Link href="/sobre#dono" className="link">
                assumir o perfil do negócio
              </Link>
              . Depois, no painel do negócio, toque em <Destaque>Verificar meu negócio</Destaque>.
            </p>
            <Print nome="dono-0-chamada-no-painel" alt="Caixa do painel: Ofereça cupons no Clube do Bem, com o botão Verificar meu negócio" />
            <p className="pt-3">
              Informe o CNPJ e toque em <Destaque>Pedir a verificação</Destaque>. Se você mandou o CNPJ quando assumiu o perfil,
              ele já vem preenchido. Só a moderação vê esse número.
            </p>
            <Print
              nome="dono-1-verifique-o-negocio"
              alt="Painel do clube: Verifique o seu negócio para criar ofertas, com o campo do CNPJ e o botão Pedir a verificação"
            />
            <p className="pt-3">
              A moderação confere a ficha na Receita, o quadro de sócios e se o seu nome bate com o da ficha. Enquanto isso, o
              painel mostra o pedido em análise. Se ela não aprovar, você vê o motivo e pode pedir de novo.
            </p>
            <Print nome="dono-1b-pedido-em-analise" alt="Painel do clube: a moderação está conferindo o seu negócio, com a data e o CNPJ do pedido" />
          </Passo>

          <Passo nivel="h3" numero={2} titulo="Crie a oferta">
            <p>
              No painel do negócio, toque em <Destaque>Clube do Bem</Destaque> e preencha:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <Destaque>Título:</Destaque> curto e claro, como “15% no pão de fermentação natural”.
              </li>
              <li>
                <Destaque>Tipo e quanto:</Destaque> desconto em %, desconto em reais ou um brinde.
              </li>
              <li>
                <Destaque>Condições,</Destaque> se tiver. Sem links, telefones nem Pix: o contato é sempre o do perfil.
              </li>
              <li>
                <Destaque>Onde vale:</Destaque> no local, pelo WhatsApp ou pelo site.
              </li>
              <li>
                <Destaque>Último dia:</Destaque> até {DIAS_MAXIMOS} dias, contando hoje. A oferta termina às 23h59.
              </li>
              <li>
                <Destaque>Limite de cupons,</Destaque> se quiser, como “os 50 primeiros”.
              </li>
            </ul>
            <Print
              nome="dono-2-criar-oferta"
              alt="Formulário Criar uma oferta preenchido: 15% no pão de fermentação natural, no local, até 12/11/2026, limite de 50 cupons"
              largura={300}
            />
          </Passo>

          <Passo nivel="h3" numero={3} titulo="A oferta entra no ar">
            <p>
              Ela aparece no perfil do negócio, com o selo <Destaque>Parceiro do Clube do Bem</Destaque>, e no Explorar, com o
              selo <Destaque>🎟️ Cupom</Destaque>. No painel, você acompanha quantos cupons foram gerados e quantos foram usados.
            </p>
            <Print nome="dono-3-oferta-no-ar" alt="Painel com a oferta valendo agora: 1 cupom gerado de 50, 0 usados" />
            <p className="pt-3">
              É uma oferta por vez, e ela não muda depois de publicada. Para trocar, toque em{" "}
              <Destaque>Encerrar a oferta</Destaque> e crie outra.
            </p>
          </Passo>

          <Passo nivel="h3" numero={4} titulo="Confira o cupom no balcão">
            <p>
              Em <Destaque>Validar um cupom</Destaque>, digite o código que a pessoa mostrou e toque em{" "}
              <Destaque>Conferir</Destaque>. Se aparecer <Destaque>Válido</Destaque>, com o primeiro nome da pessoa, toque em{" "}
              <Destaque>Marcar como usado</Destaque>.
            </p>
            <Print nome="dono-4-conferir-cupom" alt="Cupom FAJ76A conferido: válido, de Bia, com o botão Marcar como usado" />
            <p className="pt-3">
              Quando aparecer <Destaque>Usado agora. Pode dar o desconto.</Destaque>, é só dar o desconto.
            </p>
            <Print nome="dono-5-cupom-usado" alt="Cupom FAJ76A marcado: Usado agora. Pode dar o desconto." />
          </Passo>

          <Passo nivel="h3" numero={5} titulo="Código repetido não passa">
            <p>
              Cada cupom vale uma vez. Se alguém mostrar um código já usado, vencido ou de outro negócio, a tela avisa e não
              deixa marcar de novo.
            </p>
            <Print nome="dono-6-cupom-repetido" alt="Cupom FAJ76A conferido de novo: Já usado em 06/11/2026, 20:29" />
          </Passo>
        </Passos>

        <div className="mt-10 cartao p-6">
          <h3 className="font-serif text-lg font-semibold">Cuidados</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-suave">
            <li>
              Se você trocar o WhatsApp, o telefone, o site ou o e-mail de contato do perfil, a sua liberação e a oferta ficam
              suspensas. Para voltar, peça a verificação de novo no painel do clube. Isso protege o seu negócio de quem tentar
              assumir o perfil para aplicar golpe.
            </li>
            <li>Não peça Pix nem pagamento adiantado para liberar o cupom: o desconto é na hora da compra.</li>
            <li>Cumpra o que a oferta promete. É a confiança da comunidade que faz o clube funcionar.</li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="seguranca" className="mt-20">
        <h2 id="seguranca" className="scroll-mt-24 font-serif text-3xl font-semibold tracking-tight">
          Como a gente evita golpe
        </h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
          {PROTECOES.map(({ titulo, texto }) => (
            <li key={titulo} className="cartao p-5">
              <p className="font-semibold">{titulo}</p>
              <p className="mt-1 text-sm leading-relaxed text-suave">{texto}</p>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm leading-relaxed text-suave">
          Viu algo estranho? Escreva para{" "}
          <a href={`mailto:${EMAIL_DO_PROJETO}?subject=Clube do Bem`} className="link">
            {EMAIL_DO_PROJETO}
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="duvidas" className="mt-20">
        <h2 id="duvidas" className="scroll-mt-24 font-serif text-3xl font-semibold tracking-tight">
          Dúvidas
        </h2>
        <div className="mt-6 space-y-3">
          {DUVIDAS.map(({ pergunta, resposta }) => (
            <details key={pergunta} className="group cartao p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {pergunta}
                <span aria-hidden="true" className="text-2xl font-normal text-suave transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 leading-relaxed text-suave">{resposta}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
