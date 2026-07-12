# 2026-07-11/12 — Rename, named tunnel, observability, Supabase-ready KB, paid capture fixes

## Repository and infrastructure rename

- Renamed the working directory from the old misspelled name to `~/nativas` (canonical product spelling), per direct request.
- Regenerated both LaunchAgents (`ai.nativas.origin`, `ai.nativas.tunnel`) from the repo templates at the new root and restarted them.
- Fixed three stale old-spelling paths in the Hermes profile (`~/.hermes/profiles/nativas/config.yaml`: KB MCP proxy path, `GBRAIN_HOME`, terminal cwd) and the gbrain `config.json` `database_path`.
- Production `https://nativas.ai/health` verified healthy before and after every step.

## Named tunnel migration (Quick Tunnel retired)

- Fetched the `nativas-hermes-laptop` connector token through the authenticated Cloudflare control plane (wrangler OAuth, `connectivity admin` scope) and stored it only in Keychain service `nativas-cloudflared-tunnel-token`.
- Ingress was already `api.nativas.ai → http://127.0.0.1:8787`.
- Started the named connector alongside the Quick Tunnel, verified `https://api.nativas.ai/health` through edge-token auth, then flipped Worker secret `API_ORIGIN=https://api.nativas.ai` (user-approved), verified, and retired the Quick Tunnel.
- No `trycloudflare.com` remains in any active process or config; the tunnel LaunchAgent now runs `scripts/cloudflare/run-tunnel.sh`.

## Run observability (new)

- `apps/local-server/src/telemetry.ts`: privacy-safe spans (STAGE/TOOL/HERMES_RUN/PAYMENT/REPORT) along `paymentId → paidAuditId → captureId → hermesRunId → reportId`, with duration, typed failure codes, Hermes token usage, and env-gated USD cost. JSONL at `.runtime/nativas-local/telemetry.jsonl`; only enumerated fields can persist.
- Wired through free-run stages, payment confirmation, the paid workflow hooks (including new `usage` hook in `paid-workflow.ts`), and restart recovery.
- New endpoint `GET /api/audits/:auditId/trace` (edge-auth like all API routes).
- Live production evidence (audit `aud_local_56418a4494dd4a65`): capture 549ms, Linkup 2444ms, KB 24ms, Hermes run 58.0s with 24,221 tokens, report correlation complete; total 61.1s.
- Docs: `docs/operations/run-observability.md`. Tests: `tests/local/telemetry.test.ts`, `tests/local/trace.test.ts` (POBS-01 correlation + typed failure spans).

## Supabase-ready gbrain (activation deferred by user)

- `apps/kb-mcp/src/gbrain-env.mjs`: engine resolution — env `GBRAIN_DATABASE_URL`/`NATIVAS_GBRAIN_DATABASE_URL` → Keychain `nativas-supabase-db-url` → PGLite fallback; `NATIVAS_GBRAIN_ENGINE=pglite` pin; URL validation; no secret ever logged.
- `gbrain-proxy.mjs` selects the engine at spawn; `scripts/kb/prepare-gbrain.mjs --engine supabase` initializes/imports on Supabase Postgres.
- PGLite remains the active engine (user decision; Supabase org was at its 2-free-project cap). Activation is: `supabase login` → create project → store pooler URL in Keychain → one prepare command. Docs: `docs/kb/supabase-gbrain.md`.
- Tests: `tests/kb/gbrain-env.test.mjs` (7), `tests/kb/supabase-boundary.test.mjs` (real-engine proof, honest skip without a configured URL).

## Production paid-path bugs found and fixed by live rehearsal

