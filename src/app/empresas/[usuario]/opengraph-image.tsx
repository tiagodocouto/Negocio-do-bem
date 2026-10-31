import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { buscarCausa, filtrarCausas } from "@/lib/causas";
import { FONTES, ImagemDoSite, LogoNaImagem, SUAVE, TAMANHO } from "@/lib/compartilhamento";
import { buscarPerfil } from "@/lib/consultas";
import { ehFotoDoSite } from "@/lib/fotos";
import { normalizarUsername } from "@/lib/instagram";
import { CORES_DA_MARCA } from "@/lib/marca";
import { iniciais } from "@/lib/texto";

// Prévia do link de um perfil: foto, nome, tipo, cidade e causas do negócio.
// Perfis fora do diretório levam a imagem geral do site, sem dados do negócio.
export const alt = "Perfil de um negócio no Negócio do Bem";
export const size = TAMANHO;
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ usuario: string }> }) {
  const username = normalizarUsername((await params).usuario);
  const empresa = username ? await buscarPerfil(username) : null;
  if (!empresa || empresa.moderacao !== "aprovada" || empresa.oculta) {
    return new ImageResponse(<ImagemDoSite />, { ...TAMANHO, fonts: FONTES });
  }

  const foto = await fotoEmDataUri(empresa.fotoUrl);
  const causas = filtrarCausas(empresa.causas.map((c) => c.causa))
    .slice(0, 3)
    .map((slug) => buscarCausa(slug)!.nome);
  const nome = empresa.nome.length > 70 ? `${empresa.nome.slice(0, 68).trimEnd()}…` : empresa.nome;

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <LogoNaImagem largura={290} />
          {empresa.status === "verificada" && (
            <Etiqueta fundo="#e8f3ec" cor={CORES_DA_MARCA.verde}>
              Verificado pelo dono
            </Etiqueta>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", flex: 1, gap: 48 }}>
          {foto ? (
            <img
              src={foto}
              width={220}
              height={220}
              alt=""
              style={{ borderRadius: 999, objectFit: "cover", border: "6px solid #fffdf9" }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 220,
                height: 220,
                borderRadius: 999,
                background: CORES_DA_MARCA.laranja,
                color: CORES_DA_MARCA.creme,
                fontFamily: "Newsreader",
                fontSize: 96,
              }}
            >
              {iniciais(empresa.nome)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                fontFamily: "Newsreader",
                fontSize: nome.length > 40 ? 58 : nome.length > 22 ? 70 : 84,
                lineHeight: 1.04,
                color: CORES_DA_MARCA.marrom,
              }}
            >
              {nome}
            </div>
            <div style={{ marginTop: 18, fontFamily: "Inter", fontSize: 32, color: SUAVE }}>
              {`${empresa.categoria} · ${empresa.cidade}, ${empresa.uf}`}
            </div>
          </div>
        </div>

        {causas.length > 0 && (
          <div style={{ display: "flex", gap: 14 }}>
            {causas.map((causa) => (
              <Etiqueta key={causa} fundo="#fbdccd" cor="#b9401d">
                {causa}
              </Etiqueta>
            ))}
          </div>
        )}
      </div>
    ),
    { ...TAMANHO, fonts: FONTES },
  );
}

function Etiqueta({ fundo, cor, children }: { fundo: string; cor: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "10px 22px",
        borderRadius: 999,
        background: fundo,
        color: cor,
        fontFamily: "Inter",
        fontSize: 26,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Foto do perfil como data URI. O ImageResponse não lê WebP, e uma foto que não
 * carrega derrubaria a imagem inteira: nesses casos fica o monograma.
 */
async function fotoEmDataUri(url: string | null): Promise<string | null> {
  if (!ehFotoDoSite(url)) return null;
  const tipo = /\.png$/i.test(url) ? "image/png" : /\.jpe?g$/i.test(url) ? "image/jpeg" : null;
  if (!tipo) return null;
  try {
    let dados: Buffer;
    if (url.startsWith("/enviados/")) {
      dados = await readFile(join(process.cwd(), "public", url));
    } else {
      const resposta = await fetch(url);
      if (!resposta.ok) return null;
      dados = Buffer.from(await resposta.arrayBuffer());
    }
    return `data:${tipo};base64,${dados.toString("base64")}`;
  } catch {
    return null;
  }
}
