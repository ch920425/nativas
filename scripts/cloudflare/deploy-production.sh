#!/usr/bin/env bash
set -euo pipefail

npm run build:cloudflare
npm run preflight:cloudflare

cat <<'EOF'
Build and Worker-contract checks passed.

Production Cloudflare changes are intentionally made through the authenticated
Cloudflare MCP, not from this local script. In a Codex session with the
Cloudflare MCP enabled, deploy the Worker, set API_ORIGIN and EDGE_ORIGIN_TOKEN
as Worker secrets, and verify https://nativas.ai/health.

The laptop runtime needs only two local secrets in Keychain/environment:
NATIVAS_EDGE_TOKEN and CLOUDFLARE_TUNNEL_TOKEN. Do not add Cloudflare API
tokens or OAuth credentials to this repo, the Node backend, or launchd plists.
EOF
