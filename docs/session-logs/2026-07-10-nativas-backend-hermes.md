# nativas.ai backend and Hermes session log

## Scope

- Branch: `agent/backend-hermes`
- Governing prompt: `docs/agent-prompts/02-codex-backend-hermes.md`
- Mode: iterative ultrawork delivery with milestone commits

## Runtime core

- Added legal audit transitions, Hermes start reservation/create/bind safety, normalized events, report idempotency, parent-only operational capability checks, bounded Linkup search, and canonical Dodo continuation.
- Expanded capture handling to validate DNS and every preflight redirect before snapshot, require all four Browser Run artifacts, and enforce redirect and byte bounds.
- Added lease ownership, heartbeat, expiry reclaim, persisted status reconciliation, operator cancellation, and typed Hermes terminal failure handling.
- Added same-domain locale candidate enforcement and report gates for identity, references, uniqueness, size, unchanged copy, and target language.
- Found and fixed an IPv6 SSRF bypass caused by bracketed WHATWG URL hostnames such as `[::1]`.

## Integration rehearsal

- Integrated the clean knowledge-base lane.
- Added a local rehearsal covering free audit, Hermes reservation/bind, safe four-artifact capture, deterministic KB retrieval, bounded Linkup evidence, exactly-three report publication, duplicate verified Dodo delivery, and exactly-one linked paid run start.
- The rehearsal asserted two Hermes sessions total, one free plus one paid, and exactly one paid audit after duplicate webhook delivery.

## Validation

- Backend tests: 32/32 passed.
- Knowledge-base tests: 18/18 passed.
- Backend-only coverage: 100.00% lines, 95.33% branches, 98.28% functions.
- TypeScript, repository, Hermes specification, secret, and whitespace checks passed.

## Delivery and live gates

- Backend delivery head: `bdef650`.
- Hermes gateway was stopped; Convex was unlinked; Linkup had no configured API key; Cloudflare authentication was expired; Dodo product lookup returned a connection error.
- No deployment URLs, live audit IDs, or live run IDs were produced, and no canned values were reported as live evidence.
