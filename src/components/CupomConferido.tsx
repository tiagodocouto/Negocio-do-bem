import { usarCupomAcao } from "@/acoes/ofertas";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { rotuloDoDesconto, situacaoDoCupom } from "@/lib/ofertas";
import { formatarDataHora } from "@/lib/texto";

const SITUACAO_DO_CUPOM = {
  valido: { texto: "Válido", cor: "text-folha" },
  usado: { texto: "Já usado", cor: "text-coral-700" },
  vencido: { texto: "Vencido", cor: "text-coral-700" },
  suspenso: { texto: "Oferta suspensa pela moderação", cor: "text-coral-700" },
} as const;

/** O cupom que o dono conferiu pelo código, com o botão de marcar como usado. Serve ao painel do clube e à tela de validar. */
export function CupomConferido({
  cupom,
  empresaId,
  agora,
  usadoAgora,
  origem,
}: {
  cupom: {
    codigo: string;
    usadoEm: Date | null;
    usuario: { nome: string };
    oferta: { titulo: string; tipo: string; valor: number | null; fim: Date; status: string };
  };
  empresaId: string;
  agora: Date;
  /** Acabou de ser marcado como usado nesta tela: é a confirmação, e não um alerta. */
  usadoAgora: boolean;
  /** De onde veio a conferência, para a ação devolver o dono à mesma tela. */
  origem?: "validar";
}) {
  const situacao = situacaoDoCupom(cupom, agora);
  const { texto, cor } = usadoAgora && situacao === "usado" ? { texto: "Usado agora. Pode dar o desconto.", cor: "text-folha" } : SITUACAO_DO_CUPOM[situacao];
  return (
    <div className="cartao space-y-3 p-5 text-sm">
      <p className="font-mono text-2xl tracking-[0.2em]">{cupom.codigo}</p>
      <p className={`font-medium ${cor}`}>
        {texto}
        {situacao === "usado" && !usadoAgora && cupom.usadoEm && ` em ${formatarDataHora(cupom.usadoEm)}`}
      </p>
      <p>
        {cupom.oferta.titulo} · {rotuloDoDesconto(cupom.oferta)}
      </p>
      {/* Só o primeiro nome: o clube não entrega lista de clientes. */}
      <p className="text-suave">De {cupom.usuario.nome.split(" ")[0]}</p>
      {situacao === "valido" && (
        <form action={usarCupomAcao}>
          <input type="hidden" name="empresaId" value={empresaId} />
          <input type="hidden" name="codigo" value={cupom.codigo} />
          {origem && <input type="hidden" name="origem" value={origem} />}
          <BotaoEnviar className="botao-coral" enviando="Marcando…">
            Marcar como usado
          </BotaoEnviar>
        </form>
      )}
    </div>
  );
}
