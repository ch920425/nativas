# Domain model and Convex contract

## Audit state machine

Free and paid work use separate audit records and separate state machines:

```text
FREE audit: SUBMITTED -> ELIGIBILITY_CHECK -> FREE_RUNNING -> FREE_REPORT
PAID child: PAID_QUEUED -> PAID_RUNNING -> PAID_REPORT
```

Payment lifecycle belongs to the `payments` record, not the audit state. A
verified payment leaves the free audit at `FREE_REPORT` and creates one `PAID`
child whose `parentAuditId` references it.

Any nonterminal audit state may transition to `FAILED` with a typed
`AuditError`. A user or operator stop may transition a running audit to
`CANCELLED`. `FREE_REPORT` and `PAID_REPORT` are terminal for their respective
audit records; linking a payment or paid child does not mutate the free audit
status.

### Allowed transitions

| From | Allowed to |
|---|---|
| `SUBMITTED` | `ELIGIBILITY_CHECK`, `FAILED`, `CANCELLED` |
| `ELIGIBILITY_CHECK` | `FREE_RUNNING`, `FAILED`, `CANCELLED` |
| `FREE_RUNNING` | `FREE_REPORT`, `FAILED`, `CANCELLED` |
| `PAID_QUEUED` | `PAID_RUNNING`, `FAILED`, `CANCELLED` |
| `PAID_RUNNING` | `PAID_REPORT`, `FAILED`, `CANCELLED` |
| `FREE_REPORT`, `PAID_REPORT`, `FAILED`, `CANCELLED` | none |

Illegal transitions fail atomically with `STATE_CONFLICT`; they never coerce state.

## Canonical audit error

```ts
type AuditErrorClass = "TERMINAL" | "RETRYABLE" | "DEGRADABLE" | "CONFLICT";

type AuditErrorCode =
  | "INVALID_URL" | "UNSAFE_URL" | "LOCALE_NOT_FOUND" | "BLOCKED_BY_ORIGIN"
  | "CAPTURE_TIMEOUT" | "CAPTURE_INCOMPLETE" | "RESEARCH_UNAVAILABLE" | "KB_UNAVAILABLE"
  | "HERMES_START_FAILED" | "HERMES_START_UNCERTAIN" | "HERMES_RUN_FAILED"
  | "DELEGATION_FAILED" | "REPORT_INVALID" | "PAYMENT_FAILED" | "WEBHOOK_INVALID"
  | "STATE_CONFLICT" | "CANCELLED";

type AuditError = {
  code: AuditErrorCode;
  class: AuditErrorClass;
  message: string;
  retryAfter?: string;
};
```

