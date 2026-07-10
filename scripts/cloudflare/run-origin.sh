#!/usr/bin/env bash
set -euo pipefail

: "${NATIVAS_EDGE_TOKEN:?Set the same token configured as the Worker EDGE_ORIGIN_TOKEN secret}"
export NATIVAS_API_PORT="${NATIVAS_API_PORT:-8787}"
exec npm run dev:api
