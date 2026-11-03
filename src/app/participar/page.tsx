import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FotoEmpresa } from "@/components/FotoEmpresa";
import { usuarioAtual } from "@/lib/auth/sessao";
import { NO_DIRETORIO, resumoDoDiretorio } from "@/lib/consultas";
import { db } from "@/lib/db";
import { REPOSITORIO } from "@/lib/dominio";
import { lerPreenchimento } from "@/lib/indicacao";
import { linkPerfil, perfilOficial } from "@/lib/instagram";
import { boaCompanhia } from "@/lib/participacao";
import { metadadosDaPagina } from "@/lib/seo";
import { formatarTelefone } from "@/lib/texto";
import { CadastroPorEtapas } from "./CadastroPorEtapas";

// A entrada única para cadastrar um negócio: o link da bio do Instagram e o
// "Cadastrar" do site. O cadastro por etapas começa pelo @ (ver CadastroPorEtapas).
// O /indicar antigo redireciona para cá, com o @ e o "dono=sim" que ele trazia.

export const metadata: Metadata = metadadosDaPagina({
  titulo: "Cadastrar negócio",
  descricao:
    "Tem ou conhece um negócio que cuida das pessoas, da comunidade ou do planeta? Comece pelo @ do Instagram, ou cadastre sem Instagram, no Negócio do Bem. É de graça.",
  caminho: "/participar",
});

const QUEM_JA_ESTA_AQUI = 6;

const PROMESSAS: { titulo: string; texto: ReactNode }[] = [
  { titulo: "É de graça.", texto: "Não tem plano pago." },
  { titulo: "Ninguém compra destaque.", texto: "Não tem anúncio nem ranking." },
  { titulo: "O perfil é seu.", texto: "Você edita quando quiser e tira o negócio do diretório com um clique." },
  { titulo: "Não pedimos a senha do seu Instagram.", texto: "Da sua conta, guardamos o nome, o e-mail e a senha protegida." },
  { titulo: "Tem gente cuidando.", texto: "A moderação tira perfil falso do ar, e as decisões ficam registradas." },
  {
    titulo: "O código é aberto.",
    texto: (
      <>
        Qualquer pessoa pode{" "}
        <a href={REPOSITORIO} target="_blank" rel="noopener noreferrer" className="link">
          ver como o site funciona
        </a>
        .
      </>
    ),
  },
];

const DUVIDAS = [
  {
    pergunta: "Preciso de CNPJ?",
    resposta: "Não. Negócio pequeno, informal ou que está começando também é bem-vindo aqui.",
  },
  {
    pergunta: "Alguém já cadastrou meu negócio. E agora?",
    resposta: "Que bom, é sinal de carinho. Coloque o @ ali em cima e confirme que ele é seu.",
  },
  {
    pergunta: "E se eu não quiser aparecer?",
    resposta: "Você oculta o negócio no seu painel, e ele sai do diretório na hora.",
  },
  {
    pergunta: "E se o negócio não tiver Instagram?",
    resposta: "Cadastre mesmo assim: clique em \"O negócio não tem Instagram\" e siga as mesmas etapas.",
  },
];

