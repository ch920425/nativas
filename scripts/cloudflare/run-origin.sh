#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin"

if [ -z "${NATIVAS_EDGE_TOKEN:-}" ]; then
  NATIVAS_EDGE_TOKEN="$(security find-generic-password -a "$USER" -s nativas-edge-origin-token -w 2>/dev/null || true)"
fi
if [ -z "$NATIVAS_EDGE_TOKEN" ]; then
  echo "NATIVAS_EDGE_TOKEN is required; set it or save it in the macOS Keychain service nativas-edge-origin-token." >&2
  exit 1
fi
export NATIVAS_EDGE_TOKEN
export NATIVAS_API_PORT="${NATIVAS_API_PORT:-8787}"
export NATIVAS_PUBLIC_URL="${NATIVAS_PUBLIC_URL:-https://nativas.ai}"
export DODO_ENVIRONMENT="${DODO_ENVIRONMENT:-test_mode}"
if [ -z "${DODO_PAYMENTS_API_KEY:-}" ]; then
  DODO_PAYMENTS_API_KEY="$(security find-generic-password -a "$USER" -s nativas-dodo-api-key -w 2>/dev/null || true)"
fi
if [ -z "${DODO_PRODUCT_ID:-}" ]; then
  DODO_PRODUCT_ID="$(security find-generic-password -a "$USER" -s nativas-dodo-product-id -w 2>/dev/null || true)"
fi
export DODO_PAYMENTS_API_KEY DODO_PRODUCT_ID
exec /opt/homebrew/bin/node apps/local-server/src/server.ts
