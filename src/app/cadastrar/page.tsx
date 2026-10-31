import type { Metadata } from "next";
import { BotaoGoogle } from "@/components/BotaoGoogle";
import { FormCadastro } from "@/components/FormulariosConta";
import { PaginaConta } from "@/components/PaginaConta";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Criar conta", robots: FORA_DA_BUSCA };

export default function Cadastrar(props: PageProps<"/cadastrar">) {
  return (
    <PaginaConta
      titulo="Faça parte do movimento"
      subtitulo="Com uma conta você indica negócios, deixa depoimentos e, se tiver um negócio, assume o seu perfil."
      searchParams={props.searchParams}
      formulario={(voltar) => (
        <>
          <BotaoGoogle voltar={voltar} />
          <FormCadastro voltar={voltar} />
        </>
      )}
    />
  );
}
