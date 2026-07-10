# Runtime, AuditPacket, event, and MCP contracts

## AuditPacket v1

The relay sends this bounded input to one Hermes parent Run. Paid continuation uses the same schema with `jobType: PAID` and populated `priorContext`.

```json
{
  "schemaVersion": "1.0",
  "auditId": "aud_...",
  "jobType": "FREE",
  "input": {
    "homepageUrl": "https://example.com/",
    "direction": "KR_TO_US",
    "sourceLocale": "ko-KR",
    "targetLocale": "en-US",
    "audience": "US startup operators",
    "launchGoal": "Increase qualified demo requests"
  },
  "limits": {
    "maxPagePairs": 1,
    "exactFindingCount": 3,
    "maxChildren": 3,
    "maxDepth": 1,
    "maxLinkupCalls": 1,
    "maxRepairDelegations": 1,
    "maxRuntimeSeconds": 240
  },
  "siteBoundary": {
    "submittedHost": "example.com",
    "registrableDomain": "example.com",
    "verifiedHosts": ["example.com"]
  },
  "versions": {
    "contract": "1.0",
    "prompt": "audit-prompt-v1",
    "skill": "navitas-manager-v1",
    "kb": "golden-six-v1"
  },
  "specialistCatalog": [
    { "id": "visual-context", "version": "1.0", "sha256": "hex...", "instructions": "bounded repo-versioned skill text" },
    { "id": "market-copy", "version": "1.0", "sha256": "hex...", "instructions": "bounded repo-versioned skill text" },
    { "id": "evidence-qa", "version": "1.0", "sha256": "hex...", "instructions": "bounded repo-versioned skill text" }
  ],
  "parentCapability": "ephemeral-run-secret",
  "priorContext": null
}
```

`parentCapability` is generated for this run, delivered only to the parent instructions, required by every `navitas_ops` call, and never written to Convex events, reports, logs, child contexts, or fixtures.

For a paid audit, `limits.maxPagePairs` is `2`—two additional content surfaces, each represented by one source/target locale pair—`exactFindingCount` is omitted, `maxFindings` is `6`, and `priorContext` contains only:

- `parentAuditId`, `priorHermesRunId`, `priorReportId`
- the validated free report payload or bounded summary
- approved audience, launch goal, terminology decisions, and evidence references

Do not rely on hidden Hermes session continuity.

## Hermes run contract

- Runs API is loopback-only and bearer authenticated.
- `session_id` is the audit public ID.
- Before `POST /v1/runs`, the relay must win `reserveHermesStart(auditId, attemptId)`. It binds the returned `run_id` only against that reservation.
- The relay retries `POST /v1/runs` only when its HTTP client proves the request was never dispatched. A timeout, reset, crash, or lost response after possible dispatch records `HERMES_START_UNCERTAIN`; Hermes 0.18.2 has no run-by-session lookup, and session/log absence never authorizes another create.
- A stale-`STARTING` sweeper claims expired reservations. It may retry one durably marked `NOT_DISPATCHED` attempt; all possibly dispatched attempts fail closed as uncertain.
- A successful `202` is bound atomically with `ELIGIBILITY_CHECK -> FREE_RUNNING` or `PAID_QUEUED -> PAID_RUNNING`. The P0 paid-start gate additionally requires `GET /v1/runs/{runId}` to observe `queued` or `running`.
- Parent loads the versioned manager skill and specialist catalog, invokes allowed tools, and returns a short terminal summary after `submit_report` succeeds.
- Delegation is flat: one initial batch of two or three `role: "leaf"` children; maximum depth one; child orchestrators disabled; one optional single-child repair. The model-facing `delegate_task` schema in Hermes 0.18.2 cannot assign per-child toolsets, so children receive only selected specialist instructions and bounded evidence, never `parentCapability`.
- If detailed child events are absent, the product shows native `delegate_task` start/complete only.

## Normalized event contract

