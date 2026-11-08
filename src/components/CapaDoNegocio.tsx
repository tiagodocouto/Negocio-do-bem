import { CapaDaCidade } from "@/components/CapaDaCidade";
import { fotoDaCidade } from "@/lib/fotos-das-cidades";
import { svgDoIcone } from "@/lib/marca";

const ICONE_CREME = `data:image/svg+xml,${encodeURIComponent(svgDoIcone("creme"))}`;

/**
 * A capa do perfil. O negócio só tem a foto de perfil, então a capa vem da cidade:
 * a foto de cartão-postal, quando a cidade tem uma, ou o banner da marca.
 */
export function CapaDoNegocio({ cidade, uf }: { cidade: string; uf: string }) {
  const foto = fotoDaCidade(cidade, uf);
  if (foto) return <CapaDaCidade foto={foto} faixa />;
  return (
    <div
      role="img"
      aria-label="Negócio do Bem: compre de quem faz o bem"
      className="flex h-48 items-center justify-center gap-6 rounded-3xl bg-marca-laranja px-6 sm:h-64 sm:gap-10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ICONE_CREME} alt="" className="h-20 w-auto sm:h-28" />
      <p className="max-w-[12rem] font-serif text-2xl leading-tight font-semibold text-marca-creme sm:max-w-xs sm:text-4xl">
        Compre de quem faz o bem.
      </p>
    </div>
  );
}
