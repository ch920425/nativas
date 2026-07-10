#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_TUNNEL_TOKEN:?Set the token for the api.nativas.ai Cloudflare Tunnel connector}"
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is required. Install it with: brew install cloudflared" >&2
  exit 1
fi
exec cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
