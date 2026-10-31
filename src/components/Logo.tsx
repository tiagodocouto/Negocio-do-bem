import { ICONE, LOGO, TEXTO_DO_LOGO } from "@/lib/marca";

// A terceira pessoa do ícone e o texto ficam creme no modo escuro, como na
// versão do manual para fundo escuro. O laranja e o verde não mudam.
const COR = {
  laranja: "fill-marca-laranja",
  terceira: "fill-marca-marrom escuro:fill-marca-creme",
  verde: "fill-marca-verde",
} as const;

const PESSOAS = ["laranja", "terceira", "verde"] as const;

/**
 * Logo horizontal: o ícone e "Negócio do Bem". A altura vem do className; a largura acompanha.
 * Menor abaixo de 360px, para caber no cabeçalho ao lado de "Indicar", do tema e de "Entrar".
 */
export function Logo({ className = "h-7 min-[360px]:h-9 sm:h-11" }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO.largura} ${LOGO.altura}`}
      width={LOGO.largura}
      height={LOGO.altura}
      role="img"
      aria-label="Negócio do Bem"
      className={`w-auto ${className}`}
    >
      <g transform={`scale(${LOGO.escalaDoIcone})`}>
        {PESSOAS.map((pessoa) => (
          <g key={pessoa} className={COR[pessoa]}>
            <path d={ICONE[pessoa].corpo} />
            <circle {...ICONE[pessoa].cabeca} />
          </g>
        ))}
      </g>
      <g transform={TEXTO_DO_LOGO.transformacao}>
        <path d={TEXTO_DO_LOGO.negocioBem} className={COR.terceira} />
        <path d={TEXTO_DO_LOGO.do} className={COR.laranja} />
      </g>
    </svg>
  );
}