export default function Participar(props: PageProps<"/participar">) {
  const instagramDoProjeto = perfilOficial();
  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
      <section className="flex flex-wrap items-stretch gap-7">
        <div className="flex min-w-0 flex-[999_1_28rem] flex-col justify-center">
          <p className="inline-flex items-center gap-2 self-start rounded-full border border-coral/20 bg-superficie/70 px-4 py-1.5 text-sm font-medium text-coral-700">
            <span aria-hidden="true">🌱</span>
            <span>Para quem tem ou conhece um negócio do bem</span>
          </p>
          <h1 className="mt-5 font-serif text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            Que bom que você chegou.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-suave text-pretty sm:text-xl">
            Se o negócio cuida das pessoas, da comunidade ou do planeta, ele já é do bem. Comece pelo @ do Instagram: leva
            poucos minutos. Não tem Instagram? Também dá.
          </p>
        </div>
        <Suspense fallback={<div className="min-h-40 flex-[1_1_18rem] animate-pulse rounded-3xl bg-superficie" aria-busy="true" />}>
          <BoaCompanhia />
        </Suspense>
      </section>

      <section className="mt-10">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-superficie" aria-busy="true" />}>
          <Cadastro searchParams={props.searchParams} />
        </Suspense>
      </section>

      <Suspense>
        <QuemJaEstaAqui />
      </Suspense>

      <section className="mt-16">
        <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">O que a gente promete</h2>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PROMESSAS.map((promessa) => (
            <li key={promessa.titulo} className="cartao p-5 leading-relaxed">
              <strong className="font-semibold">{promessa.titulo}</strong>{" "}
              <span className="text-suave">{promessa.texto}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Dúvidas de quem está chegando</h2>
        <dl className="mt-6 space-y-3">
          {DUVIDAS.map((duvida) => (
            <div key={duvida.pergunta} className="cartao p-5">
              <dt className="font-semibold">{duvida.pergunta}</dt>
              <dd className="mt-1 leading-relaxed text-suave">{duvida.resposta}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16 rounded-3xl bg-tinta px-6 py-10 text-papel sm:px-10">
        <p className="max-w-2xl font-serif text-2xl leading-snug text-balance sm:text-3xl">
          Comprar de quem faz o bem muda o bairro, a cidade e o país. Com você aqui, isso fica mais forte.
        </p>
        {/* Link comum, e não o Link do Next: o navegador leva o foco ao campo do @. */}
        <a href="#instagram" className="botao-coral mt-6 px-6 py-3 text-base">
          Colocar meu negócio
        </a>
        <div className="mt-8 space-y-1 text-papel/75">
          {instagramDoProjeto && (
            <p>
              Ficou com dúvida? Chama a gente no{" "}
              <a
                href={linkPerfil(instagramDoProjeto)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-papel underline decoration-coral underline-offset-4"
              >
                @{instagramDoProjeto}
              </a>
              .
            </p>
          )}
          <p>
            Não é o dono?{" "}
            <a href="#instagram" className="font-semibold text-papel underline decoration-coral underline-offset-4">
              Indique um negócio que você ama.
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}

/** Os números ao vivo do diretório, ao lado das boas-vindas (embaixo, no celular). */
async function BoaCompanhia() {
  const { total, cidades } = await resumoDoDiretorio();
  if (total === 0) return null;
  return (
    <div className="flex flex-[1_1_18rem] items-center rounded-3xl border border-coral/20 bg-coral-50 p-7">
      <p className="font-serif text-2xl leading-snug text-tinta text-balance">{boaCompanhia(total, cidades)}</p>
    </div>
  );
}

/** Quem está no site (com o telefone da conta, para o contato do dono) e o que veio no endereço. */
async function Cadastro({ searchParams }: Pick<PageProps<"/participar">, "searchParams">) {
  const [usuario, busca] = await Promise.all([usuarioAtual(), searchParams]);
  const { instagram, souDono } = lerPreenchimento(busca);
  const conta = usuario ? await db.usuario.findUnique({ where: { id: usuario.id }, select: { telefone: true } }) : null;
  return (
    <CadastroPorEtapas
      conta={{
        logado: !!usuario,
        emailConfirmado: !!usuario?.emailConfirmado,
        email: usuario?.email ?? null,
        telefone: conta?.telefone ? formatarTelefone(conta.telefone) : null,
      }}
      instagramInicial={instagram}
      donoInicial={souDono}
      continuar={busca.continuar === "1"}
      instagramDoProjeto={perfilOficial()}
    />
  );
}

/** Negócios do diretório com dono e foto, os mais recentes primeiro. Some quando não há nenhum. */
async function QuemJaEstaAqui() {
  const negocios = await db.empresa.findMany({
    where: { ...NO_DIRETORIO, fotoUrl: { not: null }, membros: { some: {} } },
    orderBy: { criadoEm: "desc" },
    take: QUEM_JA_ESTA_AQUI,
    select: { instagramUsername: true, nome: true, fotoUrl: true, categoria: true, cidade: true, uf: true },
  });
  if (negocios.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Quem já está aqui</h2>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {negocios.map((negocio) => (
          <li key={negocio.instagramUsername}>
            <Link
              href={`/empresas/${negocio.instagramUsername}`}
              className="group cartao flex items-center gap-3 p-4 transition hover:border-coral/30"
            >
              <FotoEmpresa empresa={negocio} />
              <span className="min-w-0">
                <span className="block truncate font-semibold group-hover:text-coral-700">{negocio.nome}</span>
                <span className="block truncate text-sm text-suave">
                  {negocio.categoria} · {negocio.cidade}, {negocio.uf}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
