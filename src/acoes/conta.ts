"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { apagarCadastroGoogle, contaDoGoogle, COOKIE_CADASTRO_GOOGLE, lerCadastroGoogle } from "@/lib/auth/google";
import {
  CONFIRMACAO_DE_EMAIL_LIGADA,
  COOKIE_LINK,
  criarLink,
  enviarLink,
  gastarLinksAbertos,
  lerLink,
  redefinirSenhaComLink,
  usarLink,
} from "@/lib/auth/links";
import { gerarHashSenha, verificarSenha } from "@/lib/auth/senha";
import { caminhoSeguro, criarSessao, encerrarSessao, exigirUsuario, idDaSessaoAtual } from "@/lib/auth/sessao";
import {
  ipDoCabecalho,
  reservarTentativaDoEmail,
  tentativaDoIpLiberada,
  zerarTentativasDeTodasAsOrigens,
  zerarTentativasDoEmail,
} from "@/lib/auth/tentativas";
import { registrarAuditoria } from "@/lib/auditoria";
import { AVISOS } from "@/lib/avisos";
import { db } from "@/lib/db";
import { campoTelefone, errosPorCampo, texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import { medir } from "@/lib/medicao-servidor";
import { avisarSenhaTrocada } from "@/lib/notificacoes";

const campoEmail = z.email("Digite um e-mail válido.").max(200, "E-mail muito longo.");
const campoSenha = z.string().min(8, "Use pelo menos 8 caracteres.").max(200, "Senha muito longa.");

const esquemaCadastro = z.object({
  nome: z.string().trim().min(2, "Conte como podemos te chamar.").max(80, "Nome muito longo."),
  email: campoEmail,
  telefone: campoTelefone,
  senha: campoSenha,
});

const esquemaTelefone = z.object({ telefone: campoTelefone });

// A senha nova é digitada duas vezes: um erro de digitação trancaria a pessoa fora da conta.
const senhasConferem = (dados: { novaSenha: string; confirmarSenha: string }) => dados.novaSenha === dados.confirmarSenha;
const senhasNaoConferem = { message: "As senhas não conferem.", path: ["confirmarSenha"] };

const esquemaSenhaNova = z.object({ novaSenha: campoSenha, confirmarSenha: z.string() }).refine(senhasConferem, senhasNaoConferem);

const esquemaTrocarSenha = z
  .object({ senhaAtual: z.string().min(1, "Digite a senha atual."), novaSenha: campoSenha, confirmarSenha: z.string() })
  .refine(senhasConferem, senhasNaoConferem);

const MENSAGEM_LIMITE = "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";

/** IP de quem fez a requisição, ou null se não der para confiar em nenhum cabeçalho (veja `ipDoCabecalho`). */
async function ipDaRequisicao(): Promise<string | null> {
  return ipDoCabecalho(await headers());
}

export async function cadastrar(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = esquemaCadastro.safeParse({
    nome: texto(dados, "nome"),
    email: texto(dados, "email").trim().toLowerCase(),
    telefone: texto(dados, "telefone"),
    senha: texto(dados, "senha"),
  });
  if (!resultado.success) {
    return { erros: errosPorCampo(resultado.error), valores: valoresDoFormulario(dados) };
  }
  const { nome, email, telefone, senha } = resultado.data;

  if (!(await tentativaDoIpLiberada(await ipDaRequisicao()))) {
    return { erro: MENSAGEM_LIMITE, valores: valoresDoFormulario(dados) };
  }

  const existente = await db.usuario.findUnique({ where: { email } });
  if (existente) {
    return { erros: { email: "Já existe uma conta com este e-mail. Que tal entrar?" }, valores: valoresDoFormulario(dados) };
  }

  const usuario = await db.usuario.create({ data: { nome, email, telefone, senhaHash: await gerarHashSenha(senha) } });
  await criarSessao(usuario.id);
  await medir({ nome: "sign_up", params: { method: "senha" } });
  const voltar = caminhoSeguro(texto(dados, "voltar"));
  if (CONFIRMACAO_DE_EMAIL_LIGADA) {
    after(async () => {
      const token = await criarLink(usuario, "confirmar", voltar);
      if (token) await enviarLink(usuario, "confirmar", token);
    });
  }
  redirect(voltar);
}

/** O último passo de quem cria conta pelo Google: informa o telefone, e só então a conta é criada. */
export async function concluirCadastroGoogle(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultadoTelefone = esquemaTelefone.safeParse({ telefone: texto(dados, "telefone") });
  if (!resultadoTelefone.success) {
    return { erros: errosPorCampo(resultadoTelefone.error), valores: valoresDoFormulario(dados) };
  }
  const loja = await cookies();
  const token = loja.get(COOKIE_CADASTRO_GOOGLE)?.value ?? "";
  const cadastro = await lerCadastroGoogle(token);
  // Sem cadastro, a página mostra que o prazo acabou.
  if (!cadastro) redirect("/cadastrar/google");

  const resultado = await contaDoGoogle(cadastro.perfil, resultadoTelefone.data.telefone);
  if (resultado.tipo !== "entrou") {
    return { erro: AVISOS.google_outra_conta.texto, valores: valoresDoFormulario(dados) };
  }
  await apagarCadastroGoogle(token);
  loja.delete({ name: COOKIE_CADASTRO_GOOGLE, path: "/cadastrar/google" });
  await criarSessao(resultado.usuarioId);
  await medir({ nome: "sign_up", params: { method: "google" } });
  redirect(caminhoSeguro(cadastro.destino));
}

// Hash de uma senha qualquer: quando o e-mail não existe, conferimos contra ele
// para a resposta demorar o mesmo tempo e não revelar quais e-mails têm conta.
let hashFalso: Promise<string> | undefined;

export async function entrar(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const email = texto(dados, "email").trim().toLowerCase();
  const senha = texto(dados, "senha");
  const recusado = { erro: "E-mail ou senha incorretos.", valores: valoresDoFormulario(dados) };

  const ip = await ipDaRequisicao();
  if (!(await tentativaDoIpLiberada(ip)) || (email && !(await reservarTentativaDoEmail(email, ip)))) {
    return recusado;
  }

  const usuario = email ? await db.usuario.findUnique({ where: { email } }) : null;
  const senhaConfere = await verificarSenha(senha, usuario?.senhaHash ?? (await (hashFalso ??= gerarHashSenha("senha-que-nao-existe"))));

  if (!usuario || !senhaConfere) return recusado;
  await zerarTentativasDoEmail(email, ip);
  await criarSessao(usuario.id);
  await medir({ nome: "login", params: { method: "senha" } });
  redirect(caminhoSeguro(texto(dados, "voltar")));
}

/**
 * Pede o link para entrar sem senha. A resposta é a mesma com ou sem conta, e o
 * link é criado e mandado depois da resposta, para o tempo também não revelar nada.
 */
export async function pedirLinkDeAcesso(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = campoEmail.safeParse(texto(dados, "email").trim().toLowerCase());
  if (!resultado.success) {
    return { erros: { email: resultado.error.issues[0]?.message ?? "Digite um e-mail válido." }, valores: valoresDoFormulario(dados) };
  }
  const usuario = await db.usuario.findUnique({
    where: { email: resultado.data },
    select: { id: true, nome: true, email: true },
  });
  if (usuario) {
    const voltar = caminhoSeguro(texto(dados, "voltar"));
    after(async () => {
      const token = await criarLink(usuario, "entrar", voltar);
      if (token) await enviarLink(usuario, "entrar", token);
    });
  }
  redirect("/entrar/link/enviado");
}

export type EstadoReenvio = { enviado?: boolean; erro?: string } | undefined;

/** Manda de novo o link de confirmação para quem está logado e ainda não confirmou. */
export async function reenviarConfirmacao(_estado: EstadoReenvio, dados: FormData): Promise<EstadoReenvio> {
  const voltar = caminhoSeguro(texto(dados, "voltar"));
  const usuario = await exigirUsuario(voltar);
  if (usuario.emailConfirmado) redirect(voltar);
  const token = await criarLink(usuario, "confirmar", voltar);
  if (!token) return { erro: "Você pediu muitos e-mails na última hora. Espere um pouco e tente de novo." };
  after(() => enviarLink(usuario, "confirmar", token));
  return { enviado: true };
}

/** O clique em /link: usa o link guardado no cookie por /api/link. */
export async function usarLinkDoEmail(): Promise<void> {
  const loja = await cookies();
  const token = loja.get(COOKIE_LINK)?.value ?? "";
  // O link de senha nova só se gasta com a senha nova (`criarSenhaComLink`), nunca por aqui.
  if ((await lerLink(token))?.finalidade === "redefinir") redirect("/link");
  loja.delete({ name: COOKIE_LINK, path: "/link" });
  const link = await usarLink(token);
  if (!link) redirect("/link");
  const destino = caminhoSeguro(link.destino);
  if (link.finalidade === "entrar") {
    await criarSessao(link.usuario.id);
    await medir({ nome: "login", params: { method: "link" } });
    redirect(destino);
  }
  redirect(`/link?confirmado=1&voltar=${encodeURIComponent(destino)}`);
}

/**
 * "Esqueci minha senha": pede o link para criar uma senha nova. A resposta é a mesma com ou
 * sem conta, e o link é criado e mandado depois da resposta, para o tempo também não revelar
 * nada. Cada pedido gasta uma tentativa do IP, como o login: sem isso dava para testar muitos
 * e-mails. A conta também tem o limite de links por hora (`criarLink`).
 */
export async function pedirRedefinicaoDeSenha(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = campoEmail.safeParse(texto(dados, "email").trim().toLowerCase());
  if (!resultado.success) {
    return { erros: { email: resultado.error.issues[0]?.message ?? "Digite um e-mail válido." }, valores: valoresDoFormulario(dados) };
  }
  if (!(await tentativaDoIpLiberada(await ipDaRequisicao()))) {
    return { erro: MENSAGEM_LIMITE, valores: valoresDoFormulario(dados) };
  }
  const usuario = await db.usuario.findUnique({
    where: { email: resultado.data },
    select: { id: true, nome: true, email: true },
  });
  if (usuario) {
    after(async () => {
      const token = await criarLink(usuario, "redefinir");
      if (token) await enviarLink(usuario, "redefinir", token);
    });
  }
  redirect("/entrar?aviso=redefinicao_pedida");
}

/**
 * A senha nova de quem abriu o link de "Esqueci minha senha" (o token vem do cookie de /api/link).
 * Depois da troca, todas as sessões da conta são encerradas e só este aparelho entra de novo:
 * quem abriu o link provou que lê o e-mail da conta, como no link de entrar.
 */
export async function criarSenhaComLink(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = esquemaSenhaNova.safeParse({ novaSenha: texto(dados, "novaSenha"), confirmarSenha: texto(dados, "confirmarSenha") });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error) };

  // A troca calcula o scrypt, então também passa pelo limite por IP.
  if (!(await tentativaDoIpLiberada(await ipDaRequisicao()))) return { erro: MENSAGEM_LIMITE };

  const loja = await cookies();
  const conta = await redefinirSenhaComLink(loja.get(COOKIE_LINK)?.value ?? "", resultado.data.novaSenha);
  if (!conta) return { erro: "Este link venceu ou já foi usado." };

  loja.delete({ name: COOKIE_LINK, path: "/link" });
  await zerarTentativasDeTodasAsOrigens(conta.email);
  await criarSessao(conta.id);
  after(() => avisarSenhaTrocada(conta, "link"));
  redirect("/painel?aviso=senha_trocada");
}

