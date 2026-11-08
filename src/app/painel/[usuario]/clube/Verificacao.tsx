import Link from "next/link";
import { formatarCnpj } from "@/lib/cnpj";
import { comPontoFinal, formatarDataCurta } from "@/lib/texto";
import { FormVerificacao } from "./FormVerificacao";

type Liberacao = { status: string; cnpj: string; motivo: string | null; decididoEm: Date } | null;

/**
 * Para o dono que ainda não cria ofertas: o pedido de verificação com o CNPJ, ou o pedido
 * que está em análise. Recusado ou suspenso, ele vê o motivo e pode pedir de novo.
 */
export function Verificacao({
  empresaId,
  liberacao,
  cnpjSugerido,
  nomeSugerido,
}: {
  empresaId: string;
  liberacao: Liberacao;
  cnpjSugerido?: string;
  nomeSugerido?: string;
}) {
  if (liberacao?.status === "pendente") {
    return (
      <section id="verificar" className="cartao scroll-mt-24 space-y-2 border-folha/40 p-6 text-sm leading-relaxed">
        <p className="text-xs font-semibold tracking-[0.2em] text-folha uppercase">Em análise</p>
        <h2 className="font-serif text-2xl font-semibold">A moderação está conferindo o seu negócio</h2>
        <p className="text-suave">
          Você pediu a verificação em {formatarDataCurta(liberacao.decididoEm)}, com o CNPJ {formatarCnpj(liberacao.cnpj)}. A
          moderação confere a ficha na Receita e o quadro de sócios. A resposta aparece aqui, e com ela você já pode criar
          ofertas.
        </p>
      </section>
    );
  }

  const recusada = liberacao?.status === "recusada";
  const suspensa = liberacao?.status === "suspensa";
  return (
    <section id="verificar" className="cartao scroll-mt-24 space-y-4 border-coral/40 p-6 text-sm leading-relaxed">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">🎟️ Clube do Bem</p>
        <h2 className="font-serif text-2xl font-semibold">Verifique o seu negócio para criar ofertas</h2>
        {(recusada || suspensa) && liberacao && (
          <p className="rounded-2xl bg-coral-50 p-3 text-coral-700">
            {recusada
              ? `O seu pedido de ${formatarDataCurta(liberacao.decididoEm)} não foi aprovado.`
              : "A liberação do seu negócio no clube foi suspensa."}
            {liberacao.motivo && ` Motivo: ${comPontoFinal(liberacao.motivo)}`} Confira o CNPJ e peça de novo.
          </p>
        )}
        <p className="text-suave">
          Informe o CNPJ do negócio, o seu nome completo e o seu CPF, e envie a foto do seu RG ou da sua CNH. A moderação confere na Receita se o CNPJ está ativo e se o
          seu nome e o seu CPF estão no quadro de sócios (no MEI, na razão social). Depois de aprovado, você cria ofertas de desconto que aparecem no perfil do negócio.{" "}
          <Link href="/clube-do-bem#para-negocios" className="link">
            Como funciona
          </Link>
        </p>
      </div>
      <FormVerificacao empresaId={empresaId} cnpj={cnpjSugerido} nome={nomeSugerido} deNovo={recusada || suspensa} />
    </section>
  );
}
