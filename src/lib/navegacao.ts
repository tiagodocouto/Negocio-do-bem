import "server-only";
import type { UsuarioSessao } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { condicaoDeOfertaPublica } from "@/lib/ofertas";

/** Os negócios em que a pessoa é dona e pode criar ofertas (liberada no Clube do Bem). */
export async function negociosDoClube(usuarioId: string) {
  const liberacoes = await db.liberacaoClube.findMany({
    where: { usuarioId, status: "liberada", empresa: { membros: { some: { usuarioId } } } },
    select: { empresa: { select: { id: true, nome: true, instagramUsername: true } } },
    orderBy: { criadoEm: "asc" },
  });
  return liberacoes.map((liberacao) => liberacao.empresa);
}

/** Quantas ofertas do Clube do Bem estão valendo agora, para o número da aba Cupons. */
export async function contarOfertasValendo(): Promise<number> {
  return db.oferta.count({ where: condicaoDeOfertaPublica() });
}

export type PerfilDaBarra =
  | { tipo: "comprador"; ofertas: number }
  | { tipo: "dono"; ofertas: number; negocio: string };

/**
 * A barra de baixo do celular muda com quem usa: quem tem negócio liberado no clube ganha o
 * botão Validar no centro e a aba do negócio; os demais veem Favoritos.
 */
export async function perfilDaBarra(usuario: UsuarioSessao | null): Promise<PerfilDaBarra> {
  const [ofertas, negocios] = await Promise.all([contarOfertasValendo(), usuario ? negociosDoClube(usuario.id) : []]);
  if (negocios.length === 0) return { tipo: "comprador", ofertas };
  return { tipo: "dono", ofertas, negocio: `/negocio${negocios.length > 1 ? "" : `?negocio=${negocios[0]!.instagramUsername}`}` };
}
