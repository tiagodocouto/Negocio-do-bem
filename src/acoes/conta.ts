"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { CONFIRMACAO_DE_EMAIL_LIGADA, COOKIE_LINK, criarLink, enviarLink, usarLink } from "@/lib/auth/links";
import { gerarHashSenha, verificarSenha } from "@/lib/auth/senha";
import { caminhoSeguro, criarSessao, encerrarSessao, exigirUsuario } from "@/lib/auth/sessao";
import { ipDoCabecalho, reservarTentativaDoEmail, tentativaDoIpLiberada, zerarTentativasDoEmail } from "@/lib/auth/tentativas";
import { db } from "@/lib/db";
import { errosPorCampo, texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";

const campoEmail = z.email("Digite um e-mail válido.").max(200, "E-mail muito longo.");

const esquemaCadastro = z.object({
  nome: z.string().trim().min(2, "Conte como podemos te chamar.").max(80, "Nome muito longo."),
  email: campoEmail,
  senha: z.string().min(8, "Use pelo menos 8 caracteres.").max(200, "Senha muito longa."),
});

/** IP de quem fez a requisição, ou null se não der para confiar em nenhum cabeçalho (veja `ipDoCabecalho`). */
async function ipDaRequisicao(): Promise<string | null> {
  return ipDoCabecalho(await headers());
}

export async function cadastrar(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const resultado = esquemaCadastro.safeParse({
    nome: texto(dados, "nome"),
    email: texto(dados, "email").trim().toLowerCase(),
    senha: texto(dados, "senha"),
  });
  if (!resultado.success) {
    return { erros: errosPorCampo(resultado.error), valores: valoresDoFormulario(dados) };
  }
  const { nome, email, senha } = resultado.data;

  if (!(await tentativaDoIpLiberada(await ipDaRequisicao()))) {
    return { erro: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.", valores: valoresDoFormulario(dados) };
  }

  const existente = await db.usuario.findUnique({ where: { email } });
  if (existente) {
    return { erros: { email: "Já existe uma conta com este e-mail. Que tal entrar?" }, valores: valoresDoFormulario(dados) };
  }

  const usuario = await db.usuario.create({ data: { nome, email, senhaHash: await gerarHashSenha(senha) } });
  await criarSessao(usuario.id);
  const voltar = caminhoSeguro(texto(dados, "voltar"));
  if (CONFIRMACAO_DE_EMAIL_LIGADA) {
    after(async () => {
      const token = await criarLink(usuario, "confirmar", voltar);
      if (token) await enviarLink(usuario, "confirmar", token);
    });
  }
  redirect(voltar);
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
  loja.delete({ name: COOKIE_LINK, path: "/link" });
  const link = await usarLink(token);
  if (!link) redirect("/link");
  const destino = caminhoSeguro(link.destino);
  if (link.finalidade === "entrar") {
    await criarSessao(link.usuario.id);
    redirect(destino);
  }
  redirect(`/link?confirmado=1&voltar=${encodeURIComponent(destino)}`);
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/");
}
