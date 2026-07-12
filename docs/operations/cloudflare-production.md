# Cloudflare production launch

## Architecture

`nativas.ai` is one Cloudflare Worker that serves the built React app as static assets, owns the private screenshot evidence plane, and handles `/api/*` and `/health` before the asset layer. Ordinary API requests are forwarded server-to-server to `https://api.nativas.ai`, a named Cloudflare Tunnel that terminates at `http://127.0.0.1:8787` on the Hermes laptop.

The browser never learns the tunnel address or the shared `EDGE_ORIGIN_TOKEN`. The Worker attaches that secret on each relay request; the local API rejects requests without it whenever `NATIVAS_EDGE_TOKEN` is set. This is deliberately a hackathon bridge: the laptop must stay awake and connected for audits to run.

## What is already prepared

- `wrangler.jsonc`: static-asset Worker with SPA fallback, Worker-first API routing, and Cloudflare observability.
- `cloudflare/worker.mjs`: same-origin API relay with a typed unconfigured response rather than a misleading failure.
- `cloudflare/evidence-plane.mjs`: replay-resistant internal capture endpoint, Browser Run Snapshot orchestration, immutable private R2 artifacts, and audit-scoped screenshot delivery.
- `scripts/cloudflare/deploy-production.sh`: builds and validates the Worker contract. Deployment, Worker secrets, domains, and observability are controlled through the authenticated Cloudflare MCP.
- `scripts/cloudflare/run-origin.sh`: starts the protected laptop API.
- `scripts/cloudflare/run-tunnel.sh`: starts the named tunnel connector after its Cloudflare-issued token is available.

## Launch once the Cloudflare zone is active

1. Add the domain to Cloudflare and finish nameserver activation. Install `cloudflared` on the laptop with `brew install cloudflared` if it is not installed.
2. Enable R2, create `nativas-audit-artifacts`, and keep both `r2.dev` and custom public domains disabled. Never make this bucket public.
3. In the Cloudflare MCP, activate the existing named tunnel `nativas-hermes-laptop`. Keep public hostname `api.nativas.ai` mapped only to `http://127.0.0.1:8787`; store its connector token in macOS Keychain service `nativas-cloudflared-tunnel-token`.
4. Save a new random `NATIVAS_EDGE_TOKEN` in Keychain service `nativas-edge-origin-token` and a different random `NATIVAS_CAPTURE_ORIGIN_SECRET` in `nativas-capture-origin-secret`, then run:

   ```bash
   scripts/cloudflare/run-origin.sh
   scripts/cloudflare/run-tunnel.sh
   ```

5. In the Cloudflare control plane, deploy the Worker, attach the apex and `www` domains, and set `API_ORIGIN=https://api.nativas.ai`, `EDGE_ORIGIN_TOKEN`, `CAPTURE_ORIGIN_SECRET`, and a Worker-only `ARTIFACT_DELIVERY_SECRET`. The capture secret must match the laptop Keychain value; the artifact-delivery secret must never leave the Worker control plane.

6. Verify from an external network:

   ```bash
   curl -fsS https://<your-domain>/health
   ```

   It must return `{"ok":true,"runtime":"local","hermes":"native-runs"}`. Then complete one Dodo test payment and prove four selected pages become sixteen private R2 objects plus a manifest, only screenshot objects are retrievable with a short-lived audit-scoped capability, and the UI reaches `PAID_REPORT`.

## Operational limits

- This launch is intentionally dependent on the laptop and tunnel process; closing the laptop, losing network, or stopping either process makes fresh audits unavailable.
- Quick Tunnels are deliberately excluded from production: their random URLs and process lifetime are unsuitable for a stable origin. Use the named tunnel only.
- Rotate `NATIVAS_EDGE_TOKEN` after the hackathon or whenever access is uncertain; update both the Worker secret and laptop environment together.
- Rotate `NATIVAS_CAPTURE_ORIGIN_SECRET` independently of edge-origin auth. Capture requests use a five-minute timestamp window, unique request ID, HMAC body signature, and R2 replay marker.
- Browser Run is invoked through the Worker binding and R2 through a private binding. No Cloudflare API token is present in the application runtime.
