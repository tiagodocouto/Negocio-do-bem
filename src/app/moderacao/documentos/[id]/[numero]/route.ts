import { NextResponse, type NextRequest } from "next/server";
import { registrarAuditoria } from "@/lib/auditoria";
import { usuarioAtual } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { lerDocumento } from "@/lib/documentos";

/**
 * O documento (RG ou CNH) de um pedido de verificação do Clube do Bem (#293). Só a moderação
 * abre: quem não é responde 404, como o resto da moderação, sem dizer se o documento existe.
 * Cada abertura fica na auditoria. A resposta nunca vai para cache e não aceita ser embutida.
 */
export async function GET(_requisicao: NextRequest, contexto: RouteContext<"/moderacao/documentos/[id]/[numero]">) {
  const naoEncontrado = () => new NextResponse("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });
  const usuario = await usuarioAtual();
  if (!usuario?.moderador) return naoEncontrado();

  const { id, numero } = await contexto.params;
  const posicao = Number(numero);
  if (!Number.isInteger(posicao) || posicao < 0 || posicao > 1) return naoEncontrado();
  const liberacao = await db.liberacaoClube.findUnique({
    where: { id },
    select: { documentoChaves: true, empresaId: true, empresa: { select: { instagramUsername: true } }, usuario: { select: { nome: true } } },
  });
  const chave = liberacao?.documentoChaves[posicao];
  if (!liberacao || !chave) return naoEncontrado();
  const documento = await lerDocumento(chave);
  if (!documento) return naoEncontrado();

  await registrarAuditoria(db, {
    usuarioId: usuario.id,
    acao: "clube.documento_visto",
    alvoTipo: "empresa",
    alvoId: liberacao.empresaId,
    detalhes: `@${liberacao.empresa.instagramUsername} · ${liberacao.usuario.nome} · arquivo ${posicao + 1}`,
  });
  return new NextResponse(documento.conteudo as BodyInit, {
    headers: {
      "Content-Type": documento.tipo,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; sandbox",
      "X-Robots-Tag": "noindex",
    },
  });
}
