import type { Metadata } from "next";
import Link from "next/link";
import { CausaBadge } from "@/components/CausaBadge";
import { CAUSAS, GRUPOS, type GrupoCausa } from "@/lib/causas";
import { hrefCausa } from "@/lib/diretorio";
import { REPOSITORIO } from "@/lib/dominio";
import { metadadosDaPagina } from "@/lib/seo";

export const metadata: Metadata = metadadosDaPagina({
  titulo: "Como funciona",
  descricao: "O que é o Negócio do Bem, como os donos assumem seus perfis e como cuidamos da privacidade.",
  caminho: "/sobre",
});

export default function Sobre() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Manifesto</p>
      <h1 className="mt-2 font-serif text-5xl leading-tight font-semibold tracking-tight text-balance">
        Escolher onde gastar também é escolher o mundo que a gente quer.
      </h1>

      <div className="historia mt-8">
        <p>
          O Negócio do Bem nasceu para dar visibilidade a quem cuida das pessoas, da comunidade e do planeta. Quando
          negócios são atacados por defenderem o respeito e a dignidade, a melhor resposta é coletiva: encontrar,
          indicar e fortalecer quem faz o bem.
        </p>
        <p>
          Aqui não existe ranking nem anúncio pago. Existe a comunidade dizendo &ldquo;esse lugar faz diferença&rdquo; e os
          próprios donos contando suas histórias.
        </p>

        <h2>Como funciona</h2>
        <ol>
          <li>
            <strong>Alguém indica</strong> um negócio pelo @ do Instagram e conta por que ele faz o bem. O perfil entra no
            ar na hora, e a moderação tira do ar o que for spam ou perfil falso.
          </li>
          <li>
            <strong>O dono assume o perfil</strong> enviando os dados do negócio. A partir daí, ele cuida das
            informações. A moderação também pode corrigir qualquer perfil, e cada mudança fica registrada.
          </li>
          <li>
            <strong>A comunidade fortalece</strong> deixando depoimentos e buscando pelas causas que importam.
          </li>
        </ol>

        <h2 id="dono" className="scroll-mt-24">
          Para donos de negócio
        </h2>
        <p>
          Procure seu negócio no{" "}
          <Link href="/explorar">diretório</Link> e clique em <strong>&ldquo;Sou o dono&rdquo;</strong>. Se ele ainda não
          estiver lá, <Link href="/participar?dono=sim">cadastre</Link> pelo @ do Instagram e escolha &ldquo;Sou dono
          deste negócio&rdquo;. Sem Instagram também dá.
        </p>
        <p>
          Depois, envie os dados do negócio: CNPJ ou MEI (se tiver), site e um contato. Se ninguém assumiu o perfil
          ainda, ele passa a ser seu na hora, e você já pode editá-lo no painel.
        </p>
        <p>
          Se outra pessoa já assumiu o seu perfil, use a mesma página para pedir a revisão. Qualquer disputa vai para a
          moderação, e todas as decisões ficam registradas.
        </p>

        <h2 id="privacidade" className="scroll-mt-24">
          Privacidade e remoção
        </h2>
        <p>
          <strong>Meu negócio foi indicado e eu não quero aparecer.</strong> Sem problema: assuma o perfil como explicado
          acima e, no painel, clique em &ldquo;Ocultar meu negócio&rdquo;. Ele sai do diretório na hora.
        </p>
        <p>
          <strong>Que dados vocês guardam?</strong> Da sua conta, nome, e-mail e telefone. O e-mail e o telefone nunca
          aparecem no site: só a moderação vê. O e-mail serve para você entrar e para receber avisos sobre os seus
          pedidos e o seu negócio, como a decisão da moderação ou um depoimento novo. O telefone serve só para esses
          avisos, nunca para divulgação. Se você entra com o Google, guardamos também o número que o
          Google dá à sua conta, para reconhecê-la da próxima vez. Dos negócios, só o que aparece no perfil:
          textos, fotos e contatos públicos.
          Não fazemos raspagem do Instagram e não guardamos tokens de acesso.
        </p>
        <p>
          <strong>Vocês medem as visitas?</strong> Sim, com o Google Analytics, para saber quantas pessoas visitam o site e
          quais páginas e buscas são mais comuns. Ele usa cookies no seu navegador e não recebe seu nome nem seu e-mail.
        </p>
        <p>
          <strong>E os depoimentos?</strong> Ficam no ar com o nome de quem escreveu. Donos podem responder, mas não
          apagar. Conteúdo ofensivo pode ser denunciado e é avaliado pela moderação.
        </p>

        <h2 id="codigo-aberto" className="scroll-mt-24">
          Código aberto
        </h2>
        <p>
          O Negócio do Bem é um projeto de código aberto, com licença MIT. Todo o código está no{" "}
          <a href={REPOSITORIO} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          : qualquer pessoa pode conferir como o site funciona e como os dados são tratados, sugerir melhorias ou
          contribuir.
        </p>

        <h2>As causas</h2>
        <p>
          Cada negócio marca as causas que vive no dia a dia. Elas aparecem como selos no perfil e servem de filtro na
          busca.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {(Object.keys(GRUPOS) as GrupoCausa[]).map((grupo) => (
          <section key={grupo}>
            <h3 className="font-serif text-xl font-semibold">{GRUPOS[grupo]}</h3>
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAUSAS.filter((c) => c.grupo === grupo).map((causa) => (
                <li key={causa.slug} className="cartao p-4">
                  <Link href={hrefCausa(causa.slug)} className="transition hover:opacity-80">
                    <CausaBadge slug={causa.slug} />
                  </Link>
                  <p className="mt-2 text-sm text-suave">{causa.descricao}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
