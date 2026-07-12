# Dodo webhook and paid-run reconciliation — 2026-07-11

- Added signed Dodo webhook verification at `POST /api/webhooks/dodo` using the official SDK and raw request body.
- Registered the Dodo test webhook for `payment.succeeded`; stored its signing key in macOS Keychain.
- Added bounded payment-status reconciliation so a successful payment made before webhook registration is recovered without another charge.
- Confirmed payment `pay_0NizGtnrlvlQ245Tj64Cr` for audit `aud_local_292c9f4f93a3481d`.
- Confirmed creation of paid audit `aud_local_paid_92e40ba5ab97470e` and Hermes run `run_2309624df7934687a7c288091b566f9d`.
- Verification: typecheck passed; complete repository test suite passed (61 tests); production health returned HTTP 200.
- Fixed live transport polling so `FREE_REPORT` remains active while Dodo confirmation is pending; added a delayed-confirmation regression test.
- Deployed polling fix as Cloudflare Worker version `fd8d0c91-51af-4501-9254-d9760c9c3823`.

## Paid workflow audit finding

The payment-to-second-run transition is operational, but the second Hermes run remains a scoped placeholder. It does not yet discover additional pages, capture Cloudflare Browser Rendering screenshots, persist up to six findings, or publish a completed paid report. This limitation must remain explicit until that vertical slice is implemented and verified.