/**
 * Troca a senha no painel. A senha atual passa pelos mesmos limites do login (por IP e por
 * e-mail, antes do scrypt). As outras sessões da conta são encerradas e os links abertos
 * deixam de valer: quem troca a senha por desconfiar de um acesso tira o intruso.
 */
export async function trocarSenha(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario("/painel");
  const resultado = esquemaTrocarSenha.safeParse({
    senhaAtual: texto(dados, "senhaAtual"),
    novaSenha: texto(dados, "novaSenha"),
    confirmarSenha: texto(dados, "confirmarSenha"),
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error) };
  const { senhaAtual, novaSenha } = resultado.data;

  const ip = await ipDaRequisicao();
  if (!(await tentativaDoIpLiberada(ip)) || !(await reservarTentativaDoEmail(usuario.email, ip))) {
    return { erro: MENSAGEM_LIMITE };
  }
  const { senhaHash: senhaAntiga } = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id }, select: { senhaHash: true } });
  // A conta sem senha (criada pelo Google) cria a primeira pelo link do e-mail, e não por aqui.
  if (!senhaAntiga || !(await verificarSenha(senhaAtual, senhaAntiga))) {
    return { erros: { senhaAtual: "Senha atual incorreta." } };
  }

  const senhaHash = await gerarHashSenha(novaSenha);
  const sessaoAtual = await idDaSessaoAtual();
  const agora = new Date();
  const trocou = await db.$transaction(async (tx) => {
    // Só troca se a senha não mudou desde a conferência: de duas trocas juntas, passa uma.
    const { count } = await tx.usuario.updateMany({ where: { id: usuario.id, senhaHash: senhaAntiga }, data: { senhaHash } });
    if (count === 0) return false;
    await tx.sessao.deleteMany({ where: { usuarioId: usuario.id, ...(sessaoAtual ? { id: { not: sessaoAtual } } : {}) } });
    await gastarLinksAbertos(tx, usuario.id, agora);
    await registrarAuditoria(tx, { usuarioId: usuario.id, acao: "usuario.senha_trocada", alvoTipo: "usuario", alvoId: usuario.id });
    return true;
  });
  if (!trocou) return { erro: "A senha mudou enquanto você trocava. Recarregue a página e tente de novo." };

  await zerarTentativasDeTodasAsOrigens(usuario.email);
  after(() => avisarSenhaTrocada(usuario, "painel"));
  redirect("/painel?aviso=senha_trocada");
}

/**
 * No painel, para quem não tem senha (entra pelo Google ou por link) ou esqueceu a atual:
 * manda para o e-mail da conta o mesmo link de "Esqueci minha senha".
 */
export async function mandarLinkDeSenhaNova(): Promise<EstadoReenvio> {
  const usuario = await exigirUsuario("/painel");
  const token = await criarLink(usuario, "redefinir");
  if (!token) return { erro: "Você pediu muitos e-mails na última hora. Espere um pouco e tente de novo." };
  after(() => enviarLink(usuario, "redefinir", token));
  return { enviado: true };
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/");
}
