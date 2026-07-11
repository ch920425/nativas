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
exec /opt/homebrew/bin/node apps/local-server/src/server.ts
