export function SeloStatus({ status }: { status: string }) {
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
