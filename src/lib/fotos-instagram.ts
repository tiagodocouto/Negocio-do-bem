import "server-only";
import { timingSafeEqual } from "node:crypto";
import { apagarFoto, conferirFoto, guardarFoto } from "@/lib/armazenamento";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import type { TipoDeFoto } from "@/lib/fotos";
import { arquivoDaFoto, buscarPreviaDoInstagram } from "@/lib/previa-instagram";

// Fotos de perfil vindas do Instagram, por dois caminhos:
// 1. No cadastro: a foto da prévia do @ é gravada logo depois de criar o negócio.
// 2. Na rotina: um script no computador de quem cuida do projeto
//    (scripts/fotos-instagram.ts) busca a foto dos que ficaram sem, deixa pronta e
//    envia para /api/fotos-instagram.
// Aqui ficam as regras do lado do site.

/** Token que o script usa. Sem ele (ou curto demais), a rota responde 404. */
export function tokenDasFotos(): string | null {
  const token = process.env.FOTOS_TOKEN;
  return token && token.length >= 32 ? token : null;
}

/** Confere o cabeçalho "Authorization: Bearer <token>" sem vazar tempo de comparação. */
export function autorizado(cabecalho: string | null, token: string): boolean {
  const esperado = Buffer.from(`Bearer ${token}`);
  const recebido = Buffer.from(cabecalho ?? "");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/**
 * Negócios sem foto que a rotina tenta preencher. Os tirados do ar ficam de fora, e
 * os sem Instagram também: o endereço deles tem hífen (ver temInstagram).
 */
export function negociosSemFoto(limite = 200) {
  return db.empresa.findMany({
    where: { fotoUrl: null, moderacao: { not: "rejeitada" }, NOT: { instagramUsername: { contains: "-" } } },
    orderBy: { criadoEm: "asc" },
    take: limite,
    select: { id: true, instagramUsername: true },
  });
}

export type ResultadoFotoDoInstagram = "gravada" | "ja_tem_foto" | "nao_encontrado";

/**
 * Grava a foto vinda do Instagram, mas só se o negócio continuar sem foto: a
 * foto enviada pelo dono ou pela moderação nunca é trocada.
 */
export async function aplicarFotoDoInstagram(
  empresaId: string,
  foto: { arquivo: File; tipo: TipoDeFoto },
): Promise<ResultadoFotoDoInstagram> {
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { fotoUrl: true, instagramUsername: true } });
  if (!empresa) return "nao_encontrado";
  if (empresa.fotoUrl) return "ja_tem_foto";

  const fotoUrl = await guardarFoto(foto, "perfis");
  // O dono pode ter enviado uma foto enquanto esta subia: nesse caso, vale a dele.
  const { count } = await db.empresa.updateMany({ where: { id: empresaId, fotoUrl: null }, data: { fotoUrl } });
  if (count === 0) {
    await apagarFoto(fotoUrl);
    return "ja_tem_foto";
  }
  await registrarAuditoria(db, {
    usuarioId: null,
    acao: "empresa.foto_do_instagram",
    alvoTipo: "empresa",
    alvoId: empresaId,
    detalhes: `@${empresa.instagramUsername}`,
  });
  return "gravada";
}

/**
 * Logo depois do cadastro, grava a foto da prévia do @: o perfil já nasce com foto.
 * Sem prévia (conta pessoal, @ errado, Meta fora do ar), a rotina tenta depois.
 */
export async function gravarFotoDaPrevia(empresaId: string, username: string): Promise<void> {
  try {
    const previa = await buscarPreviaDoInstagram(username);
    const arquivo = previa?.foto ? arquivoDaFoto(previa.foto) : null;
    if (!arquivo) return;
    const foto = await conferirFoto(arquivo);
    if ("erro" in foto) return;
    await aplicarFotoDoInstagram(empresaId, foto);
  } catch (erro) {
    console.error("Falha ao gravar a foto do Instagram no cadastro", empresaId, erro);
  }
}
