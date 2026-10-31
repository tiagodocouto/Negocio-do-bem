// Peças das imagens de compartilhamento (opengraph-image.tsx): a prévia que
// aparece quando alguém manda um link do site no WhatsApp, Instagram, LinkedIn etc.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CORES_DA_MARCA, ICONE, LOGO, svgDoIcone, svgDoLogo } from "@/lib/marca";

export const TAMANHO = { width: 1200, height: 630 };

export const SUAVE = "#6e6357";

// Instâncias estáticas das fontes variáveis do site (licença OFL, ver assets/fontes).
// O ImageResponse não lê woff2 nem fontes variáveis.
const [newsreader, inter] = await Promise.all([
  readFile(join(process.cwd(), "assets/fontes/Newsreader-SemiBold.ttf")),
  readFile(join(process.cwd(), "assets/fontes/Inter-Medium.ttf")),
]);

export const FONTES = [
  { name: "Newsreader", data: newsreader, weight: 600 as const, style: "normal" as const },
  { name: "Inter", data: inter, weight: 500 as const, style: "normal" as const },
];

function dataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const LOGO_CLARO = dataUri(svgDoLogo("claro"));
const ICONE_CREME = dataUri(svgDoIcone("creme"));

/** Logo horizontal na largura pedida. */
export function LogoNaImagem({ largura }: { largura: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_CLARO} width={largura} height={Math.round((largura * LOGO.altura) / LOGO.largura)} alt="" />;
}

/** Imagem geral do site: o logo e o lema à esquerda, o ícone em creme no laranja à direita. */
export function ImagemDoSite() {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: CORES_DA_MARCA.creme }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 72px" }}>
        <LogoNaImagem largura={560} />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            marginTop: 56,
            fontFamily: "Newsreader",
            fontSize: 68,
            lineHeight: 1.05,
            color: CORES_DA_MARCA.marrom,
          }}
        >
          Compre de quem&nbsp;<span style={{ color: CORES_DA_MARCA.laranja }}>faz o bem.</span>
        </div>
        <div style={{ marginTop: 22, fontFamily: "Inter", fontSize: 28, lineHeight: 1.35, color: SUAVE }}>
          Negócios com consciência social e raízes na comunidade.
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 400, background: CORES_DA_MARCA.laranja }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ICONE_CREME} width={270} height={Math.round((270 * ICONE.altura) / ICONE.largura)} alt="" />
      </div>
    </div>
  );
}
