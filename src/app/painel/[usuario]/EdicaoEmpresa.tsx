import { FormFoto } from "@/components/FormFoto";
import { fotoDe } from "@/components/FotoEmpresa";
import { formatarTelefone } from "@/lib/texto";
import { FormEmpresa } from "./FormEmpresa";

type Empresa = {
  id: string;
  nome: string;
  instagramUsername: string;
  fotoUrl: string | null;
  resumo: string;
  categoria: string;
  cidade: string;
  uf: string;
  site: string | null;
  whatsapp: string | null;
  emailContato: string | null;
  telefoneComercial: string | null;
  emailDoDono: string | null;
  telefoneDoDono: string | null;
  historia: string;
  causas: { causa: string }[];
};

/** Foto e formulário do perfil, usados no painel do dono e na edição pela moderação. */
export function EdicaoEmpresa({ empresa, voltar }: { empresa: Empresa; voltar: string }) {
  return (
    <>
      <section className="cartao space-y-4 p-6 sm:p-8">
        <h2 className="font-serif text-2xl font-semibold">Foto do perfil</h2>
        <FormFoto empresa={fotoDe(empresa)} voltar={voltar} />
      </section>

      <FormEmpresa
        voltar={voltar}
        empresa={{
          id: empresa.id,
          nome: empresa.nome,
          resumo: empresa.resumo,
          categoria: empresa.categoria,
          cidade: empresa.cidade,
          uf: empresa.uf,
          site: empresa.site ?? "",
          whatsapp: empresa.whatsapp ? formatarTelefone(empresa.whatsapp) : "",
          emailContato: empresa.emailContato ?? "",
          telefoneComercial: empresa.telefoneComercial ? formatarTelefone(empresa.telefoneComercial) : "",
          emailDoDono: empresa.emailDoDono ?? "",
          telefoneDoDono: empresa.telefoneDoDono ? formatarTelefone(empresa.telefoneDoDono) : "",
          historia: empresa.historia,
          causas: empresa.causas.map((c) => c.causa),
        }}
      />
    </>
  );
}
