# Test strategy and 90% meaningful-coverage policy

Risk-weighted test-surface coverage must be ≥90/100 and every P0 scenario below is mandatory. The enumerated points are all-or-nothing per scenario: a scenario earns its weight only when its stated production behavior and assertions pass. The P0 scenarios total 92 points; P1 totals 8. Contract validators, state guards, URL safety, report validation, and payment idempotency separately require ≥90% branch coverage.

| Test ID | Priority | Weight | Production-like proof |
|---|---|---:|---|
| `HERMES-01` | P0 | 8 | Live parent Run/SSE with one real flat delegation batch and genuine tool events |
| `HERMES-02` | P0 | 4 | Typed provider failure, stop/cancel, and event normalization fixtures |
| `HERMES-03` | P0 | 6 | Crash after Hermes create/before bind reconciles by session and never double-starts |
| `STATE-01` | P0 | 4 | Every legal transition succeeds and every illegal transition fails atomically |
| `STATE-02` | P0 | 4 | Duplicate/out-of-order events dedupe and preserve monotonic sequence |
| `STATE-03` | P0 | 4 | Refresh, lease reclaim, heartbeat, and status reconciliation preserve authority |
| `CAP-01` | P0 | 6 | One valid locale pair yields screenshot, HTML/content, Markdown, and accessibility-tree artifacts per page |
| `CAP-02` | P0 | 6 | Private IP, redirect-to-private, DNS rebinding, and cross-registrable-domain candidates are rejected |
| `CAP-03` | P1 | 3 | Timeout, oversize response, and origin block return bounded typed failures |
| `REPORT-01` | P0 | 6 | Exactly three free findings publish with resolvable page, artifact, evidence, and KB references |
| `REPORT-02` | P0 | 5 | Invalid count, target language, enum, size, or reference cannot publish |
| `REPORT-03` | P0 | 4 | Same-key/same-hash submit is idempotent; conflicting payload is rejected |
| `PAY-01` | P0 | 6 | Signed canonical success event creates exactly one linked paid audit and starts one run |
| `PAY-02` | P0 | 4 | Invalid, duplicate, and out-of-order webhooks cannot create extra paid work |
| `PAY-03` | P1 | 2 | Delayed-webhook reconciliation uses the same verified idempotent transition |
| `KB-01` | P0 | 4 | Deterministic six-record import and six queries return correct direction/component in top three |
| `KB-02` | P0 | 2 | No-embedding keyword fallback passes the same retrieval assertions |
| `SEARCH-01` | P0 | 2 | One real Linkup standard structured result validates with bounded citations |
| `SEARCH-02` | P0 | 2 | Linkup timeout makes the report explicitly degraded with no retry or alternate vendor |
| `UI-01` | P0 | 4 | Browser E2E covers submit → real events → three-finding report |
| `UI-02` | P0 | 3 | Refresh, capture failure, degraded search, and delayed payment render truthful states |
| `UI-03` | P0 | 3 | Automated accessibility plus keyboard/focus/reduced-motion checks pass |
| `OBS-01` | P0 | 3 | User-visible events are genuine, fresh, ordered, sanitized, and secret-free |
| `PERF-01` | P1 | 3 | Capture, retrieval, run, event, cost, and total-duration budgets are measured |
| `REHEARSE-01` | P0 | 2 | One free audit → verified payment → exactly-one context-linked paid-run start succeeds |

Use contract/unit, boundary integration, browser E2E, and explicit credentialed live-smoke layers. CI uses sanitized official-response fixtures; mocks cannot bypass signatures or validation. Call-count-only tests, unasserted snapshots, trivial getters, and impossible toy inputs earn no risk points. No P0 test may be skipped; a skipped P1 earns zero points. Each integration bug adds a realistic regression. Delete stale fixtures, orphan helpers, dead code, and superseded tests immediately. Report passed test IDs, risk score, and branch coverage separately.
