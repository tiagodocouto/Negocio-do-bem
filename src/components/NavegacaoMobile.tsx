import { connection } from "next/server";
import { BarraInferior } from "@/components/BarraInferior";
import { usuarioAtual } from "@/lib/auth/sessao";
import { perfilDaBarra } from "@/lib/navegacao";

/** A barra de baixo, já com o perfil de quem está usando (lê a sessão e o banco). */
export async function NavegacaoMobile() {
  // A contagem de ofertas usa a hora atual, que o Cache Components só deixa ler depois de uma leitura dinâmica.
  await connection();
  return <BarraInferior perfil={await perfilDaBarra(await usuarioAtual())} />;
}
