# nativas.ai service contracts

Read only the sections relevant to the current task. These are operational boundaries, not a second PRD.

## End-to-end ownership

1. The frontend creates an audit in Convex.
2. The local relay claims the audit and starts one Hermes parent run through `POST /v1/runs`.
3. Hermes uses the narrow product MCP to capture eligible pages through a Cloudflare Worker, retrieve one Linkup market-evidence packet, and publish the final report.
4. Hermes queries a project-isolated gbrain over stdio MCP, selects a bounded golden set, and passes those records to isolated children.
5. Hermes runs one flat parallel `delegate_task` batch of at most three specialists, reconciles the results, and submits once through an idempotent report tool.
6. Convex persists normalized events and report state; R2 stores screenshots and rendered evidence.
7. Dodo checkout plus a verified, deduplicated webhook leaves the free audit complete, creates a linked paid child, and starts one context-linked Hermes run without human approval.

| Component | Owns | Must not own |
| --- | --- | --- |
| Hermes | Plan, evidence selection, specialist delegation, localization judgment, reconciliation, QA, publish/fail decision | Payments, durable product state, raw artifact storage |
| Relay | Start/poll/stop Hermes runs, consume SSE, normalize events, recover after disconnect | Specialist choice, semantic retries, localization or report synthesis |
| Convex | Reactive audit state, normalized events, reports, prompt versions, evaluations, payment transitions, webhook idempotency | Golden-set retrieval engine or agent reasoning |
| Cloudflare | Pages delivery, capture Worker, Browser Run, R2 evidence objects | General search or business-state authority |
| Linkup | Current external market/source search with citations | Submitted-site rendering or curated memory |
| Dodo | One-time checkout, payment event, payment lookup/reconciliation | Audit planning or report generation |
| gbrain | Curated localization precedents and hybrid/keyword retrieval | Product workflow state or customer payment data |

## Local CLI snapshot

Verified on 2026-07-10; rerun the version command instead of treating this table as a dependency pin.

| Surface | Verified command | Local result | Remaining gate |
| --- | --- | --- | --- |
| Hermes | `hermes --version` | `0.18.2 (2026.7.7.2)`, upstream `4281151a` | Profile migration and model-provider authentication |
| Convex | `convex --version` | `1.42.1` | Link/create the nativas.ai development deployment |
| Wrangler | `wrangler --version` | `4.110.0` | Create/verify Pages, Worker, Browser binding, and R2 resources |
| Linkup | `linkup --version` | `1.0.2` | Configure `LINKUP_API_KEY` outside git |
| Dodo | `dodo --version` | `3.4.0` | Verify test product and webhook endpoint |
| gbrain | `gbrain --version` | `0.36.3.0` | Initialize the project-isolated PGLite brain |

## Hermes Runs, delegation, and MCP

Hermes is a required runtime gate. The local binary is installed, but the 2026-07-10 `hermes doctor` check still requires an operator to migrate the profile configuration and authenticate a model provider before a live run can pass. Do not mutate the user's global Hermes profile automatically.

The hosted Hermes Cloud Agent preview at `https://portal.nousresearch.com/cloud` is optional post-P0 migration work. The critical path uses the documented loopback gateway/Runs API because the public Cloud preview does not provide the repo's pinned external Runs contract. Portal authentication may still supply the local Hermes provider setup.

Health and discovery:

```bash
command -v hermes
hermes --version
hermes doctor
hermes status
hermes setup --portal          # interactive provider/auth gate; run only when needed
hermes gateway run
hermes mcp list
hermes mcp test nativas_kb      # after the repo-specific server is configured

curl -fsS http://127.0.0.1:8642/health
curl -fsS http://127.0.0.1:8642/v1/capabilities \
  -H "Authorization: Bearer $API_SERVER_KEY"
```

Required gateway environment names are `API_SERVER_ENABLED`, `API_SERVER_HOST=127.0.0.1`, `API_SERVER_PORT`, and `API_SERVER_KEY`. Store values outside git. Do not enable browser CORS unless a reviewed architecture requires it.

The generic Hermes `web` tool should remain unconfigured/disabled for this project; a related doctor warning is expected because Linkup is the exclusive search path.

Stable integration surface:

- `POST /v1/runs` — create a parent run with `input`, `instructions`, and `session_id=auditId`.
- `GET /v1/runs/{runId}` — reconcile state after refresh or SSE loss.
- `GET /v1/runs/{runId}/events` — real lifecycle, tool, and text-delta SSE.
- `POST /v1/runs/{runId}/stop` — bounded operator cancellation.
- `GET /v1/capabilities`, `/v1/skills`, and `/v1/toolsets` — verify rather than assume runtime features.

