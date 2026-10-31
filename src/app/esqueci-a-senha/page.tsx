import type { Metadata } from "next";
import { FormEsqueciASenha } from "@/components/FormulariosConta";
import { PaginaConta } from "@/components/PaginaConta";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Esqueci minha senha", robots: FORA_DA_BUSCA };

export default function EsqueciASenha(props: PageProps<"/esqueci-a-senha">) {
  return (
    <PaginaConta
      titulo="Esqueceu a senha?"
      subtitulo="Digite o e-mail da sua conta e mandamos um link para criar uma senha nova."
      searchParams={props.searchParams}
      formulario={() => <FormEsqueciASenha />}
    />
  );
}
