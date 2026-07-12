# Paid deep-audit completion specification — 2026-07-11

## Production checkpoint

- Re-verified the complete deterministic suite: 61/61 tests passed.
- Re-verified root TypeScript typecheck and Cloudflare production build.
- Re-deployed the committed frontend/edge Worker as version `a72689ac-7ec1-4674-99de-9a15586dc2b4`.
- `https://nativas.ai/health` returned `{ "ok": true, "runtime": "local", "hermes": "native-runs" }`.
- GitHub remote and active account were verified as `ch920425/nativas` and `ch920425`.

## Confirmed runtime boundary

Production requests terminate at the Cloudflare Worker and traverse Cloudflare Tunnel to the laptop-local API on `127.0.0.1:8787`. That process starts the laptop-local Hermes Native Runs gateway on `127.0.0.1:8642`. Hermes is not running in Hermes Cloud or a Cloudflare Container.

## Confirmed completion gap

The paid Dodo transaction, signed webhook, reconciliation fallback, paid audit ID, and second Hermes run are real. The second run is not yet a deep audit: it does not discover additional pages, capture rendered screenshots, execute evidence-grounded specialist analysis, validate/persist a paid report, transition through a separate paid audit lifecycle, or render a completed paid-report page.

## Deliverable

This session produces a new implementation-ready completion specification covering the smallest robust end-to-end architecture, explicit contracts and state transitions, production infrastructure, security, observability, deployment/rollback, and a risk-weighted test matrix requiring at least 95% meaningful production-like coverage.
