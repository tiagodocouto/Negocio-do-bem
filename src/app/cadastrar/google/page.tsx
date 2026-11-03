import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { FormTelefoneGoogle } from "@/components/FormulariosConta";
import { PaginaConta } from "@/components/PaginaConta";
import { COOKIE_CADASTRO_GOOGLE, lerCadastroGoogle } from "@/lib/auth/google";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Criar conta com o Google", robots: FORA_DA_BUSCA };

export default function CadastroComGoogle(props: PageProps<"/cadastrar/google">) {
  return (
    <PaginaConta
      titulo="Falta só o seu telefone"
      subtitulo="Com ele a sua conta fica pronta. Usamos só para avisos sobre a sua conta e o seu negócio."
      searchParams={props.searchParams}
      formulario={() => <Pendente />}
    />
  );
}

async function Pendente() {
  const cadastro = await lerCadastroGoogle((await cookies()).get(COOKIE_CADASTRO_GOOGLE)?.value ?? "");
  if (!cadastro) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-suave">O prazo para concluir o cadastro pelo Google acabou. É só começar de novo.</p>
        <Link href="/cadastrar" className="botao w-full">
          Voltar ao cadastro
        </Link>
      </div>
    );
  }
  return <FormTelefoneGoogle email={cadastro.perfil.email} />;
}
