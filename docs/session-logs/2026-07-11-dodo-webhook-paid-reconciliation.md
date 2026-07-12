# Dodo webhook and paid-run reconciliation — 2026-07-11

- Added signed Dodo webhook verification at `POST /api/webhooks/dodo` using the official SDK and raw request body.
- Registered the Dodo test webhook for `payment.succeeded`; stored its signing key in macOS Keychain.
- Added bounded payment-status reconciliation so a successful payment made before webhook registration is recovered without another charge.
- Confirmed payment `pay_0NizGtnrlvlQ245Tj64Cr` for audit `aud_local_292c9f4f93a3481d`.
- Confirmed creation of paid audit `aud_local_paid_92e40ba5ab97470e` and Hermes run `run_2309624df7934687a7c288091b566f9d`.
- Verification: typecheck passed; complete repository test suite passed (61 tests); production health returned HTTP 200.
