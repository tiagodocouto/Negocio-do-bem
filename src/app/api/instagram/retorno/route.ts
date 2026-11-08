import { after, NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { buscarContaConectada, configLogin, COOKIE_ESTADO, trocarCodigoPorToken } from "@/lib/instagram";
import { medir } from "@/lib/medicao-servidor";
import { avisarNovaReivindicacao } from "@/lib/notificacoes";
import { ErroReivindicacao, processarLoginInstagram } from "@/lib/reivindicacao";

/** Retorno do Instagram depois do login (redirect_uri cadastrada no app da Meta). */
export async function GET(request: NextRequest) {
  const origem = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const [estado, empresaId] = (request.cookies.get(COOKIE_ESTADO)?.value ?? "").split(".");

  const empresa = empresaId
    ? await db.empresa.findUnique({ where: { id: empresaId }, select: { instagramUsername: true } })
    : null;
  if (!empresa) return NextResponse.redirect(new URL("/", origem));

  const caminho = `/empresas/${empresa.instagramUsername}/reivindicar`;
  const voltar = (aviso: string, extras: Record<string, string> = {}, destino = caminho) => {
    const url = new URL(destino, origem);
    url.search = new URLSearchParams({ aviso, ...extras }).toString();
    const resposta = NextResponse.redirect(url);
    resposta.cookies.set(COOKIE_ESTADO, "", { path: "/api/instagram", maxAge: 0 });
    return resposta;
  };

  if (params.get("error")) return voltar("ig_cancelado");
  const codigo = params.get("code");
  if (!estado || params.get("state") !== estado || !codigo) return voltar("ig_erro");

  const config = configLogin();
  if (!config) return voltar("ig_indisponivel");
  const usuario = await usuarioAtual();
  if (!usuario) return NextResponse.redirect(new URL(`/entrar?voltar=${encodeURIComponent(caminho)}`, origem));

  try {
    const token = await trocarCodigoPorToken(config, codigo);
    const conta = await buscarContaConectada(token);
    // O token não é guardado: ele só serviu para provar quem controla a conta.
    const resultado = await processarLoginInstagram({ empresaId: empresaId!, usuarioId: usuario.id, conta });

    if (resultado.tipo === "verificada") {
      await medir({ nome: "perfil_reivindicado", params: { method: "instagram", resultado: "verificada" } });
      return voltar("verificada", {}, `/empresas/${empresa.instagramUsername}`);
    }
    if (resultado.tipo === "em_analise") {
      await medir({ nome: "perfil_reivindicado", params: { method: "instagram", resultado: "em_analise" } });
      after(() => avisarNovaReivindicacao(empresaId!));
      return voltar("em_analise");
    }
    return voltar("ig_conta_diferente", { conectada: resultado.conectada });
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) return voltar("limite");
    console.error("Falha no retorno do login com Instagram:", erro);
    return voltar("ig_erro");
  }
}