1. **`/internal/captures` returned 405**: `wrangler.jsonc` `run_worker_first` lacked `/internal/*`, so the static asset layer answered before the Worker's evidence plane. Fixed and deployed.
2. **Evidence plane threw `Illegal invocation`**: `createEvidencePlane` passed global `fetch` detached / as a method of the dependency object, which workerd rejects. Unit tests always injected a fake fetch, so only production hit it. Fixed with arrow wrappers; added sanitized `detail` to the operator error log and browser-snapshot error logging.
3. After the fixes, a signed capture probe returned **201** with a full artifact manifest: Cloudflare Browser Rendering rendered both speak.com locale pages and stored real screenshot/HTML/Markdown/accessibility artifacts in private R2.
4. **Discovery selected a constructed URL that 404s** (`LOCALE_PATTERN` counterpart `speak.com/affiliate`): capture preflight correctly failed closed. Fixed with `selectVerifiedPagePairs` — up to six ranked candidates are verified with bounded range requests (both sides must resolve, redirect-safe) and 404ing pairs are dropped with backfill. Tested (PDISC-01 extension).
5. **Browser Rendering 429/5xx retry was one attempt with 100ms backoff**: capture failed under per-minute browser limits. Now four bounded attempts with 2s/4s/6s backoff. Tests updated to the new contract.
6. **Paid manager had no page text and no repair path**: the live run showed Hermes misusing KB `get_page` on artifact IDs, exhausting MCP retries, and returning non-JSON — correctly rejected by the validator, but terminally. Fixed per spec §11.3: the packet now carries bounded rendered `pageEvidence` for each selected pair (`collectPaidPageEvidence`), instructions forbid artifact-ID lookups, and mechanical validation failures trigger at most two bounded repair turns in the same Hermes session (no new capture/search/delegation). Tested (PHERMES-03 repair-loop test).

## Additional hardening from later rehearsals

7. **Validator crashed on malformed model findings** (`undefined.trim()`), which bypassed the repair loop as `HERMES_RUN_FAILED`. `validatePaidReport` is now fully defensive: every field may be missing or mistyped and yields typed errors (`INVALID_COMPONENT_REF` added; missing `confidence` no longer slips through numeric comparisons). Tested against hostile finding shapes.
8. **Repair turns are self-contained**: Runs API sessions are stateless (`history=0` observed live), so each repair input carries the previous output, validation errors, legal reference IDs, and pageEvidence. The first (most informative) validation error is preserved when repairs exhaust.
9. `tests/contracts` was missing from root `npm test`; added.

## Release-gate rehearsal: PAID_REPORT reached on production (2026-07-12)

Audit `aud_local_7121c00117c041ae` → free report (~60s) → real hosted Dodo test checkout completed autonomously (Playwright; Dodo's documented test card) → verified payment `pay_*` → exactly one paid child `aud_local_paid_7319afbd8b26457a` → discovery with URL verification (3.0s, one verified pair: speak.com `/ko/b2b` ↔ `/b2b`; the constructed `/affiliate` counterpart was correctly dropped as a 404) → Cloudflare Browser Rendering capture of both pages into private R2 (22.7s, 16 artifacts incl. full-page PNGs) → paid Hermes run with native delegation (65.0s total; initial output + repair 1 failed mechanical validation, **repair 2 published**; 8,719 tokens) → **`PAID_REPORT`**.

Verified evidence:

- Report: 2 screenshot-grounded findings on the B2B pair, each citing a TARGET screenshot artifact, Linkup evidence ID, and reviewed KB record; `promptVersion: PAID_DEEP_AUDIT_V1`.
- Screenshot delivery: audit-scoped capability minted, Worker returned the real 1463×7307 full-page PNG (1.2 MB) from private R2 with `private, no-store`.
- Refresh reconstruction: re-fetching the paid audit returns `PAID_REPORT`, the persisted report, 27 sanitized events, and genuine usage.
- Trace (`/api/audits/:id/trace`): payment → discovery → capture → three HERMES_RUN spans (two FAILED `REPORT_INVALID`, one SUCCEEDED with usage) → report publication, all correlated.

Earlier rehearsals (payments #1–#4) each exposed one of the production bugs listed above; every payment was Dodo **test mode**.

## Validation

- Full gates fresh at completion: `npm test` (179 node-test + 45 web, 0 failures), `typecheck`, `validate`, `build:cloudflare` all pass.

## Remaining gaps / follow-ups

- Hermes runtime still laptop-local; the accepted migration direction is one Cloudflare Container behind the existing Worker (`docs/operations/hermes-production-migration.md`), pending Workers-plan confirmation and credentials.
- Dodo product lives under the Retencio merchant account and in test mode; create a Nativas-branded product + live-mode credentials before real launch.
- Supabase KB activation deferred (org free-project cap); one Keychain entry + one command once an account/slot exists (`docs/kb/supabase-gbrain.md`).
- `createCheckout` reuses its stored session forever; after a failed/expired Dodo session the parent audit cannot mint a fresh checkout (P2).
- Paid report `limitations` were empty on the one-pair run; the manager prompt should require a reduced-coverage limitation entry (P2).
- Hermes visual pixel-proof (artifact MCP `ImageContent`) remains open; current paid visual grounding is rendered-text `pageEvidence` plus screenshot references, stated honestly.
