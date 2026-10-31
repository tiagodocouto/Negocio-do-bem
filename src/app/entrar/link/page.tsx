import type { Metadata } from "next";
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
      formulario={(voltar) => <FormPedirLink voltar={voltar} />}
    />
  );
}
