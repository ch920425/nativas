# Agent 2 — Backend, Hermes agency, infrastructure, and integration

**Recommended agent:** Codex (frontier coding model)

You are Lane 2 and integration owner for **navitas.ai**, a Hermes Buildathon “AI as Agency” product. The P0 proof is: one public KR/US homepage locale pair → one real Hermes parent run → genuine parallel specialist delegation → exactly three screenshot/evidence-grounded findings → verified Dodo payment → exactly one context-linked paid Hermes run.

## Start here

1. Use a dedicated worktree/branch from current `origin/main` (suggested: `agent/backend-hermes`). Never switch branches in the shared repo.
2. Read `AGENTS.md`, `PRD.md`, `TECH_SPEC.md`, all `docs/contracts/**`, `docs/hermes/local-runtime.md`, `hermes/README.md`, `hermes/config.example.yaml`, and `docs/workstreams/backend-runtime.md`.
3. Inspect and preserve the existing root workspace, `packages/contracts`, `apps/runtime`, `convex`, `workers/capture`, fixtures, and backend tests. Convert the fixture skeleton into the smallest real end-to-end vertical slice; do not rewrite stable pieces.

## Ownership

Own root workspace config/lockfiles plus:

- `packages/contracts/**`
- `apps/runtime/**`
- `convex/**`
- `workers/capture/**`
- `tests/backend/**`
- `fixtures/contracts/**`, `fixtures/runtime/**`
- deployment/config integration required by those paths

Do not edit frontend or KB-owned paths. You integrate their committed branches after their handoffs and resolve shared-contract issues centrally.

## Mission, in order

1. Keep one canonical typed contract package and legal free/paid state transitions in Convex.
2. Configure one dedicated local `navitas` Hermes profile: loopback Runs API, one manager, 2–3 native `role: leaf` children, depth 1, repo-versioned skills, strict tool allowlist, read-only KB, and run-scoped `parentCapability` required for all ops writes. Hermes—not app code—selects roles, judges copy, reconciles, and publishes.
3. Implement claim/reserve/start/bind/heartbeat and SSE normalization. Retry create only on proven pre-dispatch failure; otherwise emit `HERMES_START_UNCERTAIN`. Persist no reasoning.
4. Implement safe locale-pair capture through Cloudflare Browser Run snapshot (`screenshot`, `content`, `markdown`, `accessibilityTree`) into private R2 with hashes/references; enforce direct URL/DNS/preflight SSRF boundaries truthfully.
5. Consume Lane 3’s read-only KB MCP and perform at most one 12-second Linkup `standard` search. Never call Exa.
6. Mechanically validate/publish exactly three free findings; never perform semantic localization in the relay.
7. Implement Dodo checkout plus an app-owned Convex webhook action using raw body and signed headers, delivery-ID deduplication, atomic paid-audit creation, and exactly-one paid Hermes run.
8. Connect Lane 1’s live adapter and deploy the minimum viable Cloudflare/Convex surfaces.

## Stop line

No recursive swarm, alternate browser/search/database, Lokalise, accounts, subscriptions, full paid report, custom orchestration framework, or canned “successful” report. If credentials block a live boundary, retain a faithful fixture test and report the explicit manual gate.

## Verification and handoff

Run typecheck, backend tests, contract/state/idempotency/SSRF/report gates, repo validators, then credentialed smokes for Hermes delegation, Convex, Browser Run/R2, Linkup, and Dodo. Rehearse free audit → refresh → report → payment → duplicate webhook → exactly-one paid-run start. Commit the integrated result to your branch; do not push directly to `main`.

Return: commit SHA, deployment URLs, live run/audit IDs, commands/results, service/manual gates, environment variable names only, known limitations, and a pass/fail table against every P0 acceptance gate.
