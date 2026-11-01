#!/bin/sh
set -e
DEPLOY_ENV=preview npm run cf:build -- "$@"
DEPLOY_ENV=preview npx opennextjs-cloudflare preview "$@"
