"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { indicarEmpresa } from "@/acoes/empresas";
import { procurarArroba, type ResultadoProcura } from "@/acoes/participacao";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Campo } from "@/components/Campo";
import { CampoMunicipio } from "@/components/CampoMunicipio";
import { ConfirmarEmail } from "@/components/ConfirmarEmail";
import { enviarSemLimpar } from "@/components/envio";
import { Monograma } from "@/components/Monograma";
import { SeletorCausas } from "@/components/SeletorCausas";
import { CATEGORIAS } from "@/lib/dominio";
import { lerRascunho, type Rascunho } from "@/lib/rascunho-do-cadastro";

// O cadastro por etapas: uma pergunta por vez. Todas as etapas ficam montadas num
// formulário só, e só a atual aparece: voltar não perde nada, e o envio final é o
// mesmo `indicarEmpresa` de antes, que valida tudo de novo no servidor.

type Etapa = "arroba" | "escolha" | "nome" | "onde" | "causas" | "contatos" | "voce" | "fim";
type Procura = Exclude<ResultadoProcura, { erro: string }>;
type Ramo = "indicar" | "dono";

const SEQUENCIA: Record<Ramo, Etapa[]> = {
  indicar: ["arroba", "escolha", "nome", "onde", "causas", "fim"],
  dono: ["arroba", "escolha", "nome", "onde", "causas", "contatos", "voce", "fim"],
};

/** Onde cada campo fica: um erro do servidor leva a pessoa de volta à etapa certa. */
const ETAPA_DO_CAMPO: Record<string, Etapa> = {
  instagram: "arroba",
  nome: "nome",
  categoria: "nome",
  municipio: "onde",
  resumo: "onde",
  motivo: "causas",
  telefoneComercial: "contatos",
  site: "contatos",
  whatsapp: "contatos",
  emailContato: "contatos",
  emailDoDono: "voce",
  telefoneDoDono: "voce",
};

/** O rascunho no aparelho, enquanto a pessoa entra, cria a conta ou confirma o e-mail. */
const CHAVE_LOCAL = "ndb:cadastro";
const CONTINUAR = "/participar?continuar=1#cadastro";

function lerDoAparelho(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_LOCAL);
  } catch {
    return null;
  }
}

function assinarAparelho(aviso: () => void) {
  window.addEventListener("storage", aviso);
  return () => window.removeEventListener("storage", aviso);
}

function valoresDo(formulario: HTMLFormElement): Rascunho {
  const dados = new FormData(formulario);
  const valores: Record<string, string | string[]> = {};
  for (const chave of new Set(dados.keys())) {
    valores[chave] = chave === "causas" ? dados.getAll(chave).map(String) : String(dados.get(chave) ?? "");
  }
  return lerRascunho(valores) ?? {};
}

/** Mesma regra do servidor (campoTelefone): DDD e número, com ou sem o 55. */
function telefoneValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, "").replace(/^0+/, "");
  return digitos.length >= 10 && digitos.length <= 13;
}

type Props = {
  /** A conta de quem está no site. O e-mail e o telefone dela começam como o contato do dono. */
  conta: { logado: boolean; emailConfirmado: boolean; email: string | null; telefone: string | null };
  /** Do endereço: o @ (links antigos do /indicar) e se a pessoa voltou do login. */
  instagramInicial: string;
  donoInicial: boolean;
  continuar: boolean;
  /** O @ do Negócio do Bem no Instagram, para quem precisa falar com a gente. */
  instagramDoProjeto: string | null;
};

