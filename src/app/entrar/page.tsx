import type { Metadata } from "next";
import { BotaoGoogle } from "@/components/BotaoGoogle";
import { FormEntrar } from "@/components/FormulariosConta";
import { PaginaConta } from "@/components/PaginaConta";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Entrar", robots: FORA_DA_BUSCA };

export default function Entrar(props: PageProps<"/entrar">) {
  return (
    <PaginaConta
      titulo="Que bom te ver"
      subtitulo="Entre para indicar negócios, deixar depoimentos e cuidar do seu perfil."
      searchParams={props.searchParams}
      formulario={(voltar) => (
        <>
          <BotaoGoogle voltar={voltar} />
          <FormEntrar voltar={voltar} />
        </>
      )}
    />
  );
}
