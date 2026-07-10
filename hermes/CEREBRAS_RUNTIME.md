# Cerebras-backed Hermes runtime

The localhost demo runs Hermes as the accountable orchestration layer and Cerebras `gemma-4-31b` as its inference provider. Credentials remain in macOS Keychain and are never stored in this repository.

## Runtime contract

- Profile: `nativas`
- Provider: `custom:cerebras` at `https://api.cerebras.ai/v1`
- Model: `gemma-4-31b`
- Parent surface: Hermes Native Runs API
- Parent tools: only native `delegate_task`
- Swarm shape: one flat batch of three leaf agents
- Leaf turns: one model call, no tools, no recursion
- Roles: visual-context diagnosis, market-native copy, evidence/meaning QA
- Final output: one mechanically validated JSON report with exactly three findings
- Runtime credential source: macOS Keychain service `codex.cerebras.api_key`

The source-of-truth launcher is `/Users/seungjaecha/.codex/scripts/nativas-hermes-wrapper`; `/Users/seungjaecha/.local/bin/nativas` points to it. `apps/local-server/src/hermes-native.ts` launches that command unless `NATIVAS_HERMES_COMMAND` overrides it.

The active profile is intentionally machine-local at `/Users/seungjaecha/.hermes/profiles/nativas/config.yaml`. The checked-in `.hermes.md` supplies only the small product-runtime context. The profile sets its working directory to this repository and restricts `platform_toolsets.api_server` to `delegation`, preventing leaf workers from improvising browser, file, terminal, web, or planning calls.

## Why three workers, not ten

The live account advertised 100 requests/minute and 100,000 tokens/minute during validation. Three parallel specialists leave enough headroom for the parent synthesis and a deterministic demo. Ten large workers would compete for the same token budget and raise throttling risk without improving the bounded three-finding output.

## Structured-output boundary

Cerebras strict JSON Schema mode was verified directly against `gemma-4-31b`. Hermes' current Native Runs path uses the OpenAI-compatible chat-completions interface without forwarding the product's JSON Schema response format. The application therefore keeps a fail-closed validator after Hermes returns:

- exact component, issue, severity, and anchor enums;
- exactly three findings;
- confidence range validation;
- evidence and KB IDs must resolve to supplied packets;
- only mechanical alias normalization;
- a missing KB citation may be repaired only from an existing, reviewed precedent in the same component family.

Unknown enums or invented references remain terminal `REPORT_INVALID` failures.

## Verified localhost run

Audit `aud_local_4f19e7a9b78f433a` completed as Native Run `run_3144915212b2413da79eec807c976880` in roughly six seconds after capture and LinkUp preparation. Hermes made one parent call, one three-worker parallel delegation batch, and one parent synthesis call. The three workers made no tool calls. Hermes reported 15,219 input tokens and 1,511 output tokens.

The local checkout then created exactly one linked paid audit and Native Run. Local checkout is explicitly simulated; production Dodo verification remains a separate deployment concern.

## Operator checks

```bash
nativas profile show nativas
npm run dev:local
curl http://127.0.0.1:8787/health
```

The active profile must never be copied into Git because it is machine-specific. The profile contains no plaintext credential, but the repository should still contain only examples and runtime contracts.

Documentation was cross-checked against the current local Hermes documentation and current Cerebras Context7 material for custom OpenAI-compatible providers, image input, parallel tool calls, prompt caching, structured outputs, and model limits. The provider's live response headers remain the source of truth for this account's rate limits.
