# Dodo checkout production fix — 2026-07-11

## Root cause

- The local origin returned a hard-coded `127.0.0.1` URL and immediately marked a fake payment successful.
- The production frontend discarded the checkout URL returned by the API.
- Checkout failures were invisible in the modal.

## Changes

- Added the official Dodo Payments Node SDK and a test-mode hosted checkout adapter.
- Created the one-time `Nativas Deep Localization Audit` Dodo test product ($9 USD).
- Stored the Dodo API key and product ID in macOS Keychain; no credential was committed.
- The origin now creates a real hosted session and records `PENDING_CONFIRMATION` without starting paid work early.
- The frontend redirects to the returned hosted checkout and renders API errors in the dialog.
- The launchd origin loads Dodo configuration from Keychain.

## Verification

- `npm run typecheck` — passed.
- `npm run test:local` — 8/8 passed, including pending-payment and idempotency coverage.
- `npm run build:cloudflare` — passed.
- Production Worker version `4792b5c1-dc7a-4af2-b20a-e42eaf039f80` deployed.
- `POST https://nativas.ai/api/audits/aud_local_1339a294678249b7/checkout` returned HTTP 200 and a `https://test.checkout.dodopayments.com/session/...` URL.

## Remaining production boundary

The hosted test checkout now opens correctly. Paid Hermes work remains correctly blocked in `PENDING_CONFIRMATION` until a signed Dodo webhook handler is configured; the service no longer fabricates payment success.
