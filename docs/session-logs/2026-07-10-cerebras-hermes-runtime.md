# Cerebras Hermes runtime — 2026-07-10

## Outcome

The localhost product now routes its Hermes Native Runs through Cerebras `gemma-4-31b` using an isolated `nativas` profile. The free audit remains genuinely Hermes-led: the parent manager performs one native three-worker `delegate_task` batch, reconciles the results, and returns the final evidence-linked report. The application validates the result and exposes normalized progress events to the UI.

## Runtime hardening

- Credentials were stored in macOS Keychain and excluded from Git, logs, and documentation.
- The API-server toolset was reduced to native delegation only.
- Leaf agents were limited to one turn and inherited no MCP, browser, file, terminal, web, or todo tools.
- Concurrency was capped at three to stay within the live account's 100,000-token/minute budget.
- The profile working directory now resolves the checked-in, minimal `.hermes.md` instead of injecting the large coding `AGENTS.md`.
- Report parsing now accepts only declared enums and supplied reference IDs.
- Missing KB citations are repaired only from an existing reviewed reference in the matching component family; unknown or invented values fail closed.

## Live proof

The successful Notion US→KR audit was `aud_local_4f19e7a9b78f433a`, backed by Native Run `run_3144915212b2413da79eec807c976880`.

- external capture and LinkUp preparation completed;
- parent call: ~1.3 seconds;
- three leaf calls ran in parallel, each with zero tool calls;
- delegation batch: ~2.8 seconds, bounded by the slowest leaf;
- final synthesis: ~1.1 seconds;
- observed audit transition to `FREE_REPORT`: about six seconds after run submission;
- Hermes usage: 15,219 input + 1,511 output = 16,730 total tokens;
- final report: exactly three findings, each resolving to supplied LinkUp and reviewed KB evidence.

The local checkout created payment `pay_local_test_0754ff8dd8de4fd0`, paid audit `aud_local_paid_e1732a315a884b4c`, and exactly one linked paid Native Run `run_997cbc64729646739f86a950a5f773a4`.

## UI verification

Chrome rendered the landing intake and the paid-run continuation state at `http://127.0.0.1:5173` without console errors. The live UI showed nativas.ai branding, the KR↔US intake, the bounded three-finding promise, verified-payment state, linked parent/child audit IDs, and the paid Hermes run ID.

## Provider/documentation checks

Current Cerebras material was reviewed through Context7 and verified against live API behavior. The active model supports image inputs, prompt caching, tool calling, parallel tool calling, and strict structured outputs. A direct strict JSON Schema request completed successfully. The production runtime nevertheless retains application validation because Hermes Native Runs does not currently forward that response-format contract.

The live account returned 100 RPM, 100,000 TPM, 6,000 RPH, 6,000,000 TPH, 144,000 RPD, and 144,000,000 TPD headers. Those live headers—not generic public tier tables—are the capacity basis for the three-worker demo.

## Truthful boundaries

- Local capture is HTML/text pairing, not Cloudflare Browser Rendering screenshots.
- Local checkout is simulated, not a Dodo webhook.
- Local persistence is JSON, not deployed Convex.
- The 20-site research corpus is unreviewed and has not been promoted into the runtime golden set.
- gbrain does not currently support a Convex storage engine.
