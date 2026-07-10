# Dodo payment and autonomous continuation contract

## Checkout

`payments.createCheckout({ freeAuditId })` is valid only for an audit in `FREE_REPORT`. It reuses an existing nonterminal checkout for that audit or creates one Dodo one-time checkout with metadata:

```json
{
  "freeAuditId": "aud_free_...",
  "paymentId": "pay_...",
  "product": "navitas_paid_two_surface_audit_v1",
  "contractVersion": "1.0"
}
```

The browser receives only the hosted checkout URL and public payment status.

## Webhook processing

1. An application-owned Convex HTTP Action reads the raw body plus `webhook-id`, `webhook-signature`, and `webhook-timestamp`; it verifies/parses through the official `dodopayments` SDK `client.webhooks.unwrap(rawBody, { headers })`.
2. Invalid or missing signatures return non-2xx and create no paid work.
3. The internal mutation looks up `providerEventId`. If processed, it returns the stored result without side effects.
4. For `payment.succeeded`, it validates payment amount/currency/product and metadata against the stored checkout.
5. In one atomic mutation it marks the payment `SUCCEEDED`, creates exactly one `PAID` audit in `PAID_QUEUED`, stores `paidAuditId`, and records the processed event.
6. The relay claims the paid audit and starts a new Hermes run.

Idempotency identities:

- Provider delivery: `dodo:{providerEventId}`.
- Paid audit creation: `paid-audit:{paymentId}`.
- Hermes paid run binding: one successful `hermesRunId` per `paidAuditId`.

A server-side Dodo reconciliation action may recover a delayed webhook only after verifying the payment through Dodo's API. It calls the same atomic event processor with a synthetic source marker and cannot bypass amount/product verification.

## Paid continuation packet

The paid `AuditPacket` includes:

- `jobType: PAID`, `parentAuditId`, `paymentId`
- max two additional content surfaces, each represented by one source/target locale pair, and max six findings
- original direction, audience, launch goal, submitted registrable-domain boundary, verified locale hosts, and locale relationship
- prior free `reportId`, `hermesRunId`, accepted terminology decisions, evidence references, and bounded free report payload
- the same frozen prompt/skill/KB contract versions unless an explicit migration is recorded

It does not contain Dodo secrets, customer payment details, hidden model reasoning, or reliance on an in-memory parent conversation.

## Failure behavior

- Checkout abandonment or expiration is recorded on the payment while the free audit remains at `FREE_REPORT`; no paid audit exists.
- `payment.failed` records `FAILED` payment status and starts no run.
- Invalid/duplicate/out-of-order events are safely rejected or return the previously stored result.
- If payment succeeds but Hermes cannot start, the paid audit becomes `FAILED` with canonical `HERMES_START_FAILED` or `HERMES_START_UNCERTAIN`; payment success remains immutable and visible for operator recovery.
- Before calling Hermes, the relay persists a deterministic start reservation and uses `session_id=paidAuditId`. It retries only when the HTTP client proves no bytes were dispatched. A timeout, reset, lost response, or crash after possible dispatch becomes `HERMES_START_UNCERTAIN` and never blind-retries; Hermes session/log absence never proves a replacement safe.
- Operator recovery is manual and may only annotate/bind an independently known run; it never auto-creates a replacement after an uncertain start.

The P0 demo ends when the verified payment has created exactly one linked paid audit and that audit's Hermes run is bound and running. Completing and rendering the capped paid report is P1.
