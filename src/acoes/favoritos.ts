"use server";

import { caminhoSeguro, exigirUsuario } from "@/lib/auth/sessao";
import { ehDono } from "@/lib/consultas";
import { db } from "@/lib/db";
import { texto } from "@/lib/formulario";
import { medir } from "@/lib/medicao-servidor";

/**
 * O coração de um negócio (`CoracaoFavorito`): `favoritar=sim` põe nos favoritos, `nao` tira.
 * Devolve se o negócio ficou nos favoritos. Só um negócio do diretório pode ser favoritado,
 * e o dono não favorita o próprio. Tirar dos favoritos vale sempre, mesmo depois que o
 * negócio saiu do diretório.
 */
export async function favoritar(_anterior: boolean, dados: FormData): Promise<boolean> {
  const empresa = await db.empresa.findUnique({
    where: { id: texto(dados, "empresaId") },
    include: { membros: { select: { usuarioId: true } } },
  });
  if (!empresa) return false;
  const usuario = await exigirUsuario(caminhoSeguro(texto(dados, "voltar"), `/empresas/${empresa.instagramUsername}`));
  const chave = { empresaId: empresa.id, usuarioId: usuario.id };

  if (dados.get("favoritar") !== "sim") {
    await db.empresaFavorita.deleteMany({ where: chave });
    return false;
  }

  // A página não mostra o coração nesses casos; a regra vale aqui também.
  if (empresa.moderacao !== "aprovada" || empresa.oculta || ehDono(empresa, usuario)) {
    return (await db.empresaFavorita.count({ where: chave })) > 0;
  }

  // Com dois toques seguidos, só o primeiro grava e só ele conta no Analytics.
  const { count } = await db.empresaFavorita.createMany({ data: [chave], skipDuplicates: true });
  if (count > 0) await medir({ nome: "negocio_favoritado", params: { categoria: empresa.categoria, uf: empresa.uf } });
  return true;
}
