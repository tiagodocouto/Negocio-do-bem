"use server";

import { db } from "@/lib/db";
import { ehFotoDoSite } from "@/lib/fotos";
import { normalizarUsername } from "@/lib/instagram";
import { casoDaProcura } from "@/lib/participacao";
import { buscarPreviaDoInstagram, type PreviaInstagram } from "@/lib/previa-instagram";

export type ResultadoProcura =
  | { erro: string }
  | { instagram: string; caso: "indicar"; previa: PreviaInstagram | null }
  | {
      instagram: string;
      caso: "confirmar" | "revisao";
      negocio: { nome: string; fotoUrl: string | null; motivo: string | null; indicadaPor: string | null };
    }
  | { instagram: string; caso: "indisponivel" };

/**
 * A primeira etapa do cadastro: acha o @ no site e, se ele ainda não está aqui, a
 * prévia do Instagram. Só lê. A pessoa não precisa estar logada.
 */
export async function procurarArroba(texto: string): Promise<ResultadoProcura> {
  const instagram = normalizarUsername(texto);
  if (!instagram) return { erro: "Esse @ não parece certo. Use só letras, números, ponto e sublinhado." };

  const empresa = await db.empresa.findUnique({
    where: { instagramUsername: instagram },
    select: {
      nome: true,
      fotoUrl: true,
      moderacao: true,
      oculta: true,
      motivoIndicacao: true,
      indicadaPor: { select: { nome: true } },
      _count: { select: { membros: true } },
    },
  });
  const caso = casoDaProcura(empresa && { moderacao: empresa.moderacao, oculta: empresa.oculta, donos: empresa._count.membros });

  if (caso === "indicar" || !empresa) return { instagram, caso: "indicar", previa: await buscarPreviaDoInstagram(instagram) };
  // Fora do diretório, a resposta não diz se foi tirado do ar ou oculto pelo dono.
  if (caso === "indisponivel") return { instagram, caso };
  return {
    instagram,
    caso,
    negocio: {
      nome: empresa.nome,
      fotoUrl: ehFotoDoSite(empresa.fotoUrl) ? empresa.fotoUrl : null,
      motivo: empresa.motivoIndicacao,
      indicadaPor: empresa.indicadaPor?.nome ?? null,
    },
  };
}
