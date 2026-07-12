# Hermes production hosting migration plan (decision doc)

**Status:** accepted direction, not yet executed. Supersedes TECH_SPEC ADR-01 ("keep Hermes local") once implemented.
**Produced:** 2026-07-12 by a multi-agent research workflow (Hermes Cloud research + Cloudflare Containers research + repo constraints), synthesized and reviewed.
**Caveat:** the automated repo-constraints inventory ran against a stale path mid-rename and returned empty; the synthesis is grounded in the PRD/AGENTS contract plus the two external research inputs, and its "what stays unchanged" claims were reviewed against the actual repo by the session operator.

**Note on repo state:** the constraints inventory ran against the pre-rename directory path mid-rename and found nothing. Everything below is grounded in the AGENTS.md/PRD contract (Convex system-of-record, thin relay, loopback Hermes Runs API, Browser Run/R2 evidence plane, Linkup-only search, gbrain+PGLite read-only KB, Dodo exactly-once paid run) plus the two research inputs.

---

# 1) Recommendation: Cloudflare Containers. Not Hermes Cloud. Named tunnel only as rehearsed fallback.

**Deploy the Hermes agent + thin relay + baked-in gbrain KB as one Cloudflare Container behind the existing Worker.**

**Why not Hermes Cloud (yet):** Every capability the critical path needs is explicitly NOT VERIFIED on Cloud: custom provider keys/base_url (Cerebras), customer-defined MCP servers (the read-only KB MCP), public `/v1/runs` exposure, and run-duration/concurrency quotas. It is also "in preview," and the contract requires Hermes stay *loopback-only behind an authenticated relay* — Hermes Cloud's portal-token gateway model inverts that boundary. Betting a hackathon deadline on four unverified capabilities of a preview product is risk you can't buy back. Re-evaluate post-hackathon; it's the right long-term shape if the unknowns resolve.

