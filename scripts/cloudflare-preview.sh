#!/bin/sh
# Deploy dos previews no Cloudflare: o "Comando de preview" do Workers Builds,
# depois do npm run cf:build.
#
# As páginas com Partial Prerender têm uma casca gerada no build, que fica no
# cache incremental (o bucket R2 NEXT_INC_CACHE_R2_BUCKET). Sem ela, o Worker
# tenta gerar a página na hora e a requisição trava (erro 1101). Em produção, o
# opennextjs-cloudflare deploy preenche o cache antes de publicar; o wrangler
# preview, não. Por isso o cache é preenchido aqui, no bucket dos previews (o
# ambiente previews-cache do wrangler.jsonc), antes de subir o preview.
set -e

npx opennextjs-cloudflare populateCache remote --env previews-cache
npx wrangler preview