Allowed types:

- `RUN_CREATED`, `RUN_STARTED`, `RUN_COMPLETED`, `RUN_FAILED`, `RUN_CANCELLED`
- `PLAN_READY`
- `TOOL_STARTED`, `TOOL_COMPLETED`, `TOOL_FAILED`
- `DELEGATION_STARTED`, `DELEGATION_COMPLETED`, `DELEGATION_FAILED`
- `REPORT_ACCEPTED`, `REPORT_REJECTED`
- `PAYMENT_SUCCEEDED`, `PAID_RUN_QUEUED`

```json
{
  "schemaVersion": "1.0",
  "eventId": "hermes:sha256-of-canonical-raw-event",
  "auditId": "aud_...",
  "type": "TOOL_STARTED",
  "actor": "HERMES_PARENT",
  "status": "RUNNING",
  "safeLabel": "Capturing the source and target homepages",
  "hermesRunId": "run_...",
  "toolName": "capture_site",
  "occurredAt": "2026-07-10T09:00:00.000Z"
}
```

`actor` is `HERMES_PARENT`, `HERMES_CHILD`, `RUNTIME`, or `PAYMENT`. `status` is `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, or `CANCELLED`. `safeLabel` is ≤160 characters and contains no raw prompt, page body, secrets, or reasoning.

Native Hermes SSE has no source event ID, replay cursor, or `Last-Event-ID` support. For a raw native event, the relay computes `eventId = "hermes:" + sha256(canonicalJson(rawHermesEvent))`. Relay-derived state events use `eventId = "runtime:{auditId}:{state}:{revision}"`. `RUN_CREATED` is derived from the acknowledged `202`; `RUN_STARTED` is derived from subsequent `queued`/`running` status, not invented as a native SSE event.

The relay deduplicates by `(auditId,eventId)`. Convex assigns `seq`; the frontend orders only by `seq` and never by arrival time. After a disconnect, refresh reconstructs persisted Convex events and polls `GET /v1/runs/{runId}` for current/terminal status; missed intermediate Hermes events cannot be replayed in 0.18.2. Ignore `reasoning.available` and never persist it.

## Product MCP tools

The `navitas_ops` server exposes exactly three critical-path tools.

### `capture_site`

Input:

```json
{
  "auditId": "aud_...",
  "parentCapability": "ephemeral-run-secret",
  "homepageUrl": "https://example.com/",
  "direction": "KR_TO_US",
  "maxPagePairs": 1,
  "siteBoundary": {
    "submittedHost": "example.com",
    "registrableDomain": "example.com",
    "verifiedHosts": ["example.com"]
  }
}
```

Output is a validated `CaptureManifest` from [report-and-evidence.md](report-and-evidence.md). It may discover direct `hreflang`, anchor, subdomain, path, or query locale URLs on the same registrable domain. Each submitted/discovered direct URL, DNS result, and server-side preflight redirect is checked before Browser Run and added to `verifiedHosts` only after validation. Cross-registrable-domain locale candidates and complex language selectors are rejected in v1. The Quick Action MVP does not claim interception of browser-internal redirects or subresource requests.

### `search_market_evidence`

Input:

```json
{
  "auditId": "aud_...",
  "parentCapability": "ephemeral-run-secret",
  "direction": "KR_TO_US",
  "category": "B2B SaaS",
  "questions": ["How do comparable US sites phrase primary conversion CTAs?"],
  "maxResults": 3
}
```

It makes at most one Linkup `standard` structured request with a 12-second hard timeout and returns an `EvidencePack`. There is no automatic retry. On timeout/5xx it returns `RESEARCH_UNAVAILABLE`; Hermes may continue only when gbrain evidence is available and the report marks the degradation. At least one real live Linkup smoke must succeed before judging; this per-audit degradation cannot replace that gate. It never calls Exa.

### `submit_report`

Input is `parentCapability`, a v1 Report, and `idempotencyKey = "report:{auditId}:v1"`.

The tool checks schema, enums, counts, target language, page/artifact/evidence/KB reference existence, string limits, and idempotency. It returns either:

```json
{ "status": "ACCEPTED", "reportId": "rep_...", "reportVersion": 1 }
```

or:

```json
{
  "status": "VALIDATION_ERROR",
  "errors": [{ "path": "findings[1].artifactId", "code": "UNKNOWN_REFERENCE" }]
}
```

It does not score naturalness or rewrite content. Hermes receives at most two contract repair attempts. A successful idempotent repeat returns the original accepted result. The accepted write atomically transitions `FREE_RUNNING -> FREE_REPORT` or `PAID_RUNNING -> PAID_REPORT`.

## Read-only gbrain MCP

The dedicated profile exposes only the project-isolated gbrain `search`, `query`, and `get_page` tools. The parent and children cannot import, edit, delete, embed, or access the user's personal brain during a public audit.

Expected retrieval request:

- direction, component type, product/category context, audience, and issue hypothesis
- limit 3 records per request
- return stable record ID, title, direction, component type, concise precedent/anti-pattern, source URL, screenshot artifact reference, and retrieval score/mode

Hermes MCP names are normalized explicitly: `mcp_navitas_ops_capture_site -> capture_site`, `mcp_navitas_ops_search_market_evidence -> search_market_evidence`, `mcp_navitas_ops_submit_report -> submit_report`, and `mcp_navitas_kb_search/query/get_page -> gbrain_search/query/get_page`. Startup compares the actual `/v1/toolsets` response with this exact allowlist and fails closed on any extra toolset or tool.

## Cloudflare capture Worker

`POST /capture` is service-token protected. The request contains `auditId`, `pageId`, validated URL, viewport `1440x900`, and Browser Run snapshot formats `screenshot`, `content`, `markdown`, and `accessibilityTree`, plus direct links when available. The returned `content` is stored as the `HTML` artifact.

The Worker calls Browser Run snapshot, enforces time/size caps, writes private R2 objects, and returns metadata/hashes. It does not write Convex or interpret localization quality. R2 keys are deterministic:

```text
audits/{auditId}/pages/{pageId}/{captureId}/{kind}.{extension}
```

## Typed failures

| Code | Class | Retry/fallback |
|---|---|---|
| `INVALID_URL` | terminal | Correct input only |
| `UNSAFE_URL` | terminal | Never retry/bypass |
| `LOCALE_NOT_FOUND` | terminal | Show checked links/routes |
| `BLOCKED_BY_ORIGIN` | terminal | Use another prevalidated public fixture; no alternate crawler |
| `CAPTURE_TIMEOUT` | retryable once | One bounded retry, then fail |
| `CAPTURE_INCOMPLETE` | terminal | Any required screenshot, content/HTML, Markdown, or accessibility-tree artifact is missing |
| `RESEARCH_UNAVAILABLE` | degradable | Continue with gbrain; label report |
| `KB_UNAVAILABLE` | degradable only if Linkup succeeds | Never invent KB references |
| `HERMES_START_FAILED` | retryable once only on provable pre-dispatch failure | Then fail |
| `HERMES_START_UNCERTAIN` | terminal pending operator reconciliation | Fail closed; never start a second run |
| `HERMES_RUN_FAILED` | terminal | Preserve trace and typed error |
| `DELEGATION_FAILED` | terminal unless one child and QA remain sufficient | Manager decides; infrastructure cannot synthesize |
| `REPORT_INVALID` | terminal after two contract repairs | Do not publish partial report |
| `PAYMENT_FAILED` | terminal for continuation | Free report remains available |
| `WEBHOOK_INVALID` | terminal event rejection | Never queue paid run |
| `STATE_CONFLICT` | concurrency control | Reload state; no blind retry loop |
| `CANCELLED` | terminal | Stop Hermes at next safe point |