export function CadastroPorEtapas({ conta, instagramInicial, donoInicial, continuar, instagramDoProjeto }: Props) {
  // Quem volta do login ou do cadastro, neste aparelho, continua de onde parou.
  const doAparelho = useSyncExternalStore(assinarAparelho, lerDoAparelho, () => null);
  const inicial = (() => {
    if (!continuar || !doAparelho) return null;
    try {
      return lerRascunho(JSON.parse(doAparelho));
    } catch {
      return null;
    }
  })();

  const [etapaEscolhida, setEtapa] = useState<Etapa | null>(null);
  const [ramoEscolhido, setRamo] = useState<Ramo | null>(null);
  const [semInstagramEscolhido, setSemInstagram] = useState<boolean | null>(null);
  const [procuraFeita, setProcura] = useState<Procura | null>(null);
  const [errosLocais, setErrosLocais] = useState<Record<string, string>>({});
  const [doInstagram, setDoInstagram] = useState<{ nome?: boolean; site?: boolean }>({});
  const [sitePrevia, setSitePrevia] = useState("");
  const [resumo, setResumo] = useState<Rascunho | null>(null);
  const [procurando, iniciarProcura] = useTransition();
  const [estado, acao, pendente] = useActionState(indicarEmpresa, undefined);
  const formulario = useRef<HTMLFormElement>(null);
  const nome = useRef<HTMLInputElement>(null);
  const mexeu = useRef(false);

  // Com um rascunho, a pessoa começa na revisão. O resto vem das escolhas dela.
  const ramo: Ramo | null = ramoEscolhido ?? (inicial ? (inicial.souDono === "sim" ? "dono" : "indicar") : null);
  const semInstagram = semInstagramEscolhido ?? inicial?.semInstagram === "sim";
  const procura: Procura | null =
    procuraFeita ??
    (inicial?.instagram && !semInstagram
      ? { instagram: inicial.instagram.replace(/^@+/, ""), caso: "indicar", previa: null }
      : null);
  const sequencia = ramo ? SEQUENCIA[ramo] : (["arroba", "escolha"] as Etapa[]);

  // Um erro do servidor leva à primeira etapa com o campo errado.
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    const campos = Object.keys(estado?.erros ?? {});
    const destino = sequencia.find((e) => campos.some((campo) => ETAPA_DO_CAMPO[campo] === e));
    if (destino) setEtapa(destino);
  }
  const etapa: Etapa = etapaEscolhida ?? (inicial ? "fim" : "arroba");
  const indice = Math.max(0, sequencia.indexOf(etapa));

  // A cada etapa, o foco vai para a pergunta: leitores de tela anunciam a mudança.
  useEffect(() => {
    if (mexeu.current) document.getElementById(`etapa-${etapa}`)?.focus();
  }, [etapa]);

  const erro = (campo: string) => errosLocais[campo] ?? estado?.erros?.[campo];
  const limpar = (campo: string) =>
    setErrosLocais((atuais) => {
      if (!(campo in atuais)) return atuais;
      const resto = { ...atuais };
      delete resto[campo];
      return resto;
    });

  function irPara(destino: Etapa) {
    mexeu.current = true;
    if (formulario.current) {
      const valores = valoresDo(formulario.current);
      setResumo(valores);
      // Sem o e-mail confirmado, as respostas esperam neste aparelho enquanto a pessoa abre o link.
      if (destino === "fim" && conta.logado && !conta.emailConfirmado) guardarNoAparelho(valores);
    }
    setEtapa(destino);
  }

  function procurar() {
    const texto = (formulario.current?.elements.namedItem("instagram") as HTMLInputElement | null)?.value ?? "";
    if (!texto.trim()) {
      setErrosLocais({ instagram: "Digite o @ do negócio." });
      return;
    }
    iniciarProcura(async () => {
      const resultado = await procurarArroba(texto);
      if ("erro" in resultado) {
        setErrosLocais({ instagram: resultado.erro });
        return;
      }
      setErrosLocais({});
      setSemInstagram(false);
      setProcura(resultado);
      // O nome e o site do Instagram entram no formulário, e a pessoa pode mudar.
      const previa = resultado.caso === "indicar" ? resultado.previa : null;
      if (nome.current && previa?.nome && (!nome.current.value || doInstagram.nome)) nome.current.value = previa.nome;
      setDoInstagram({ nome: !!previa?.nome, site: !!previa?.site });
      setSitePrevia(previa?.site ?? "");
      if (resultado.caso === "indicar" && donoInicial) {
        setRamo("dono");
        irPara("nome");
      } else {
        irPara("escolha");
      }
    });
  }

  function cadastrarSemInstagram() {
    setErrosLocais({});
    setSemInstagram(true);
    setProcura(null);
    // O nome que veio do Instagram de outro @ não vale para quem não tem Instagram.
    if (nome.current && doInstagram.nome) nome.current.value = "";
    setDoInstagram({});
    setSitePrevia("");
    irPara("escolha");
  }

  function escolher(novo: Ramo) {
    setRamo(novo);
    irPara("nome");
  }

  /** Confere só os campos da etapa atual. O servidor confere tudo de novo no envio. */
  function validar(): boolean {
    const form = formulario.current;
    if (!form) return false;
    const dados = new FormData(form);
    const valor = (campo: string) => String(dados.get(campo) ?? "").trim();
    const emailInvalido = (campo: string) => {
      const entrada = form.elements.namedItem(campo) as HTMLInputElement | null;
      return !!entrada?.value && entrada.validity.typeMismatch;
    };
    const erros: Record<string, string> = {};
    if (etapa === "nome") {
      if (valor("nome").length < 2) erros.nome = "Qual é o nome do negócio?";
      if (!valor("categoria")) erros.categoria = "Escolha uma categoria.";
    }
    if (etapa === "onde") {
      if (!valor("municipio")) erros.municipio = "Em que cidade fica o negócio?";
      if (valor("resumo").length < 10) erros.resumo = "Escreva uma frase sobre o negócio.";
    }
    if (etapa === "contatos") {
      if (!valor("telefoneComercial")) erros.telefoneComercial = "Qual é o telefone comercial do negócio?";
      else if (!telefoneValido(valor("telefoneComercial"))) erros.telefoneComercial = "Confira o número, com o DDD.";
      if (valor("whatsapp") && !telefoneValido(valor("whatsapp"))) erros.whatsapp = "Confira o número, com o DDD.";
      if (emailInvalido("emailContato")) erros.emailContato = "Esse e-mail não parece certo.";
    }
    if (etapa === "voce") {
      if (!valor("emailDoDono")) erros.emailDoDono = "Qual é o seu e-mail de contato?";
      else if (emailInvalido("emailDoDono")) erros.emailDoDono = "Esse e-mail não parece certo.";
      if (!valor("telefoneDoDono")) erros.telefoneDoDono = "Qual é o seu telefone de contato?";
      else if (!telefoneValido(valor("telefoneDoDono"))) erros.telefoneDoDono = "Confira o número, com o DDD.";
    }
    setErrosLocais(erros);
    return Object.keys(erros).length === 0;
  }

  function continuarEtapa() {
    if (!validar()) return;
    const proxima = sequencia[indice + 1];
    if (proxima) irPara(proxima);
  }

  function voltar() {
    const anterior = sequencia[indice - 1];
    if (anterior) {
      setErrosLocais({});
      irPara(anterior);
    }
  }

  /** Enter avança, como o botão "Continuar", em vez de enviar o formulário antes da hora. */
  function aoTeclar(evento: KeyboardEvent<HTMLFormElement>) {
    if (evento.key !== "Enter" || evento.defaultPrevented || etapa === "fim") return;
    if (!(evento.target instanceof HTMLInputElement)) return;
    evento.preventDefault();
    if (etapa === "arroba") procurar();
    else if (etapa !== "escolha") continuarEtapa();
  }

  /** Antes de ir para o login, o cadastro ou o e-mail, as respostas ficam neste aparelho. */
  function guardarNoAparelho(valores?: Rascunho) {
    const rascunho = valores ?? (formulario.current ? valoresDo(formulario.current) : null);
    if (!rascunho) return;
    try {
      window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(rascunho));
    } catch {
      // Sem armazenamento (navegação privada), a pessoa preenche de novo depois de entrar.
    }
  }

  const enviar = enviarSemLimpar(acao);
  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    try {
      window.localStorage.removeItem(CHAVE_LOCAL);
    } catch {
      // Nada a limpar.
    }
    enviar(evento);
  }

  const dono = ramo === "dono";
  const arroba = procura?.instagram ?? inicial?.instagram ?? instagramInicial;
  const semPrevia = procura?.caso === "indicar" && !procura.previa;
  const visto = resumo ?? inicial ?? {};

  return (
    <div id="cadastro" className="cartao scroll-mt-24 p-6 sm:p-8">
      <Progresso etapa={etapa} indice={indice} total={ramo ? sequencia.length : null} aoVoltar={indice > 0 ? voltar : null} />

      {continuar && !conta.logado && !inicial && (
        <div className="mb-6">
          <Aviso tipo="info">
            Entre na sua conta para continuar de onde parou.{" "}
            <Link href={`/entrar?voltar=${encodeURIComponent(CONTINUAR)}`} className="font-semibold underline">
              Entrar
            </Link>
          </Aviso>
        </div>
      )}

      {/* O rascunho do aparelho só chega depois da hidratação: a chave remonta os campos com ele. */}
      <form key={inicial ? "aparelho" : "novo"} ref={formulario} action={acao} onSubmit={aoEnviar} onKeyDown={aoTeclar} noValidate>
        <input type="hidden" name="souDono" value={dono ? "sim" : ""} />
        <input type="hidden" name="semInstagram" value={semInstagram ? "sim" : ""} />

        <Secao etapa="arroba" atual={etapa} titulo="Qual é o @ do negócio no Instagram?" subtitulo="A gente procura no Negócio do Bem e traz a foto do perfil.">
          <Campo id="instagram" rotulo="Instagram" erro={erro("instagram")}>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-suave">@</span>
              <input
                id="instagram"
                name="instagram"
                maxLength={80}
                placeholder="padariadobairro"
                defaultValue={arroba}
                onChange={() => limpar("instagram")}
                aria-invalid={erro("instagram") ? true : undefined}
                className="campo pl-8"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </Campo>
          {estado?.existente && (
            <p className="mt-2 text-sm">
              <Link href={`/empresas/${estado.existente}`} className="link">
                Ver o perfil de @{estado.existente} →
              </Link>
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
            <button type="button" onClick={procurar} disabled={procurando} className="botao-coral w-full py-3 text-base sm:w-auto">
              {procurando ? "Procurando…" : "Procurar"}
            </button>
            <button type="button" onClick={cadastrarSemInstagram} className="link text-sm">
              O negócio não tem Instagram
            </button>
          </div>
        </Secao>

        <Secao etapa="escolha" atual={etapa} titulo={semInstagram ? "O que você quer fazer?" : tituloDaEscolha(procura)}>
          {semInstagram ? (
            <EscolhaSemInstagram aoEscolher={escolher} aoVoltarAoArroba={() => irPara("arroba")} />
          ) : (
            procura && (
              <Escolha procura={procura} instagramDoProjeto={instagramDoProjeto} aoEscolher={escolher} aoCorrigir={() => irPara("arroba")} />
            )
          )}
        </Secao>

        <Secao etapa="nome" atual={etapa} titulo={dono ? "Como o seu negócio se chama?" : "Como o negócio se chama?"}>
          {dono && semPrevia && !semInstagram && (
            <div className="mb-5">
              <Aviso tipo="info">
                Não conseguimos ver esse perfil. Confira se o @ está certo. Para o seu negócio aparecer com foto e nome, o
                Instagram dele precisa ser uma conta profissional (comercial ou de criador), que é sempre pública. A mudança
                é grátis e leva um minuto, nas configurações do app.{" "}
                <button type="button" onClick={procurar} className="font-semibold underline">
                  Já mudei, procurar de novo
                </button>
              </Aviso>
            </div>
          )}
          <Campo id="nome" rotulo="Nome do negócio" erro={erro("nome")} ajuda={doInstagram.nome ? "Veio do Instagram. Pode mudar." : undefined}>
            <input
              ref={nome}
              id="nome"
              name="nome"
              maxLength={80}
              defaultValue={inicial?.nome ?? ""}
              onChange={() => limpar("nome")}
              aria-invalid={erro("nome") ? true : undefined}
              className="campo"
            />
          </Campo>
          <fieldset className="mt-6">
            <legend className="rotulo">Categoria</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIAS.map((categoria) => (
                <label key={categoria} className="flex cursor-pointer items-center rounded-full border border-linha bg-superficie px-3.5 py-2 text-sm transition select-none hover:border-tinta/25 has-checked:border-coral has-checked:bg-coral-50 has-checked:text-coral-700 has-focus-visible:ring-4 has-focus-visible:ring-coral-100">
                  <input
                    type="radio"
                    name="categoria"
                    value={categoria}
                    defaultChecked={inicial?.categoria === categoria}
                    onChange={() => limpar("categoria")}
                    className="sr-only"
                  />
                  {categoria}
                </label>
              ))}
            </div>
            {erro("categoria") && <p className="erro-campo mt-2">{erro("categoria")}</p>}
          </fieldset>
        </Secao>

        <Secao etapa="onde" atual={etapa} titulo="Onde fica e o que ele faz?">
          <CampoMunicipio valorInicial={inicial?.municipio ?? ""} erro={erro("municipio")} />
          <div className="mt-5">
            <Campo id="resumo" rotulo="Em uma frase, o que este negócio faz?" erro={erro("resumo")} ajuda="Até 160 caracteres.">
              <input
                id="resumo"
                name="resumo"
                maxLength={160}
                placeholder="Padaria artesanal que contrata gente do próprio bairro"
                defaultValue={inicial?.resumo ?? ""}
                onChange={() => limpar("resumo")}
                aria-invalid={erro("resumo") ? true : undefined}
                className="campo"
              />
            </Campo>
          </div>
        </Secao>

        <Secao
          etapa="causas"
          atual={etapa}
          titulo={dono ? "Quais causas o seu negócio abraça?" : "Quais causas esse negócio abraça?"}
          subtitulo={dono ? "Escolha quantas quiser." : "Marque só o que você sabe que é verdade. O dono pode ajustar depois."}
        >
          <SeletorCausas selecionadas={inicial?.causas ?? []} />
          {!dono && (
            <div className="mt-6">
              <Campo id="motivo" rotulo="Por que você indica? (opcional)" erro={erro("motivo")} ajuda="Aparece no perfil até o dono contar a própria história.">
                <textarea id="motivo" name="motivo" rows={3} maxLength={600} defaultValue={inicial?.motivo ?? ""} className="campo" />
              </Campo>
            </div>
          )}
        </Secao>

        {dono && (
          <>
            <Secao etapa="contatos" atual={etapa} titulo="Como os clientes falam com o negócio?" subtitulo="Tudo isso vira botão no perfil. Só o telefone comercial é obrigatório.">
              <Campo id="telefoneComercial" rotulo="Telefone comercial" erro={erro("telefoneComercial")}>
                <input
                  id="telefoneComercial"
                  name="telefoneComercial"
                  type="tel"
                  maxLength={30}
                  placeholder="(11) 3333-4444"
                  defaultValue={inicial?.telefoneComercial ?? ""}
                  onChange={() => limpar("telefoneComercial")}
                  aria-invalid={erro("telefoneComercial") ? true : undefined}
                  className="campo"
                />
              </Campo>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo id="whatsapp" rotulo="WhatsApp (opcional)" erro={erro("whatsapp")}>
                  <input id="whatsapp" name="whatsapp" type="tel" maxLength={30} placeholder="(11) 99999-9999" defaultValue={inicial?.whatsapp ?? ""} onChange={() => limpar("whatsapp")} className="campo" />
                </Campo>
                <Campo id="emailContato" rotulo="E-mail do negócio (opcional)" erro={erro("emailContato")}>
                  <input id="emailContato" name="emailContato" type="email" maxLength={200} placeholder="contato@negocio.com.br" defaultValue={inicial?.emailContato ?? ""} onChange={() => limpar("emailContato")} className="campo" />
                </Campo>
              </div>
              <div className="mt-5">
                <Campo id="site" rotulo="Site (opcional)" erro={erro("site")} ajuda={doInstagram.site ? "Veio do Instagram. Pode mudar." : undefined}>
                  <input id="site" name="site" maxLength={200} placeholder="www.negocio.com.br" defaultValue={inicial?.site ?? sitePrevia} className="campo" autoCapitalize="none" />
                </Campo>
              </div>
            </Secao>

            <Secao etapa="voce" atual={etapa} titulo="Como a gente fala com você?" subtitulo="Não aparece no perfil: só você e a moderação veem. É por aqui que a gente fala com quem cuida do negócio.">
              <Campo id="emailDoDono" rotulo="Seu e-mail de contato" erro={erro("emailDoDono")}>
                <input
                  id="emailDoDono"
                  name="emailDoDono"
                  type="email"
                  maxLength={200}
                  placeholder="voce@email.com"
                  defaultValue={inicial?.emailDoDono ?? conta.email ?? ""}
                  onChange={() => limpar("emailDoDono")}
                  aria-invalid={erro("emailDoDono") ? true : undefined}
                  className="campo"
                />
              </Campo>
              <div className="mt-5">
                <Campo id="telefoneDoDono" rotulo="Seu telefone de contato" erro={erro("telefoneDoDono")}>
                  <input
                    id="telefoneDoDono"
                    name="telefoneDoDono"
                    type="tel"
                    maxLength={30}
                    placeholder="(11) 99999-9999"
                    defaultValue={inicial?.telefoneDoDono ?? conta.telefone ?? ""}
                    onChange={() => limpar("telefoneDoDono")}
                    aria-invalid={erro("telefoneDoDono") ? true : undefined}
                    className="campo"
                  />
                </Campo>
              </div>
            </Secao>
          </>
        )}

        <Secao etapa="fim" atual={etapa} titulo={conta.logado ? "Revise e publique" : "Falta pouco: entre ou crie sua conta"}>
          <dl className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-2xl bg-papel p-4 text-sm">
            <dt className="text-suave">Instagram</dt>
            <dd className="truncate">{semInstagram ? "Sem Instagram" : `@${(procura?.instagram ?? visto.instagram ?? arroba).replace(/^@+/, "")}`}</dd>
            <dt className="text-suave">Nome</dt>
            <dd className="truncate">{visto.nome ?? "—"}</dd>
            <dt className="text-suave">Categoria</dt>
            <dd>{visto.categoria ?? "—"}</dd>
            <dt className="text-suave">Cidade</dt>
            <dd>{visto.municipio ?? "—"}</dd>
            <dt className="text-suave">Causas</dt>
            <dd>{!visto.causas?.length ? "nenhuma" : visto.causas.length === 1 ? "1 marcada" : `${visto.causas.length} marcadas`}</dd>
            {dono && (
              <>
                <dt className="text-suave">Telefone comercial</dt>
                <dd className="truncate">{visto.telefoneComercial ?? "—"}</dd>
                <dt className="text-suave">Seu contato</dt>
                <dd className="truncate">{[visto.emailDoDono, visto.telefoneDoDono].filter(Boolean).join(" · ") || "—"}</dd>
              </>
            )}
          </dl>

          {!conta.logado ? (
            <div className="mt-6 space-y-4">
              <p className="leading-relaxed text-suave">
                A conta guarda o seu nome, o e-mail e a senha protegida. As respostas ficam guardadas neste aparelho
                enquanto você entra.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href={`/cadastrar?voltar=${encodeURIComponent(CONTINUAR)}`} onClick={() => guardarNoAparelho()} className="botao-coral">
                  Criar conta e continuar
                </Link>
                <Link href={`/entrar?voltar=${encodeURIComponent(CONTINUAR)}`} onClick={() => guardarNoAparelho()} className="botao-claro">
                  Já tenho conta
                </Link>
              </div>
            </div>
          ) : !conta.emailConfirmado && conta.email ? (
            <div className="mt-6 space-y-4">
              <Aviso tipo="info">
                Para publicar, confirme o seu e-mail. As respostas ficam guardadas neste aparelho: abra o link aqui
                mesmo e volte para publicar.
              </Aviso>
              <ConfirmarEmail email={conta.email} para="publicar" voltar={CONTINUAR} />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {dono && (
                <p className="leading-relaxed text-suave">
                  Depois de cadastrar, você confirma que o negócio é seu na página seguinte e passa a cuidar do perfil. Até
                  lá, ele aparece como indicado.
                </p>
              )}
              {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
              <BotaoEnviar pendente={pendente} className="botao-coral w-full py-3 text-base sm:w-auto" enviando="Enviando…">
                {dono ? "Cadastrar meu negócio" : "Publicar indicação"}
              </BotaoEnviar>
            </div>
          )}
        </Secao>

        {etapa !== "arroba" && etapa !== "escolha" && etapa !== "fim" && (
          <button type="button" onClick={continuarEtapa} className="botao-coral mt-8 w-full py-3 text-base sm:w-auto">
            Continuar
          </button>
        )}
      </form>
    </div>
  );
}

function tituloDaEscolha(procura: Procura | null): string {
  if (!procura) return "O que você quer fazer?";
  if (procura.caso === "confirmar") return "Esse negócio já está aqui";
  if (procura.caso === "revisao") return "Esse negócio já tem alguém cuidando do perfil";
  if (procura.caso === "indisponivel") return "Não conseguimos seguir com esse @ por aqui";
  return "O que você quer fazer?";
}

function Progresso({ etapa, indice, total, aoVoltar }: { etapa: Etapa; indice: number; total: number | null; aoVoltar: (() => void) | null }) {
  const porcentagem = total ? Math.round(((indice + 1) / total) * 100) : (indice + 1) * 15;
  return (
    <div className="mb-6">
      <div className="flex h-8 items-center justify-between text-sm text-suave">
        {aoVoltar ? (
          <button type="button" onClick={aoVoltar} className="-ml-2 rounded-full px-2 py-1 hover:text-tinta">
            ← Voltar
          </button>
        ) : (
          <span>Cadastrar negócio</span>
        )}
        <span aria-live="polite">{etapa === "fim" ? "Última etapa" : total ? `Etapa ${indice + 1} de ${total}` : `Etapa ${indice + 1}`}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-linha" aria-hidden="true">
        <div className="h-full rounded-full bg-coral transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${porcentagem}%` }} />
      </div>
    </div>
  );
}

function Secao({
  etapa,
  atual,
  titulo,
  subtitulo,
  children,
}: {
  etapa: Etapa;
  atual: Etapa;
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <section hidden={etapa !== atual} aria-labelledby={`etapa-${etapa}`}>
      <h2
        id={`etapa-${etapa}`}
        tabIndex={-1}
        className="font-serif text-3xl leading-tight font-semibold tracking-tight text-balance outline-none"
      >
        {titulo}
      </h2>
      {subtitulo && <p className="mt-2 leading-relaxed text-suave">{subtitulo}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** A segunda etapa: as opções dependem do que a procura achou. */
function Escolha({
  procura,
  instagramDoProjeto,
  aoEscolher,
  aoCorrigir,
}: {
  procura: Procura;
  instagramDoProjeto: string | null;
  aoEscolher: (ramo: Ramo) => void;
  aoCorrigir: () => void;
}) {
  const perfil = `/empresas/${procura.instagram}`;
  const corrigir = (
    <button type="button" onClick={aoCorrigir} className="link mt-2 text-sm">
      Não é este? Corrigir o @
    </button>
  );

  if (procura.caso === "indisponivel") {
    // Sem nome, foto ou motivo: o @ pode estar tirado do ar ou oculto pelo dono.
    return (
      <>
        <p className="leading-relaxed">
          Fala com a gente{instagramDoProjeto ? ` no @${instagramDoProjeto}` : ""} que a gente resolve.
        </p>
        {corrigir}
      </>
    );
  }

  if (procura.caso === "indicar") {
    const { previa } = procura;
    return (
      <>
        {previa ? (
          <Cartao nome={previa.nome ?? `@${procura.instagram}`} instagram={procura.instagram} foto={previa.foto} linha="Prévia do Instagram" />
        ) : (
          <p className="rounded-2xl bg-papel p-4 text-sm leading-relaxed text-suave">
            Não conseguimos ver a prévia de @{procura.instagram}. Confira se o @ está certo. Contas pessoais não aparecem, e
            tudo bem.
          </p>
        )}
        {corrigir}
        <div className="mt-6 grid gap-3">
          <Opcao aoClicar={() => aoEscolher("indicar")} icone="🤝" titulo="Quero indicar este negócio" texto="Conte para a comunidade por que você admira." />
          <Opcao aoClicar={() => aoEscolher("dono")} icone="🏪" titulo="Sou dono deste negócio" texto="Coloque no diretório e cuide do perfil." />
        </div>
      </>
    );
  }

  const { negocio } = procura;
  return (
    <>
      <Cartao nome={negocio.nome} instagram={procura.instagram} foto={negocio.fotoUrl} linha="No Negócio do Bem" />
      {procura.caso === "confirmar" ? (
        negocio.motivo ? (
          <figure className="mt-4">
            <figcaption className="text-suave">{negocio.indicadaPor ?? "Alguém da comunidade"} indicou com carinho:</figcaption>
            <blockquote className="mt-2 font-serif text-xl leading-relaxed text-tinta/85">“{negocio.motivo}”</blockquote>
          </figure>
        ) : (
          <p className="mt-4 text-suave">Alguém da comunidade indicou com carinho, e ninguém assumiu o perfil ainda.</p>
        )
      ) : (
        <p className="mt-4 leading-relaxed text-suave">
          Se ele é seu e você não reconhece quem assumiu, peça uma revisão. A gente olha com cuidado.
        </p>
      )}
      <div className="mt-6 grid gap-3">
        <Opcao href={`${perfil}/reivindicar`} icone="🏪" titulo={procura.caso === "confirmar" ? "É meu negócio" : "É meu negócio: pedir revisão"} texto="Confirme que é seu e cuide do perfil." />
        <Opcao href={`${perfil}#depoimentos`} icone="💬" titulo="Quero deixar um depoimento" texto="Conte como foi a sua experiência." />
      </div>
      {corrigir}
    </>
  );
}

/** A segunda etapa de quem não tem Instagram: indicar ou cadastrar como dono, sem a procura. */
function EscolhaSemInstagram({ aoEscolher, aoVoltarAoArroba }: { aoEscolher: (ramo: Ramo) => void; aoVoltarAoArroba: () => void }) {
  return (
    <>
      <p className="rounded-2xl bg-papel p-4 text-sm leading-relaxed text-suave">
        Tudo bem não ter Instagram. O perfil fica no Negócio do Bem com um endereço feito do nome e da cidade, e o dono
        pode colocar uma foto depois.
      </p>
      <button type="button" onClick={aoVoltarAoArroba} className="link mt-2 text-sm">
        Tem Instagram, sim? Colocar o @
      </button>
      <div className="mt-6 grid gap-3">
        <Opcao aoClicar={() => aoEscolher("indicar")} icone="🤝" titulo="Quero indicar um negócio" texto="Conte para a comunidade por que você admira." />
        <Opcao aoClicar={() => aoEscolher("dono")} icone="🏪" titulo="Sou dono do negócio" texto="Coloque no diretório e cuide do perfil." />
      </div>
    </>
  );
}

function Cartao({ nome, instagram, foto, linha }: { nome: string; instagram: string; foto: string | null; linha: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-papel p-4">
      {foto ? (
        // A foto chega pronta: do site ou em data URL, da prévia do Instagram.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="h-12 w-12 shrink-0 rounded-full bg-superficie object-cover ring-2 ring-superficie" />
      ) : (
        <Monograma nome={nome} chave={instagram} />
      )}
      <div className="min-w-0">
        <p className="truncate font-semibold">{nome}</p>
        <p className="truncate text-sm text-suave">
          @{instagram} · {linha}
        </p>
      </div>
    </div>
  );
}

function Opcao({
  href,
  aoClicar,
  icone,
  titulo,
  texto,
}: {
  href?: string;
  aoClicar?: () => void;
  icone: string;
  titulo: string;
  texto: string;
}) {
  const conteudo = (
    <>
      <span aria-hidden="true" className="text-2xl">
        {icone}
      </span>
      <span>
        <span className="block font-semibold">{titulo}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-suave">{texto}</span>
      </span>
    </>
  );
  const classe =
    "flex w-full items-start gap-4 rounded-2xl border border-linha bg-superficie p-4 text-left transition hover:border-coral/40 hover:bg-coral-50/40 focus-visible:ring-4 focus-visible:ring-coral-100 focus-visible:outline-none";
  return href ? (
    <Link href={href} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <button type="button" onClick={aoClicar} className={classe}>
      {conteudo}
    </button>
  );
}
