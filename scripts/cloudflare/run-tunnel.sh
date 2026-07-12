#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

if [ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  CLOUDFLARE_TUNNEL_TOKEN="$(security find-generic-password -a "$USER" -s nativas-cloudflared-tunnel-token -w 2>/dev/null || true)"
fi
: "${CLOUDFLARE_TUNNEL_TOKEN:?Store the api.nativas.ai connector token in the macOS Keychain}"
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is required. Install it with: brew install cloudflared" >&2
  exit 1
fi
exec cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN"
