# Cloudflare production launch

## Architecture

`nativas.ai` is one Cloudflare Worker that serves the built React app as static assets and handles `/api/*` and `/health` before the asset layer. Those API requests are forwarded server-to-server to `https://api.nativas.ai`, a Cloudflare Tunnel that terminates at `http://127.0.0.1:8787` on the Hermes laptop.

The browser never learns the tunnel address or the shared `EDGE_ORIGIN_TOKEN`. The Worker attaches that secret on each relay request; the local API rejects requests without it whenever `NATIVAS_EDGE_TOKEN` is set. This is deliberately a hackathon bridge: the laptop must stay awake and connected for audits to run.

## What is already prepared

- `wrangler.jsonc`: static-asset Worker with SPA fallback, Worker-first API routing, and Cloudflare observability.
- `cloudflare/worker.mjs`: same-origin API relay with a typed unconfigured response rather than a misleading failure.
- `scripts/cloudflare/deploy-production.sh`: builds and validates the Worker contract. Deployment, Worker secrets, domains, and observability are controlled through the authenticated Cloudflare MCP.
- `scripts/cloudflare/run-origin.sh`: starts the protected laptop API.
- `scripts/cloudflare/run-tunnel.sh`: starts the named tunnel connector after its Cloudflare-issued token is available.

## Launch once the Cloudflare zone is active

1. Add the domain to Cloudflare and finish nameserver activation. Install `cloudflared` on the laptop with `brew install cloudflared` if it is not installed.
2. In the Cloudflare MCP, create a named tunnel. Add public hostname `api.<your-domain>` with service `http://127.0.0.1:8787`; store its connector token in the macOS Keychain. This is the sole Cloudflare credential the laptop runtime needs.
3. In two laptop terminals, set the same random `NATIVAS_EDGE_TOKEN` in each environment, then run:

   ```bash
   scripts/cloudflare/run-origin.sh
   scripts/cloudflare/run-tunnel.sh
   ```

4. In the Cloudflare MCP, deploy the Worker, attach the apex and `www` domains, and set its `API_ORIGIN=https://api.<your-domain>` and `EDGE_ORIGIN_TOKEN` secrets. `scripts/cloudflare/deploy-production.sh` may be used locally only to build and preflight the artifact.

5. Verify from an external network:

   ```bash
   curl -fsS https://<your-domain>/health
   ```

   It must return `{"ok":true,"runtime":"local","hermes":"native-runs"}`. Then submit a public URL in the browser and wait for `FREE_REPORT`.

## Operational limits

- This launch is intentionally dependent on the laptop and tunnel process; closing the laptop, losing network, or stopping either process makes fresh audits unavailable.
- Quick Tunnels are deliberately excluded from production: their random URLs and process lifetime are unsuitable for a stable origin. Use the named tunnel only.
- Dodo checkout remains demo-simulated. Do not claim live payment processing until the signed Dodo webhook path is implemented.
- Rotate `NATIVAS_EDGE_TOKEN` after the hackathon or whenever access is uncertain; update both the Worker secret and laptop environment together.
