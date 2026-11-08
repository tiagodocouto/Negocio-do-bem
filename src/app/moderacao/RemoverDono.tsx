import { removerDono } from "@/acoes/moderacao";
import { BotaoEnviar } from "@/components/BotaoEnviar";

/**
 * "Remover dos donos": abre o formulário com o motivo, que a pessoa recebe por e-mail, e a
 * confirmação. Usado na seção de donos da ficha do negócio e, quando o nome da conta não
 * bate com a Receita, na ficha do Clube do Bem (na ficha do negócio e na fila do clube).
 */
export function RemoverDono({
  empresaId,
  username,
  dono,
  voltar,
}: {
  empresaId: string;
  username: string;
  dono: { id: string; nome: string };
  /** "fila": depois de remover, volta para a fila do clube, e não para a ficha do negócio. */
  voltar?: "fila";
}) {
  const campo = `remover-${dono.id}${voltar ? "-fila" : ""}`;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-coral-700 hover:underline">Remover dos donos</summary>
      <form action={removerDono} className="mt-3 space-y-3 rounded-2xl border border-coral-100 p-4">
        <input type="hidden" name="empresaId" value={empresaId} />
        <input type="hidden" name="usuarioId" value={dono.id} />
        {voltar && <input type="hidden" name="voltar" value={voltar} />}
        <div className="space-y-1">
          <label htmlFor={`${campo}-motivo`} className="rotulo">
            Motivo (a pessoa recebe por e-mail)
          </label>
          <input
            id={`${campo}-motivo`}
            name="motivo"
            required
            maxLength={500}
            placeholder="Ex.: o nome não bate com os sócios na Receita"
            className="campo py-1.5 sm:text-sm"
          />
        </div>
        <label className="flex cursor-pointer items-start gap-2 leading-relaxed">
          <input type="checkbox" name="confirmo" value="sim" required className="mt-1 h-4 w-4 shrink-0 accent-coral" />
          <span>
            Confirmo: {dono.nome} deixa de ser dono de @{username}. Perde a edição do perfil, a liberação do Clube do Bem e as
            ofertas que criou.
          </span>
        </label>
        <BotaoEnviar className="botao-claro botao-pequeno whitespace-nowrap text-coral-700" enviando="Removendo…">
          Remover {dono.nome.split(" ")[0]}
        </BotaoEnviar>
      </form>
    </details>
  );
}
