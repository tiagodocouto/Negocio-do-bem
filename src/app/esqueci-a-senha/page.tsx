import type { Metadata } from "next";
import { AvisoLinkNoIphone } from "@/components/AvisoLinkNoIphone";
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
      formulario={() => (
        <>
          <AvisoLinkNoIphone>
            No app do iPhone, o link do e-mail abre no Safari. Crie a senha nova por lá e depois volte ao app para
            entrar com ela.
          </AvisoLinkNoIphone>
          <FormEsqueciASenha />
        </>
      )}
    />
  );
}
