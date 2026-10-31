import type { NextConfig } from "next";

const desenvolvimento = process.env.NODE_ENV === "development";
const preview = process.env.VERCEL_ENV === "preview";
const ANALYTICS = "https://*.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";
const VERCEL_LIVE = "https://vercel.live";

const politicaDeConteudo = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://*.googletagmanager.com${desenvolvimento ? " 'unsafe-eval'" : ""}${preview ? ` ${VERCEL_LIVE}` : ""}`,
  `style-src 'self' 'unsafe-inline'${preview ? ` ${VERCEL_LIVE}` : ""}`,
  `img-src 'self' data: blob: https://*.public.blob.vercel-storage.com ${ANALYTICS}${preview ? ` ${VERCEL_LIVE} https://vercel.com` : ""}`,
  `font-src 'self' data:${preview ? ` ${VERCEL_LIVE} https://assets.vercel.com` : ""}`,
  `connect-src 'self' ${ANALYTICS}${desenvolvimento ? " ws:" : ""}${preview ? ` ${VERCEL_LIVE} wss://ws-us3.pusher.com` : ""}`,
  `frame-src 'self'${preview ? ` ${VERCEL_LIVE}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(desenvolvimento ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const cabecalhosDeSeguranca = [
  { key: "Content-Security-Policy", value: politicaDeConteudo },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:caminho*", headers: cabecalhosDeSeguranca }];
  },
  /* config options here */
  cacheComponents: true,
  experimental: {
    // Fotos chegam reduzidas pelo navegador, mas o padrão de 1 MB é apertado.
    // O Vercel aceita até 4,5 MB por requisição.
    serverActions: { bodySizeLimit: "4mb" },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
