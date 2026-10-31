import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { filtrarCausas } from "@/lib/causas";
import { listarParaSitemap } from "@/lib/consultas";
import { hrefCausa, hrefTipo, temPaginaDeTipo } from "@/lib/diretorio";
import { ehFotoDoSite } from "@/lib/fotos";
import { paginaDaCidade, urlAbsoluta } from "@/lib/seo";

// Páginas públicas, as páginas de cidade, causa e tipo que têm negócios e todos
// os negócios do diretório, para o Google e o Bing acharem cada um. O robots.txt
// aponta para cá.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Lido do banco a cada pedido, como o resto do site: um negócio aprovado
  // entra no sitemap na hora, e um oculto sai na hora.
  await connection();
  const negocios = await listarParaSitemap();
  const ultimaMudanca = negocios[0]?.atualizadoEm;

  // Cada página de cidade, causa e tipo muda quando muda o negócio dela atualizado
  // por último. A lista vem do mais recente para o mais antigo: vale o primeiro.
  // A cidade vai pelo nome oficial, que junta as grafias diferentes dela.
  const mudancas = new Map<string, Date>();
  const marcar = (caminho: string, quando: Date) => {
    if (!mudancas.has(caminho)) mudancas.set(caminho, quando);
  };
  for (const negocio of negocios) {
    marcar(paginaDaCidade(negocio.cidade, negocio.uf).caminho, negocio.atualizadoEm);
    if (temPaginaDeTipo(negocio.categoria)) marcar(hrefTipo(negocio.categoria), negocio.atualizadoEm);
    for (const causa of filtrarCausas(negocio.causas.map((c) => c.causa))) marcar(hrefCausa(causa), negocio.atualizadoEm);
  }

  return [
    { url: urlAbsoluta("/"), lastModified: ultimaMudanca },
    { url: urlAbsoluta("/explorar"), lastModified: ultimaMudanca },
    { url: urlAbsoluta("/cidades"), lastModified: ultimaMudanca },
    { url: urlAbsoluta("/sobre") },
    { url: urlAbsoluta("/participar") },
    ...[...mudancas].map(([caminho, quando]) => ({ url: urlAbsoluta(caminho), lastModified: quando })),
    ...negocios.map((negocio) => ({
      url: urlAbsoluta(`/empresas/${negocio.instagramUsername}`),
      lastModified: negocio.atualizadoEm,
      ...(ehFotoDoSite(negocio.fotoUrl) && { images: [urlAbsoluta(negocio.fotoUrl)] }),
    })),
  ];
}
