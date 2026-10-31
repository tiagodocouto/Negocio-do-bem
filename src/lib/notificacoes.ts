// Avisos por e-mail: quem recebe o quê, e o texto de cada um.
//
// Cada pessoa recebe o próprio e-mail, para ninguém ver o endereço de outra. Os
// avisos para a moderação não levam dados pessoais: só o negócio e o link da fila,
// onde o resto já aparece para quem tem acesso.
//
// As Server Actions chamam estas funções dentro de `after()`, depois da resposta.
// Sem o envio configurado (`src/lib/email.ts`), elas não mandam nada.

import "server-only";
import { db } from "@/lib/db";
import { enviarEmail, envioLigado } from "@/lib/email";
import { hrefModeracao } from "@/lib/moderacao/filtros";
import { ENDERECO_DO_SITE, NOME_DO_SITE } from "@/lib/seo";

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

export function corpo(...paragrafos: string[]): string {
  return [...paragrafos, NOME_DO_SITE].join("\n\n");
}

async function emailsDaModeracao(): Promise<string[]> {
  const moderadores = await db.usuario.findMany({ where: { papel: "moderador" }, select: { email: true } });
  return moderadores.map((m) => m.email);
}

async function avisarModeracao(assunto: string, texto: string): Promise<void> {
  for (const para of await emailsDaModeracao()) await enviarEmail({ para, assunto, texto });
}

/** Para quem pediu: a moderação aprovou ou recusou a reivindicação. */
export async function avisarDecisaoDaReivindicacao(reivindicacaoId: string): Promise<void> {
  if (!envioLigado()) return;
  const pedido = await db.reivindicacao.findUnique({
    where: { id: reivindicacaoId },
    include: {
      usuario: { select: { nome: true, email: true } },
      empresa: { select: { nome: true, instagramUsername: true } },
    },
  });
  if (!pedido) return;
  const { usuario, empresa } = pedido;
  const ola = `Olá, ${primeiroNome(usuario.nome)}!`;

  if (pedido.status === "aprovada") {
    await enviarEmail({
      para: usuario.email,
      assunto: `Você agora é dono de ${empresa.nome} no ${NOME_DO_SITE}`,
      texto: corpo(
        ola,
        `A moderação aprovou o seu pedido: agora você é dono do perfil de ${empresa.nome} (@${empresa.instagramUsername}).`,
        `No painel, você conta a história do negócio, troca a foto e responde aos depoimentos:\n${ENDERECO_DO_SITE}/painel/${empresa.instagramUsername}`,
      ),
    });
  } else if (pedido.status === "recusada") {
    await enviarEmail({
      para: usuario.email,
      assunto: `Seu pedido para ${empresa.nome} não foi aprovado`,
      texto: corpo(
        ola,
        `A moderação analisou o seu pedido para assumir o perfil de ${empresa.nome} (@${empresa.instagramUsername}) e não aprovou desta vez.`,
        `Motivo: ${pedido.motivoRecusa ?? "não informado."}`,
        `Você acompanha os seus pedidos no painel:\n${ENDERECO_DO_SITE}/painel`,
      ),
    });
  }
}

/** Para a moderação: um pedido de reivindicação ficou na fila para ela decidir. */
export async function avisarNovaReivindicacao(empresaId: string): Promise<void> {
  if (!envioLigado()) return;
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { nome: true, instagramUsername: true } });
  if (!empresa) return;
  await avisarModeracao(
    `Novo pedido de reivindicação: @${empresa.instagramUsername}`,
    corpo(
      `Um pedido para assumir o perfil de ${empresa.nome} (@${empresa.instagramUsername}) está esperando a moderação.`,
      `Veja na fila de reivindicações:\n${ENDERECO_DO_SITE}${hrefModeracao("reivindicacoes")}`,
    ),
  );
}

/** Para a moderação: um depoimento foi denunciado. */
export async function avisarNovaDenuncia(depoimentoId: string): Promise<void> {
  if (!envioLigado()) return;
  const depoimento = await db.depoimento.findUnique({
    where: { id: depoimentoId },
    select: { empresa: { select: { nome: true, instagramUsername: true } } },
  });
  if (!depoimento) return;
  const { empresa } = depoimento;
  await avisarModeracao(
    `Depoimento denunciado em ${empresa.nome}`,
    corpo(
      `Um depoimento no perfil de ${empresa.nome} (@${empresa.instagramUsername}) foi denunciado e está esperando a moderação.`,
      `Veja na fila de denúncias:\n${ENDERECO_DO_SITE}${hrefModeracao("denuncias")}`,
    ),
  );
}

/** Para os donos: chegou um depoimento novo no negócio. */
export async function avisarNovoDepoimento(depoimentoId: string): Promise<void> {
  if (!envioLigado()) return;
  const depoimento = await db.depoimento.findUnique({
    where: { id: depoimentoId },
    include: {
      autor: { select: { nome: true } },
      empresa: {
        select: {
          nome: true,
          instagramUsername: true,
          membros: { select: { usuario: { select: { nome: true, email: true } } } },
        },
      },
    },
  });
  if (!depoimento) return;
  const { autor, empresa } = depoimento;
  for (const { usuario } of empresa.membros) {
    await enviarEmail({
      para: usuario.email,
      assunto: `Novo depoimento em ${empresa.nome}`,
      texto: corpo(
        `Olá, ${primeiroNome(usuario.nome)}!`,
        `${autor.nome} deixou um depoimento no perfil de ${empresa.nome}:`,
        `"${depoimento.texto}"`,
        `Você pode responder pelo painel:\n${ENDERECO_DO_SITE}/painel/${empresa.instagramUsername}#depoimentos`,
      ),
    });
  }
}