**Why Containers:** GA since April 2026, $5/mo Workers Paid, runs any Dockerfile. Every contract survives intact: Hermes binds `127.0.0.1:8642` *inside* the container (loopback boundary preserved — the Worker can only reach the relay's `defaultPort`); the KB MCP runs as stdio inside the same container (no HTTPS MCP exposure needed); Cerebras is plain outbound 443 (allowed by default); secrets inject via Worker secrets → `envVars`. The one real weakness — **ephemeral disk** — is a weakness the architecture was already built for: Convex is the system of record, R2 holds evidence bytes, the six-record KB is deterministic and bakes into the image at build time, and the contract already mandates create-before-bind reservations with fail-closed reconciliation. A host restart mid-run is just the crash-recovery path you're required to test anyway. SIGTERM + 15-minute grace is generous for a bounded audit run.

**Why not laptop + named tunnel as primary:** It fails the stated goal (no laptop dependency) — one lid-close or Wi-Fi blip kills a paid customer's run. But it's a 20-minute setup reusing identical relay code, so keep it as the rehearsed demo-day fallback, not the plan.

**Honest tradeoffs accepted with Containers:** (a) no uptime SLA, hosts restart "irregularly" — mitigated by reconciliation, not eliminated; (b) cold start for a Python Hermes image will realistically exceed the generic 1–3 s figure — mitigate with a keep-warm ping during the demo window; (c) Hermes's SQLite Runs persistence becomes a cache, not durable state — fine, because normalized events are mirrored to Convex; (d) instance sizing/cost is a guess until measured — start small; the included 25 GiB-hrs / 375 vCPU-min almost certainly covers hackathon volume.

---

# 2) Migration plan — one engineer-day, ordered

Total ~7.5 h + slack. Steps 1–3 sequential; 4 can overlap 3.

1. **(60 min) Dockerfile + image.** Base `python:3.12-slim` + Node (for relay). Pin `hermes-agent`. At build time: `gbrain init --pglite` and ingest the six reviewed KB records (deterministic, committed provenance) so the KB ships read-only inside the image. Copy `~/.hermes/config.yaml` template: Cerebras `base_url: https://api.cerebras.ai/v1` + model name, `mcp_servers` stdio entry for the KB with `tools.include` allowlisting read-only tools, delegation caps per PRD. Entrypoint: render `~/.hermes/.env` from container env vars, start Hermes gateway on `127.0.0.1:8642`, start relay on `defaultPort` (e.g. 8080), propagate SIGTERM to both.
2. **(45 min) Container Worker wiring.** Add a `Container` class (npm `@cloudflare/containers`, extends DurableObject) to the existing Worker's wrangler config: `defaultPort` = relay port, `sleepAfter: "30m"`, smallest instance tier with ≥2 GiB memory (bump only if OOM). Route **only** the existing authenticated relay endpoints through `getContainer(...).fetch(...)`. Nothing else about the Worker changes.
3. **(45 min) Secrets.** `wrangler secret put` each item in section 3; map into the container via `envVars` (or runtime `startAndWaitForPorts({ startOptions: { envVars } })` for async-read secrets). Verify zero secrets in image layers (`docker history`); commit only `.env.example`.
4. **(90 min) Relay hardening for ephemeral hosts.** Relay *logic* unchanged (claim job from Convex → call loopback Runs API → mirror genuine events → reconcile). Add: (a) **startup reconciliation sweep** — on boot with fresh disk, query Convex for open Hermes start reservations, reconcile by deterministic session evidence, fail closed on uncertainty, never blind-retry a create; (b) **SIGTERM handler** — stop claiming new jobs, mark in-flight runs `interrupted` in Convex within the grace window.
5. **(60 min) Kill test.** Start a real run, force-restart the container mid-run (redeploy), assert: no duplicate Hermes create, reservation reconciled fail-closed, user-visible state legal, no orphaned paid run. This is the create-before-bind crash-recovery gate, exercised on the real platform.
6. **(60 min) Deploy + full E2E smoke.** `wrangler deploy`, then the required prevalidated smoke: intake → Browser Run capture → R2 evidence → live Hermes run with `delegate_task` + Linkup + KB retrieval → three screenshot-grounded findings → Dodo test-mode checkout → webhook → **exactly one** paid continuation auto-started.
7. **(30 min) Keep-warm + demo runbook.** Cron Trigger pinging the container every 5 min during the demo window (remove after — scale-to-idle is the cost model). Measure real cold start once; write it down.
8. **(30 min) Fallback rehearsal.** `cloudflared` named tunnel from laptop → same relay port, one config flag in the Worker to flip the origin. Run one smoke through it. Document the flip procedure. Then stop touching it.

---

# 3) Exact credentials/accounts to provide

| # | Credential | Where to get it | Where it's stored |
|---|---|---|---|
| 1 | Cloudflare account on **Workers Paid** ($5/mo) | dash.cloudflare.com → Workers & Pages → Plans → upgrade | Account state; no secret. Wrangler auth via `wrangler login` (local OAuth token, macOS-local only) |
| 2 | Cloudflare API token (deploy/CI; optional if using `wrangler login`) | dash.cloudflare.com → My Profile → API Tokens → "Edit Cloudflare Workers" template | macOS **Keychain** (never repo, never container) |
| 3 | Cerebras API key | cloud.cerebras.ai → dashboard → API Keys | **Worker secret** `CEREBRAS_API_KEY` → **container env** → entrypoint writes `~/.hermes/.env`. First verify the exact model id (e.g. `gemma-4-31b`) exists in Cerebras's model list — its existence was NOT verified |
| 4 | Hermes `API_SERVER_KEY` | Self-generated: `openssl rand -hex 32` | **Worker secret** `HERMES_API_SERVER_KEY` → container env; used only relay→loopback inside the container |
| 5 | Relay auth token (Worker → relay) | Self-generated: `openssl rand -hex 32` | **Worker secret** `RELAY_AUTH_TOKEN` → container env |
| 6 | Convex deployment URL + deploy key | dashboard.convex.dev → project → Settings → URL & Deploy Keys (production deploy key or function-scoped token for the relay) | URL: plain env (non-secret). Key: **Worker secret** `CONVEX_DEPLOY_KEY` → container env for relay writes |
| 7 | Linkup API key | app.linkup.so → API Keys | **Worker secret** `LINKUP_API_KEY` → container env (Hermes search tool) |
| 8 | Dodo Payments API key + webhook signing secret | app.dodopayments.com → Developer → API Keys, and → Webhooks (endpoint signing secret) | Secrets on the **existing webhook handler** (Convex env vars / existing Worker secret) — **not** in the container |
| 9 | R2 access | Preferred: R2 **bucket binding** on the Worker (no key). If the container must write directly: dash.cloudflare.com → R2 → Manage API Tokens | Binding: no secret. Token (if needed): **Worker secrets** `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` → container env |
| 10 | Browser Rendering | Cloudflare Worker **binding** (Workers Paid) | No secret; wrangler config |
| 11 | Nous Portal account/credits | **Not required** under this recommendation; only if later piloting Hermes Cloud | n/a |

Rule applied: runtime-needed by the container = Worker secret → container env; human/deploy-tooling only = Keychain; nothing in git beyond `.env.example` placeholders.

---

# 4) What stays unchanged

- **Convex** schema, audit state machine, payment states, normalized-event mirroring, prompt/skill versioning — untouched; Convex remains the sole system of record.
- **Frontend** on Cloudflare Pages, all checked-in contracts and deterministic fixtures — untouched.
- **Dodo** checkout, signature verification, webhook dedup, exactly-once paid-continuation logic — untouched (it already talks to Convex, not the laptop).
- **Relay semantics** — claim → loopback Runs API → mirror genuine events → reconcile. Same code, new host; only the boot sweep and SIGTERM handler are added (both already contractually required).
- **Hermes boundary** — loopback-only behind the authenticated relay, native `delegate_task`, no second orchestrator. The loopback just moves inside the container.
- **KB contract** — six reviewed gbrain records, PGLite engine, read-only MCP, provenance and reference-integrity tests. Content identical; baked into the image instead of living on laptop disk.
- **Evidence plane** — Browser Run capture → immutable R2 bytes.
- **Security posture** — SSRF/public-http-only capture rules, bounded redirects/pages/children/retries, crawled content treated as untrusted, sanitized traces.
- **Vendor list** — Linkup remains the sole search provider; no new database, queue, or agent framework. Cloudflare Containers is new *hosting* for existing components, not a new architectural component — one container behind the existing Worker is deliberately the smallest change that removes the laptop.