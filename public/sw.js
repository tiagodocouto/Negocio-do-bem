// Service worker do Negócio do Bem, escrito à mão e sem biblioteca. Registrado
// por RegistrarServiceWorker (só em produção). Veja "Mudar ou desligar o
// service worker" em docs/como-foi-feito.md.
//
// - Páginas: sempre pela rede, para os dados virem sempre atualizados. Sem
//   conexão, mostra /offline.html. O HTML das páginas nunca é guardado.
// - A página "Sem conexão" e o ícone dela: guardados na instalação.
// - Arquivos de /_next/static (JS, CSS e fontes, com hash no nome): do cache
//   primeiro, porque não mudam. Os mais antigos saem quando passam do limite.
// - O resto passa direto, sem o service worker: Server Actions (POST), /api,
//   dados das navegações (RSC), imagens e fotos.
//
// Mudou o comportamento deste arquivo? Troque a VERSAO: os caches antigos são
// apagados quando a versão nova assume.

const VERSAO = "2";
const CACHE_SEM_CONEXAO = `sem-conexao-${VERSAO}`;
const CACHE_ARQUIVOS = `arquivos-${VERSAO}`;
const NOSSOS_CACHES = [CACHE_SEM_CONEXAO, CACHE_ARQUIVOS];
const PAGINA_SEM_CONEXAO = "/offline.html";
const GUARDADOS_NA_INSTALACAO = [PAGINA_SEM_CONEXAO, "/icones/icone-192.png"];
const LIMITE_DE_ARQUIVOS = 200;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_SEM_CONEXAO)
      .then((cache) => Promise.all(GUARDADOS_NA_INSTALACAO.map((url) => guardar(cache, url))))
      .then(() => self.skipWaiting()),
  );
});

/**
 * Guarda a resposta sem a marca de redirecionamento. No Cloudflare, /offline.html
 * redireciona para /offline, e o navegador recusa uma resposta redirecionada no
 * lugar de uma página: mostraria o erro de rede em vez da página "Sem conexão".
 */
async function guardar(cache, url) {
  const resposta = await fetch(url, { cache: "reload" });
  if (!resposta.ok) throw new Error(`${url} respondeu ${resposta.status}`);
  const copia = resposta.redirected
    ? new Response(await resposta.blob(), { status: resposta.status, statusText: resposta.statusText, headers: resposta.headers })
    : resposta;
  await cache.put(url, copia);
}

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((nome) => /^(sem-conexao|arquivos)-/.test(nome) && !NOSSOS_CACHES.includes(nome))
          .map((nome) => caches.delete(nome)),
      );
      // Sem navigationPreload de propósito: com ele ligado, as navegações que
      // passam direto (/api) iriam duas vezes ao servidor, e o login do Google
      // começaria duas vezes.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && !url.pathname.startsWith("/api/")) {
    evento.respondWith(pagina(evento));
  } else if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(arquivo(evento));
  } else if (GUARDADOS_NA_INSTALACAO.includes(url.pathname)) {
    evento.respondWith(caches.match(request).then((guardado) => guardado ?? fetch(request)));
  }
});

async function pagina(evento) {
  try {
    return await fetch(evento.request);
  } catch {
    // Só falha de rede chega aqui. Um erro do servidor (500, 404) é uma resposta e passa.
    return (await caches.match(PAGINA_SEM_CONEXAO)) ?? Response.error();
  }
}

async function arquivo(evento) {
  const cache = await caches.open(CACHE_ARQUIVOS);
  const guardado = await cache.match(evento.request);
  if (guardado) return guardado;
  const resposta = await fetch(evento.request);
  if (resposta.ok) {
    evento.waitUntil(cache.put(evento.request, resposta.clone()).then(() => aparar(cache)));
  }
  return resposta;
}

/** Apaga os arquivos guardados há mais tempo quando passam do limite. Cada deploy traz arquivos novos. */
async function aparar(cache) {
  const chaves = await cache.keys();
  const sobra = chaves.length - LIMITE_DE_ARQUIVOS;
  if (sobra > 0) await Promise.all(chaves.slice(0, sobra).map((chave) => cache.delete(chave)));
}
