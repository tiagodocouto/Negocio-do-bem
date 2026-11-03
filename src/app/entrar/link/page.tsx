import type { Metadata } from "next";
import { AvisoLinkNoIphone } from "@/components/AvisoLinkNoIphone";
import { FormPedirLink } from "@/components/FormulariosConta";
import { PaginaConta } from "@/components/PaginaConta";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Entrar com link por e-mail", robots: FORA_DA_BUSCA };

export default function EntrarComLink(props: PageProps<"/entrar/link">) {
  return (
    <PaginaConta
      titulo="Entrar sem senha"
      subtitulo="Mandamos um link para o seu e-mail. É só abrir e clicar em “Entrar”."
      searchParams={props.searchParams}
      formulario={(voltar) => (
        <>
          <AvisoLinkNoIphone>
            No app do iPhone, o link do e-mail abre no Safari, e você entra por lá. Para entrar no app, use o Google ou
            o seu e-mail e senha.
          </AvisoLinkNoIphone>
          <FormPedirLink voltar={voltar} />
        </>
      )}
    />
  );
}
