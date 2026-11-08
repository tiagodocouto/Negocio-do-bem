import { LARGURA_DA_FOTO_PEQUENA, type FotoDaCidade } from "@/lib/fotos-das-cidades";

/**
 * A foto de cartão-postal no topo da página da cidade, com o crédito que a licença
 * do Commons pede: autor, licença e de onde veio. No celular, a versão pequena.
 */
export function CapaDaCidade({ foto, faixa = false }: { foto: FotoDaCidade; faixa?: boolean }) {
  const linkExterno = "underline decoration-linha underline-offset-2 hover:text-tinta";
  return (
    <figure>
      {/* As fotos já estão reduzidas, em dois tamanhos (ver scripts/fotos-das-cidades.ts). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.src}
        srcSet={`${foto.srcPequena} ${Math.min(LARGURA_DA_FOTO_PEQUENA, foto.largura)}w, ${foto.src} ${foto.largura}w`}
        sizes={faixa ? "(min-width: 64rem) 64rem, calc(100vw - 2rem)" : "(min-width: 64rem) 30rem, calc(100vw - 2rem)"}
        width={foto.largura}
        height={foto.altura}
        alt={foto.alt}
        fetchPriority="high"
        className={`w-full rounded-3xl bg-superficie object-cover ${faixa ? "h-48 sm:h-64" : "aspect-video lg:aspect-[4/3]"}`}
      />
      <figcaption className={`mt-2 text-xs leading-relaxed text-suave ${faixa ? "text-right" : "lg:text-right"}`}>
        Foto: {foto.autor} ·{" "}
        {foto.licencaUrl ? (
          <a href={foto.licencaUrl} rel="license noopener" className={linkExterno}>
            {foto.licenca}
          </a>
        ) : (
          foto.licenca
        )}
        , via{" "}
        <a href={foto.pagina} rel="noopener" className={linkExterno}>
          Wikimedia Commons
        </a>
      </figcaption>
    </figure>
  );
}
