# Lane 2 — Codex backend, Hermes, runtime, capture, and payments

## Mission and ownership

Deliver real autonomous execution while Hermes remains the sole semantic orchestrator. Act as the contract/integration lead and exclusively own root workspace configuration, lockfiles, shared deployment configuration, `packages/contracts/**`, `apps/runtime/**`, `convex/**`, `workers/capture/**`, `tests/backend/**`, `fixtures/contracts/**`, and `fixtures/runtime/**` after lane dispatch.

## Delivery order

1. Publish contract v1 package and canonical fixtures.
2. Pass pinned Hermes `doctor`, authenticated loopback Run/SSE, and one real flat delegation batch.
3. Implement Convex schema/functions and atomic state/event transitions.
4. Implement relay claim/reserve/start/bind/heartbeat, crash-boundary session reconciliation, Runs SSE normalization/status reconciliation, and stop. An uncertain create outcome fails closed; it never blind-retries.
5. Implement URL-safe Browser Run snapshot→private R2→CaptureManifest.
6. Consume Lane 3's isolated read-only gbrain MCP and implement one-attempt Linkup `standard` adapter.
7. Install `nativas-audit-v1`; expose only `capture_site`, `search_market_evidence`, and `submit_report` plus native delegation/read-only KB tools.
8. Implement deterministic report validation/publication.
9. Implement Dodo checkout, raw-body signature verification, deduplication, and atomic paid-audit creation.

The relay/Convex never choose roles, evidence, rewrites, repair, or quality. No plugin, progress tool, Exa, alternate crawler, recursive agents, or canned report. Linkup may degrade to KB-only only after a real Linkup smoke succeeds; capture/Hermes/report failures are terminal. Paid continuation is a new run with explicit context and a two-additional-surface cap, each surface represented by one source/target locale pair.

## Tests and handoff

Test contracts; state/lease/event ordering; the Hermes create-before-bind crash boundary; SSRF/redirects; Browser Run/R2 success and failures; Hermes normalization plus live delegation smoke; Linkup success/timeout/malformed; report references/count/language/idempotency; Dodo valid/invalid/duplicate/reconciliation. Handoff includes env placeholders, commands, deployed URLs, Hermes version/config, live-smoke IDs, coverage, and typed limitations. P0 is done when one live free report and a duplicate payment replay create and start exactly one context-linked paid run. A completed paid report is P1.
