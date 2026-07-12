# Run observability and tracing

The local origin records a privacy-safe trace span for every audit stage, tool call, Hermes run, payment activation, and report publication (`apps/local-server/src/telemetry.ts`).

## Correlation chain

Every span carries only enumerated correlation IDs along the release chain:

```text
paymentId -> paidAuditId -> captureId -> hermesRunId -> reportId
```

Span kinds: `STAGE` (audit lifecycle states), `TOOL` (capture / Linkup / KB), `HERMES_RUN` (manager runs, with token usage and optional USD cost), `PAYMENT`, `REPORT`. Each span has `startedAt`, `durationMs`, `outcome` (`SUCCEEDED`/`FAILED`), and a typed `errorCode` on failure. Prompts, page content, queries, credentials, and customer details cannot enter a span by construction — only enumerated fields persist.

## Where traces live

- In memory per audit (bounded to 300 spans) and appended to `.runtime/nativas-local/telemetry.jsonl` (mode 0600, untracked).
- `GET /api/audits/:auditId/trace` returns `{ auditId, spans }` for an existing audit; it sits behind the same edge-token authorization as every other API route.

## Cost reporting

Token usage comes from the validated Hermes run result. USD cost appears only when both `NATIVAS_COST_USD_PER_MTOK_INPUT` and `NATIVAS_COST_USD_PER_MTOK_OUTPUT` are configured; nothing is estimated from guessed prices.

## Tests

- `tests/local/telemetry.test.ts` — span lifecycle, duration, JSONL persistence, privacy negative checks, bounded history, cost gating.
- `tests/local/trace.test.ts` — POBS-01: full free → payment → paid `PAID_REPORT` trace with the complete correlation chain, and a typed failure span on a failing paid stage.
