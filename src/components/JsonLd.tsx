/**
 * Dados estruturados para buscadores (ver src/lib/seo.ts). O "<" vira < para
 * um texto do negócio com "</script>" não fechar a tag antes da hora.
 */
export function JsonLd({ dados }: { dados: object }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dados).replace(/</g, "\\u003c") }} />
  );
}
