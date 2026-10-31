import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_CADASTRO_GOOGLE,
  COOKIE_GOOGLE,
  configGoogle,
  contaDoGoogle,
  guardarCadastroGoogle,
  trocarCodigo,
  VALIDADE_CADASTRO_GOOGLE_MS,
} from "@/lib/auth/google";
import { caminhoSeguro, criarSessao } from "@/lib/auth/sessao";

/** Retorno do Google depois do login (URI de redirecionamento cadastrada no Google Cloud). */
export async function GET(request: NextRequest) {
  const origem = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const [estado, verificador, voltarCodificado] = (request.cookies.get(COOKIE_GOOGLE)?.value ?? "").split(".");
  const voltar = caminhoSeguro(voltarCodificado ? Buffer.from(voltarCodificado, "base64url").toString("utf8") : "/");

  const ir = (destino: URL) => {
    const resposta = NextResponse.redirect(destino);
    resposta.cookies.set(COOKIE_GOOGLE, "", { path: "/api/google", maxAge: 0 });
    return resposta;
  };
  const avisar = (aviso: string) => {
    const destino = new URL("/entrar", origem);
    destino.search = new URLSearchParams({ voltar, aviso }).toString();
    return ir(destino);
  };

  if (params.get("error")) return avisar("google_cancelado");
  const codigo = params.get("code");
  if (!estado || !verificador || params.get("state") !== estado || !codigo) return avisar("google_erro");

  const config = configGoogle();
  if (!config) return avisar("google_indisponivel");

  try {
    const perfil = await trocarCodigo(config, codigo, verificador);
    // O token do Google não é guardado: ele só serviu para dizer quem é a pessoa.
    const resultado = await contaDoGoogle(perfil);
    if (resultado.tipo === "email_nao_verificado") return avisar("google_email_nao_verificado");
    if (resultado.tipo === "outra_conta_google") return avisar("google_outra_conta");
    if (resultado.tipo === "precisa_telefone") {
      // Conta nova: ela só é criada quando a pessoa informa o telefone em /cadastrar/google.
      const token = await guardarCadastroGoogle(perfil, voltar);
      const resposta = ir(new URL("/cadastrar/google", origem));
      resposta.cookies.set(COOKIE_CADASTRO_GOOGLE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/cadastrar/google",
        maxAge: VALIDADE_CADASTRO_GOOGLE_MS / 1000,
      });
      return resposta;
    }
    await criarSessao(resultado.usuarioId);
    return ir(new URL(voltar, origem));
  } catch (erro) {
    // A mensagem vai como texto: com o objeto do erro, o log do Worker guarda só a pilha.
    console.error(`Falha no retorno do login com o Google: ${erro instanceof Error ? erro.message : String(erro)}`);
    return avisar("google_erro");
  }
}
