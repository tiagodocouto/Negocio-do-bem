/**
 * `verificado`: a moderação conferiu o CNPJ, o nome e o CPF do dono e o liberou no Clube do
 * Bem (#293). Sem isso, o perfil só está "assumido": uma conta assumiu, sem conferência.
 */
export function SeloStatus({ status, verificado = false }: { status: string; verificado?: boolean }) {
  if (status === "verificada" && verificado) {
    return (
      <span
        title="A moderação conferiu o CNPJ e a identidade de quem cuida deste perfil."
        className="inline-flex items-center gap-1 rounded-full bg-folha-50 px-2.5 py-1 text-xs font-semibold text-folha"
      >
        <span aria-hidden="true">✓</span>
        Perfil verificado
      </span>
    );
  }
  if (status === "verificada") {
    return (
      <span
        title="Uma conta assumiu este perfil. O selo não certifica a identidade nem as causas do negócio."
        className="inline-flex items-center gap-1 rounded-full border border-linha bg-superficie px-2.5 py-1 text-xs font-semibold text-suave"
      >
        <span aria-hidden="true" className="text-sm leading-none">•</span>
        Perfil assumido
      </span>
    );
  }
  return (
    <span
      title="Indicado por alguém da comunidade; o dono ainda não reivindicou o perfil"
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
    >
      <span aria-hidden="true">✦</span>
      Indicado pela comunidade
    </span>
  );
}
