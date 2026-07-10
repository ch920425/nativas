#!/usr/bin/env bash
set -euo pipefail

: "${NATIVAS_DOMAIN:?Set NATIVAS_DOMAIN, e.g. nativas.ai}"
: "${NATIVAS_API_ORIGIN:?Set NATIVAS_API_ORIGIN, e.g. https://api.nativas.ai}"
: "${NATIVAS_EDGE_TOKEN:?Set a long random token; do not commit it}"

case "$NATIVAS_API_ORIGIN" in https://*) ;; *) echo "NATIVAS_API_ORIGIN must use HTTPS" >&2; exit 1;; esac

npm run build:cloudflare
npm run preflight:cloudflare
printf %s "$NATIVAS_API_ORIGIN" | cloudflare-env wrangler secret put API_ORIGIN
printf %s "$NATIVAS_EDGE_TOKEN" | cloudflare-env wrangler secret put EDGE_ORIGIN_TOKEN
cloudflare-env wrangler deploy --keep-vars --domain "$NATIVAS_DOMAIN" --domain "www.$NATIVAS_DOMAIN"
