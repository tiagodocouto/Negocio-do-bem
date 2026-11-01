import { criarAuth } from "@/lib/auth/better-auth";

async function atender(requisicao: Request): Promise<Response> {
  const caminho = new URL(requisicao.url).pathname;
  if (caminho !== "/api/auth/get-session") return new Response("Not Found", { status: 404 });
  return criarAuth().handler(requisicao);
}

export const GET = atender;
export const POST = atender;
