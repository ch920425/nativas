# Cloudflare production readiness

## Decision

Deploy the public React application and API edge relay as one Cloudflare Worker. Keep Hermes native runs on the laptop for the hackathon; Cloudflare Tunnel connects `api.<domain>` to the laptop's local API.

## Security boundary

The Worker injects an `EDGE_ORIGIN_TOKEN` secret on API relay requests. The laptop API accepts requests only when that token is present once `NATIVAS_EDGE_TOKEN` is configured. The browser receives neither the tunnel origin nor the token.

## Prepared and verified

- Static SPA asset serving, SPA fallback, Worker-first `/api/*` and `/health` routing.
- Proxy behavior tests: configured origin/token relay, unconfigured typed error, asset path behavior.
- Cloudflare production build, typecheck, preflight, and `wrangler deploy --dry-run` passed through the account-authenticated `cloudflare-env` wrapper.
- Exact launch and recovery instructions live in `docs/operations/cloudflare-production.md`.

## Remaining external dependency

The domain must be purchased and active in Cloudflare, then a named Zero Trust tunnel must be given the `api.<domain>` public hostname. Those account/domain actions cannot be completed before the domain exists.
