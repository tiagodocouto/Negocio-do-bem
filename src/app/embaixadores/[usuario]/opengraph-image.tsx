import { ImageResponse } from "next/og";
import { FONTES, fotoEmDataUri, ImagemDoSite, LogoNaImagem, SUAVE, TAMANHO } from "@/lib/compartilhamento";
import { embaixadorDoEndereco, tituloComLugar } from "@/lib/embaixadores";
import { CORES_DA_MARCA } from "@/lib/marca";
import { iniciais } from "@/lib/texto";

// Prévia do link da página de um embaixador: a foto com o anel laranja, o nome, o
// @, onde atua e os seguidores. Um @ que não é de embaixador no site leva a imagem
// geral do site.
export const alt = "Página de um embaixador do bem no Negócio do Bem";
export const size = TAMANHO;
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ usuario: string }> }) {
  const embaixador = await embaixadorDoEndereco((await params).usuario);
  if (!embaixador) return new ImageResponse(<ImagemDoSite />, { ...TAMANHO, fonts: FONTES });

  const foto = await fotoEmDataUri(embaixador.fotoUrl);
  const nome = embaixador.nome.length > 50 ? `${embaixador.nome.slice(0, 48).trimEnd()}…` : embaixador.nome;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "52px 72px 64px",
          background: CORES_DA_MARCA.creme,
          borderBottom: `14px solid ${CORES_DA_MARCA.laranja}`,
        }}
      >
        <LogoNaImagem largura={290} />

        <div style={{ display: "flex", alignItems: "center", flex: 1, gap: 52 }}>
          <div style={{ display: "flex", padding: 8, borderRadius: 999, border: `6px solid ${CORES_DA_MARCA.laranja}` }}>
            {foto ? (
              <img src={foto} width={232} height={232} alt="" style={{ borderRadius: 999, objectFit: "cover" }} />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 232,
                  height: 232,
                  borderRadius: 999,
                  background: CORES_DA_MARCA.laranja,
                  color: CORES_DA_MARCA.creme,
                  fontFamily: "Newsreader",
                  fontSize: 96,
                }}
              >
                {iniciais(embaixador.nome)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontFamily: "Inter", fontSize: 28, color: "#b9401d" }}>{tituloComLugar(embaixador)}</div>
            <div
              style={{
                marginTop: 12,
                fontFamily: "Newsreader",
                fontSize: nome.length > 28 ? 62 : 78,
                lineHeight: 1.04,
                color: CORES_DA_MARCA.marrom,
              }}
            >
              {nome}
            </div>
            <div style={{ marginTop: 18, fontFamily: "Inter", fontSize: 32, color: SUAVE }}>
              {embaixador.seguidores
                ? `@${embaixador.instagramUsername} · ${embaixador.seguidores} seguidores`
                : `@${embaixador.instagramUsername}`}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...TAMANHO, fonts: FONTES },
  );
}