The policy table in [runtime-api.md](runtime-api.md#typed-failures) is authoritative for each code's class and fallback. Product surfaces never collapse these values into an untyped generic failure.

## Convex tables

### `audits`

Required fields:

- `publicId`, `kind: FREE | PAID`, `parentAuditId?`
- `status`, `revision` (optimistic state revision), `nextEventSeq`
- `input: { homepageUrl, direction, audience?, launchGoal? }`
- `sourceLocale`, `targetLocale`, `siteBoundary: { submittedHost, registrableDomain, verifiedHosts[] }`
- `limits: { maxPagePairs, exactFindingCount?, maxFindings, maxChildren, maxDepth, maxRuntimeSeconds }`
- `hermesRunId?`, `hermesSessionId?`, `reportId?`, `paymentId?`
- `runStartState: UNRESERVED | STARTING | BOUND | UNCERTAIN`, `runStartAttemptId?`, `runStartReservedAt?`
- `runStartDispatchState?: RESERVED | NOT_DISPATCHED | MAYBE_DISPATCHED | ACKNOWLEDGED`
- `versions: { contract, prompt, skill, kb }`
- `claimedBy?`, `claimedAt?`, `startedAt?`, `finishedAt?`
- `degraded: { liveMarketEvidenceUnavailable: boolean, embeddingsUnavailable: boolean }`
- `error?: AuditError`
- `createdAt`, `updatedAt`

Indexes: `by_public_id`, `by_status_created_at`, `by_parent_audit`, `by_hermes_run_id`.

### `agentEvents`

- `auditId`, `seq`, `eventId`, `type`, `actor`, `status`
- `safeLabel`, `hermesRunId?`, `toolName?`
- `durationMs?`, `usage?: { inputTokens?, outputTokens?, costMinorUsd? }`
- `occurredAt`, `persistedAt`

Indexes: `by_audit_seq`, `by_audit_event_id`. `(auditId,eventId)` is deduplicated within the append mutation; `seq` increments from `audits.nextEventSeq` atomically.

### `pages`

- `auditId`, `pageId`, `pairId`, `role: HOMEPAGE | SECONDARY`
- `locale`, `url`, `normalizedUrl`, `contentLanguage?`
- `status: ELIGIBLE | BLOCKED | CAPTURED | FAILED`
- `sourceOrTarget: SOURCE | TARGET`, `artifactIds[]`, `capturedAt?`, `error?`

Indexes: `by_page_id`, `by_audit`, `by_audit_pair`.

### `artifactRefs`

- `auditId`, `artifactId`, `pageId`, `captureId`
- `kind: SCREENSHOT | HTML | MARKDOWN | ACCESSIBILITY_TREE`
- `r2Key`, `mimeType`, `sha256`, `sizeBytes`, `sourceUrl`, `capturedAt`

Indexes: `by_artifact_id`, `by_audit`, `by_page`.

### `evidencePacks`

- `auditId`, `packId`, `provider: LINKUP | GBRAIN`
- `status: AVAILABLE | DEGRADED | UNAVAILABLE`
- `query?`, `sourceIds[]`, `payload`, `retrievedAt`, `expiresAt?`, `sha256`

Indexes: `by_pack_id`, `by_audit_provider`.

### `reports`

- `auditId`, `reportId`, `reportVersion`, `idempotencyKey`
- `payload` validated against the report contract
- `hermesRunId`, `publishedAt`

Indexes: `by_report_id`, `by_audit`, `by_idempotency_key`. One successful report per `(auditId,reportVersion)`.

### `payments`

- `paymentId`, `freeAuditId`, `paidAuditId?`
- `checkoutSessionId`, `providerPaymentId?`
- `status: CREATED | CHECKOUT_OPEN | SUCCEEDED | FAILED | REFUNDED`
- `amountMinor`, `currency`, `createdAt`, `updatedAt`

Indexes: `by_payment_id`, `by_free_audit`, `by_checkout_session`, `by_provider_payment`.

### `paymentEvents`

- `providerEventId`, `eventType`, `paymentId?`, `signatureVerified`
- `receivedAt`, `processedAt?`, `payloadSha256`, `result`

Index: `by_provider_event_id`. The processing mutation queries and inserts by this index atomically.

## Convex functions

### Browser-facing

- `audits.submit(input) -> { auditId }`
- `audits.get({ auditId }) -> AuditView`
- `events.list({ auditId, afterSeq? }) -> AgentEvent[]`
- `reports.getByAudit({ auditId }) -> Report | null`
- `payments.createCheckout({ freeAuditId }) -> { paymentId, checkoutUrl }`
- `payments.getByAudit({ freeAuditId }) -> PaymentView | null`

Only `audits.submit` and `payments.createCheckout` mutate from the browser. Public reads expose sanitized views, not internal tokens or raw payloads.

### Runtime/internal

- `runtime.claimNext({ workerId }) -> AuditPacketSeed | null`: atomically claims the oldest eligible `SUBMITTED` or `PAID_QUEUED` audit that has no unresolved start reservation.
- `runtime.reserveHermesStart({ auditId, attemptId })`: atomically changes `UNRESERVED -> STARTING` and records dispatch state `RESERVED` before the relay calls Hermes.
- `runtime.markHermesStartDispatch({ auditId, attemptId, dispatchState })`: advances the matching attempt to `NOT_DISPATCHED`, `MAYBE_DISPATCHED`, or `ACKNOWLEDGED` from HTTP-client evidence.
- `runtime.bindHermesRun({ auditId, attemptId, runId, sessionId })`: atomically changes the matching reservation `STARTING -> BOUND`, records `ACKNOWLEDGED`, and transitions `ELIGIBILITY_CHECK -> FREE_RUNNING` or `PAID_QUEUED -> PAID_RUNNING`.
- `runtime.markHermesStartUncertain({ auditId, attemptId })`: fail-closed transition used when the external create outcome cannot be proven.
- `runtime.claimStaleHermesStarts({ workerId, olderThan })`: claims stale `STARTING` attempts for bounded recovery; `MAYBE_DISPATCHED` becomes uncertain, while only a durably proven `NOT_DISPATCHED` attempt may be retried once.
- `runtime.appendEvents({ auditId, events[] })`: deduplicates and sequences.
- `runtime.setAuditState({ auditId, expectedRevision, nextState, error? })`
- `runtime.upsertCaptureManifest({ auditId, manifest })`
- `runtime.upsertEvidencePack({ auditId, pack })`
- `runtime.publishReport({ report, idempotencyKey })`: validates/persists once and atomically transitions `FREE_RUNNING -> FREE_REPORT` or `PAID_RUNNING -> PAID_REPORT`.
- `runtime.markHeartbeat({ auditId, workerId })`

These functions are reached only through authenticated server code or protected HTTP Actions. Claim leases expire after 30 seconds without heartbeat. A reclaim never starts a run when `hermesRunId` is bound or `runStartState` is `STARTING`, `BOUND`, or `UNCERTAIN`.

The relay always sends `session_id=auditId`, but Hermes 0.18.2 exposes no run-by-session lookup and ignores idempotency keys on run creation. It retries `POST /v1/runs` only when its HTTP client proves request bytes were never dispatched. A timeout, reset, lost response, or crash after possible dispatch becomes `UNCERTAIN`/`HERMES_START_UNCERTAIN`; session and local-log evidence is diagnostic only, and session absence never authorizes another run. The stale-start sweeper prevents orphaned `STARTING` records, and the crash-at-create/bind boundary is a mandatory regression scenario.

### HTTP Actions

- `POST /runtime/events`: bearer-protected batch ingestion from relay.
- `POST /runtime/report`: bearer-protected report publication when direct Convex client use is unavailable.
- `POST /webhooks/dodo`: raw-body signature verification and idempotent processing.

No HTTP Action contains agent planning logic.