Delegation contract:

- One parent manager; maximum three children; flat depth one.
- One initial `delegate_task(tasks=[...])` batch. A single repair task is allowed only when real QA fails.
- Children receive bounded page, market, and golden-set evidence because their contexts are isolated.
- Never fabricate per-child progress. Show native run/tool events when finer child hooks are unavailable.
- Reserve a deterministic start attempt in Convex before `POST /v1/runs`. Retry only when the HTTP client proves the request was never dispatched; any possibly dispatched interruption becomes `HERMES_START_UNCERTAIN`. Hermes 0.18.2 has no run-by-session lookup, so session/log evidence is diagnostic only.

Recommended Hermes MCP boundaries:

```yaml
mcp_servers:
  nativas_kb:
    command: gbrain
    args: [serve]
    env:
      GBRAIN_HOME: /absolute/path/to/nativas-runtime/gbrain
  nativas_ops:
    command: node
    args: [/absolute/path/to/nativas/apps/relay/dist/mcp.js]
```

Use `platform_toolsets.api_server: [delegation, nativas_kb, nativas_ops]`, filter gbrain to `search`, `query`, and `get_page`, and filter `nativas_ops` to `capture_site`, `search_market_evidence`, and `submit_report`. Each ops call requires an unguessable per-run parent capability omitted from child contexts. Treat `submit_report` as an idempotent write; never mark mixed read/write MCP tools as safe for parallel execution.

Official references:

- https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp/

## Convex state, realtime, and webhooks

Use typed queries/mutations/actions and HTTP Actions. React clients subscribe to canonical state; they do not treat transient SSE as authority.

```bash
convex --version
convex dev
convex codegen
convex run <functionName> '<json-args>'
convex logs
convex deploy
```

HTTP Actions receive Hermes relay events and Dodo webhooks. Every write path needs an idempotency key and a legal state transition. Verify webhook signatures before mutation.

Optional diagnostics-only MCP for a development deployment:

```bash
convex mcp start --project-dir "$PWD" --deployment dev \
  --disable-tools data,envGet,envList,envRemove,envSet,logs,run,runOneoffQuery
```

Do not enable production deployments or production PII flags for coding agents.

Official references:

- https://docs.convex.dev/client/react
- https://docs.convex.dev/functions/http-actions
- https://docs.convex.dev/functions/actions

## Cloudflare Pages, Worker, Browser Run, and R2

Use Pages for the frontend and one Worker for site evidence acquisition. Use a Worker Browser binding so the app does not manage a separate Browser Run API token.

```bash
wrangler --version
wrangler whoami                     # manual account/auth gate
wrangler dev --remote               # Browser Run quickAction requires remote binding
wrangler deploy
wrangler pages deploy <build-dir>
wrangler r2 bucket list
wrangler r2 object get <bucket>/<key> --file <local-path>
```

The Worker calls `env.BROWSER.quickAction("snapshot", ...)` with a compatibility date of `2026-03-24` or later and requests `screenshot`, `content`, `markdown`, and `accessibilityTree`. Map `content` to the stored HTML artifact. Record `X-Browser-Ms-Used`. Store immutable objects in R2 and only references/hashes in Convex.

MVP capture rules:

- `http`/`https` only; resolve and reject private, loopback, link-local, and metadata destinations.
- Preflight submitted/discovered direct URLs and server-side redirect hops; bound response size, browser time, and same-site page count. Quick Action does not intercept browser-internal redirects or subresources in this MVP.
- Never bypass authentication, CAPTCHAs, or origin blocks.
- Screenshots are core. Geometry overlays, interactive locale switching, and reconstructed “after” pages are stretch work.

Official references:

- https://developers.cloudflare.com/browser-run/quick-actions/
- https://developers.cloudflare.com/browser-run/quick-actions/snapshot/
- https://developers.cloudflare.com/r2/

## Linkup-only web search

**All repository web search uses Linkup. Exa is prohibited.** Directly fetching a known official URL with `linkup fetch` is allowed. Browser Run remains limited to submitted-site capture.

CLI and runtime patterns:

```bash
linkup --version
linkup config                         # reports configuration; do not print keys
linkup search "<bounded query>" \
  --depth standard \
  --output structured \
  --schema-file <schema.json> \
  --max-results 3 \
  --timeout 12
linkup fetch <known-url> --json
```

Use at most one attempt of one `standard` structured query per live audit, cap sources, persist citations, and share the resulting packet with children. Do not automatically retry it. `deep` is offline corpus-refresh work only. On timeout, emit `live_market_evidence_unavailable`; never substitute uncited model knowledge or another search vendor.

