# 2026-07-11 - Hermes provider auth failure on production free audit

## Incident

Submitting `https://speak.com` on production created audit `aud_local_22fb1fb67c42433b`, started Hermes run `run_60c6b76559664be786b1821ab763a28a`, and then failed with:

```text
HTTP 401: Wrong API Key
```

## Evidence

- Local persisted audit state recorded status `FAILED`, code `HERMES_RUN_FAILED`, and message `HTTP 401: Wrong API Key`.
- Hermes profile logs under `~/.hermes/profiles/nativas/logs/agent.log` show the failing provider call:
  - provider: `custom:cerebras`
  - base URL: `https://api.cerebras.ai/v1`
  - model: `gemma-4-31b`
  - error: Cerebras response `401 wrong_api_key`
- The failure reproduced across multiple new audits around the same timestamp, so this is a runtime provider credential/configuration issue, not a Speak-specific website issue.

## Root cause

The `nativas` Hermes profile had a Cerebras API key that Cerebras rejected. The app only checked that the local Hermes gateway was running; it did not prove the downstream LLM provider credential before accepting a user audit.

## Fix implemented

- Added `HermesRunClient.checkReady()`.
- Implemented `HermesNativeClient.checkReady()` as a real short Hermes canary run, not a gateway-only health check.
- Cached successful canary checks for five minutes to avoid unnecessary duplicate LLM calls.
- Changed `LocalAuditService.submit()` to run the canary before persisting a new audit or starting capture/search work.
- Added `HERMES_PROVIDER_AUTH_FAILED` to the shared contract.
- Mapped provider-auth failures to a typed 503 API response:

```text
Hermes provider authentication failed. Update the Cerebras key before starting a new audit.
```

- Added a regression test proving bad provider auth rejects `submit()` before persistence, capture, or Hermes user-run creation.

## Validation

- `npm run test:local` passed.
- `npm run typecheck` passed.
- Full repo gate passed:
  - `npm test`
  - `npm run build:cloudflare`
  - `npm run validate`
  - `npm run preflight:cloudflare`

## Follow-up resolution

- Stored the replacement Cerebras API key in macOS Keychain under service `nativas-cerebras-api-key`; no raw secret is stored in the repository.
- Updated `scripts/cloudflare/run-origin.sh` so the production local-origin launcher exports `CEREBRAS_API_KEY` from Keychain when it is not already present in the environment.
- Restarted the local production origin with `launchctl kickstart -k`.
- Confirmed production health at `https://nativas.ai/health`:

```json
{"ok":true,"runtime":"local","hermes":"native-runs"}
```

- Submitted a fresh production free audit against `https://speak.com`.
- The readiness canary succeeded before user work started.
- The new production audit reached `FREE_REPORT`:
  - audit: `aud_local_e47aa3c78e954018`
  - Hermes run: `run_31c8f569b45e4f84ab02a3f8f1b9aef6`
  - report title: `Localization Audit: Speak KR to US Homepage`
- Observed one temporary Cerebras rate-limit retry during the successful run; the workflow recovered and completed.

## Next steps

1. Run full production Dodo paid checkout smoke and verify it reaches `PAID_REPORT`.
2. Replace the temporary Cloudflare Quick Tunnel with the named tunnel token before depending on this beyond the hackathon.
3. Verify private R2 screenshot retrieval from production report pages.
4. Add or capture Hermes screenshot-pixel proof for the paid deep-audit workflow.
5. Add cost/latency dashboards around Hermes canary, free audit, paid audit, Linkup, Browser Rendering, and Cerebras retry behavior.
