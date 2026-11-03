// Prévia do link de uma página de cidade: "Negócios do bem em Salvador, BA".
// A cidade com foto tem a prévia pronta de antemão, em JPEG: o npm run
// cidades:fotos põe este desenho por cima da foto (scripts/fotos-das-cidades.ts).
// A cidade sem foto usa o mesmo texto no creme da marca, com quantos negócios ela
// tem, gerado na hora (src/app/cidades/[cidade]/opengraph-image.tsx).

import { LogoNaImagem, SUAVE } from "@/lib/compartilhamento";
import { CORES_DA_MARCA } from "@/lib/marca";

/**
 * `sobreFoto` deixa o fundo transparente, com uma sombra embaixo para o texto
 * branco aparecer em cima da foto. `quantos` só vai na prévia gerada na hora: a
 * pronta de antemão não acompanha o número de negócios.
 */
export function PreviaDaCidade({ nome, quantos, sobreFoto = false }: { nome: string; quantos?: string; sobreFoto?: boolean }) {
  const tamanhoDoNome = nome.length > 22 ? 76 : nome.length > 15 ? 92 : 108;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "48px 72px 56px",
        borderBottom: `14px solid ${CORES_DA_MARCA.laranja}`,
        ...(sobreFoto
          ? { backgroundImage: "linear-gradient(to top, rgba(45, 37, 29, 0.88) 0%, rgba(45, 37, 29, 0.45) 45%, rgba(45, 37, 29, 0) 75%)" }
          : { background: CORES_DA_MARCA.creme }),
      }}
    >
      <div style={{ display: "flex" }}>
        <div style={{ display: "flex", padding: sobreFoto ? "16px 28px" : 0, borderRadius: 999, background: sobreFoto ? CORES_DA_MARCA.creme : "transparent" }}>
          <LogoNaImagem largura={sobreFoto ? 250 : 290} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "Inter", fontSize: 34, color: sobreFoto ? CORES_DA_MARCA.creme : SUAVE }}>Negócios do bem em</div>
        <div
          style={{
            marginTop: 6,
            fontFamily: "Newsreader",
            fontSize: tamanhoDoNome,
            lineHeight: 1.04,
            color: sobreFoto ? "#ffffff" : CORES_DA_MARCA.marrom,
          }}
        >
          {nome}
        </div>
        {quantos && (
          <div style={{ display: "flex", marginTop: 26 }}>
            <div
              style={{
                display: "flex",
                padding: "10px 24px",
                borderRadius: 999,
                background: CORES_DA_MARCA.laranja,
                color: "#ffffff",
                fontFamily: "Inter",
                fontSize: 28,
              }}
            >
              {quantos}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