Manual gate: `linkup setup` or a session/deployment-scoped `LINKUP_API_KEY`. Never store it in tracked files.

Official reference: https://docs.linkup.so/pages/documentation/endpoints/search/overview

## Dodo checkout, webhook, and reconciliation

Use the official Convex component for checkout creation. Use an application-owned Convex HTTP Action for the critical webhook because delivery-level idempotency requires the `webhook-id` header.

```bash
dodo --version
dodo products list                    # authenticated manual gate
dodo checkout new                     # interactive test checkout
dodo wh listen <convex-webhook-url>
dodo wh trigger payment.success <convex-webhook-url>  # v3.4.0 CLI route smoke only
```

The Dodo API's canonical success event is `payment.succeeded`. The installed
CLI v3.4.0 currently accepts the legacy offline-trigger label
`payment.success`; do not copy that label into the product contract. Prove the
real path with a test-mode checkout, then replay the captured canonical event
for the duplicate-delivery test.

Runtime package and setup:

```bash
npm install @dodopayments/convex dodopayments
convex dev                             # regenerate component types
```

Secrets belong in Convex environment variables: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_ENVIRONMENT`, and `DODO_PAYMENTS_WEBHOOK_SECRET`. The HTTP Action reads the raw body plus `webhook-id`, `webhook-signature`, and `webhook-timestamp`, verifies/parses with `client.webhooks.unwrap(rawBody, { headers })`, and passes the verified payload plus `webhook-id` to one atomic mutation. A server-side payment lookup may reconcile delayed webhooks but must use the same idempotent transition.

Official reference: https://docs.dodopayments.com/developer-resources/convex-component

## Project-isolated gbrain

Use an absolute repo-specific home. The override is required even if a personal gbrain exists.

```bash
export GBRAIN_HOME="$(pwd)/.runtime/gbrain"
gbrain --version
gbrain init --pglite
gbrain doctor --fast --json
gbrain import ./knowledge/golden-set --no-embed
gbrain search "US SaaS primary CTA evidence"
gbrain query "Which precedents match this KR to US homepage?" --no-expand
gbrain serve                            # stdio MCP for Hermes
```

Start with six reviewed records (three per direction) covering hero/value proposition, primary CTA, and trust language. Keyword search is the required fallback when embedding configuration is unavailable. Every hit used in a report must resolve to a stored record; screenshots remain in R2 and are referenced by artifact ID.

Do not point `GBRAIN_HOME` at `~/.gbrain`, migrate the personal brain, or rebuild gbrain on Convex/Vectorize during the hackathon.

## Secrets and logging

- Tracked files may contain variable names and redacted examples only.
- Use Convex environment variables, Wrangler secrets/Keychain-backed auth, Hermes profile environment, and session-scoped Linkup configuration.
- Never log authorization headers, webhook signatures, full submitted HTML, raw payment payloads, or environment dumps.
- Store customer-visible progress as normalized safe labels. Keep raw Hermes traces local and admin-only.
- Sanitize recorded fixtures; preserve shape, status codes, and IDs without real customer or credential data.

## Verification matrix

| Boundary | Minimum meaningful proof | Required failure proof |
| --- | --- | --- |
| Hermes | Health + capabilities + one parent run + real parallel delegation | Missing auth/provider and stop/cancel path |
| Hermes start | Persisted reservation binds one run across create-before-bind crash recovery | Uncertain outcome fails closed and cannot double-start |
| Convex | UI receives reactive persisted events after refresh | Duplicate/out-of-order event is idempotent or rejected |
| Browser Run/R2 | Both locale snapshots resolve from stored artifact refs | Private URL or blocked origin returns a typed failure |
| Linkup | `standard` structured packet validates and includes source URLs | Timeout produces explicit degraded evidence state |
| gbrain | Query returns resolvable project records | Embedding unavailable falls back to keyword retrieval |
| Report | Three findings pass schema, language, and artifact-reference checks | Invalid fixture cannot publish; duplicate submit is idempotent |
| Dodo | Test checkout leads to exactly one paid Hermes run | Duplicate webhook and delayed-webhook reconciliation do not double-run |

Before declaring an integration complete:

```bash
git diff --check
git status --short
rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' \
  '(ctx7s[k]-|sk-[A-Za-z0-9]|BEGIN (RSA|OPENSSH) PRIVATE KEY|A[P]I_SERVER_KEY=.+|LINKU[P]_API_KEY=.+|DODO_PAYMENT[S]_API_KEY=.+|CLOUDFLARE_API_TOKE[N]=.+)' .
```

Then run the repository's targeted tests, typecheck, lint, and build commands. Live calls that spend money, create cloud resources, deploy production, or require interactive authentication remain explicit manual gates.
