"use server";

import { notFound, redirect } from "next/navigation";
import { apagarFoto, conferirFoto, guardarFoto } from "@/lib/armazenamento";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirModerador } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { atualizarPeloInstagram, lerEmbaixador } from "@/lib/embaixadores";
import { texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import { lerId } from "@/lib/moderacao/filtros";

// Cadastro dos embaixadores do bem, só pela moderação (aba Embaixadores).

function violouUnicidade(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2002";
}

/** O embaixador do formulário, ou 404: o id vem de um campo escondido. */
async function embaixadorDoFormulario(dados: FormData) {
  const id = lerId(texto(dados, "embaixadorId"));
  const embaixador = id && (await db.embaixador.findUnique({ where: { id } }));
  if (!embaixador) notFound();
  return embaixador;
}

const paginaDoEmbaixador = (id: string, aviso: string) => `/moderacao/embaixadores/${id}?aviso=${aviso}`;

/** Cria ou edita um embaixador. Cadastro novo ou @ trocado já busca a foto, os seguidores e a bio no Instagram. */
export async function salvarEmbaixador(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirModerador();
  const valores = valoresDoFormulario(dados);
  const lido = lerEmbaixador(dados);
  if ("erros" in lido) return { erros: lido.erros, valores };

  const anterior = texto(dados, "embaixadorId") ? await embaixadorDoFormulario(dados) : null;
  const { seguidores, ...campos } = lido.dados;
  const trocouArroba = anterior?.instagramUsername !== campos.instagramUsername;
  const data = {
    ...campos,
    // O número digitado vale até alguém desmarcar o "à mão". O do Instagram é de outra
    // conta quando o @ muda: sai até a próxima consulta.
    ...(campos.seguidoresManual ? { seguidores, seguidoresEm: null } : trocouArroba ? { seguidores: null, seguidoresEm: null } : {}),
  };

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const { id } = anterior
        ? await tx.embaixador.update({ where: { id: anterior.id }, data, select: { id: true } })
        : await tx.embaixador.create({ data, select: { id: true } });
      await registrarAuditoria(tx, {
        usuarioId: usuario.id,
        acao: anterior ? "embaixador.editado" : "embaixador.criado",
        alvoTipo: "embaixador",
        alvoId: id,
        detalhes: `@${campos.instagramUsername}`,
      });
      return id;
    });
  } catch (erro) {
    if (violouUnicidade(erro)) return { erros: { instagram: "Esse @ já é de outro embaixador." }, valores };
    throw erro;
  }

  let aviso = "embaixador_salvo";
  if (trocouArroba) {
    const resultado = await atualizarPeloInstagram(id, undefined, { comBio: true }).catch((erro) => {
      console.error("Falha ao buscar o embaixador no Instagram", id, erro);
      return "sem_resposta" as const;
    });
    if (resultado === "sem_resposta" && !campos.seguidoresManual) aviso = "embaixador_salvo_sem_instagram";
  }
  redirect(paginaDoEmbaixador(id, aviso));
}

/** Busca agora os seguidores (e a foto e o "Sobre", se faltarem), sem esperar a consulta do dia. */
export async function atualizarEmbaixadorAgora(dados: FormData): Promise<void> {
  await exigirModerador();
  const embaixador = await embaixadorDoFormulario(dados);
  const resultado = await atualizarPeloInstagram(embaixador.id, undefined, { comBio: true }).catch((erro) => {
    console.error("Falha ao buscar o embaixador no Instagram", embaixador.id, erro);
    return "sem_resposta" as const;
  });
  redirect(paginaDoEmbaixador(embaixador.id, resultado === "atualizado" ? "embaixador_atualizado" : "embaixador_sem_instagram"));
}

export async function trocarFotoDoEmbaixador(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirModerador();
  const embaixador = await embaixadorDoFormulario(dados);
  const foto = await conferirFoto(dados.get("foto"));
  if ("erro" in foto) return { erro: foto.erro };

  let fotoUrl: string;
  try {
    fotoUrl = await guardarFoto(foto, "perfis");
  } catch (erro) {
    console.error("Falha ao guardar a foto do embaixador", erro);
    return { erro: "Não conseguimos guardar a foto agora. Tente de novo em instantes." };
  }
  await db.$transaction(async (tx) => {
    await tx.embaixador.update({ where: { id: embaixador.id }, data: { fotoUrl } });
    await registrarAuditoria(tx, { usuarioId: usuario.id, acao: "embaixador.foto_trocada", alvoTipo: "embaixador", alvoId: embaixador.id });
  });
  await apagarFoto(embaixador.fotoUrl);
  redirect(paginaDoEmbaixador(embaixador.id, "foto_salva"));
}

export async function removerFotoDoEmbaixador(dados: FormData): Promise<void> {
  const usuario = await exigirModerador();
  const embaixador = await embaixadorDoFormulario(dados);
  await db.$transaction(async (tx) => {
    await tx.embaixador.update({ where: { id: embaixador.id }, data: { fotoUrl: null } });
    await registrarAuditoria(tx, { usuarioId: usuario.id, acao: "embaixador.foto_removida", alvoTipo: "embaixador", alvoId: embaixador.id });
  });
  await apagarFoto(embaixador.fotoUrl);
  redirect(paginaDoEmbaixador(embaixador.id, "foto_removida"));
}

/** Apaga o cadastro e a foto. Para só tirar do site, basta desmarcar "Aparece no site". */
export async function excluirEmbaixador(dados: FormData): Promise<void> {
  const usuario = await exigirModerador();
  const embaixador = await embaixadorDoFormulario(dados);
  await db.$transaction(async (tx) => {
    await tx.embaixador.delete({ where: { id: embaixador.id } });
    await registrarAuditoria(tx, {
      usuarioId: usuario.id,
      acao: "embaixador.excluido",
      alvoTipo: "embaixador",
      alvoId: embaixador.id,
      detalhes: `${embaixador.nome} (@${embaixador.instagramUsername})`,
    });
  });
  await apagarFoto(embaixador.fotoUrl);
  redirect("/moderacao?aba=embaixadores&aviso=embaixador_excluido");
}
