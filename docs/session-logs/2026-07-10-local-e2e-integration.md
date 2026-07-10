# Local end-to-end integration — 2026-07-10

## Outcome

`npm run dev:local` now starts a real localhost product path at `http://127.0.0.1:5173` with a loopback API at `http://127.0.0.1:8787`. The API launches a loopback-only Hermes Gateway, submits Native Runs, streams normalized agent events, and persists local audit state under the ignored `.runtime/nativas-local/` directory.

A production-like Notion `US_TO_KR` audit completed successfully as `aud_local_528d074c825142ec` / Hermes Native Run `run_e2083a63e467412190fbb5e9d2df1a76`:

- distinct `en-gb` and `ko` homepage surfaces captured as bounded HTML text snapshots;
- three live LinkUp sources retrieved using the Keychain-backed API credential;
- three reviewed golden references retrieved;
- Hermes invoked one synchronous `delegate_task` batch with three parallel leaf agents;
- exactly three evidence-linked findings were mechanically normalized, validated, and published;
- total wall time was approximately 72 seconds;
- reported Hermes usage was 51,079 input tokens and 3,625 output tokens.

## Truthful local-mode boundaries

- Local capture is HTML text extraction, not Cloudflare Browser Rendering screenshots.
- Local checkout is an explicit test continuation, not a Dodo payment or webhook.
- Local state is JSON persistence, not Convex.
- LinkUp and Hermes are real external services in this path.

## Validation

- `npm test`: 32 backend + 4 local + 18 KB tests passed.
- `npm test --workspace @nativas/web`: 39 tests passed.
- `npm run typecheck`: passed.
- `npm run build --workspace @nativas/web`: passed.
- `npm run validate`: repository and Hermes specification validators passed.

## Follow-up

- Route latency-sensitive Hermes leaf agents to a verified fast inference provider only after confirming supported model IDs, structured-output behavior, image-input support, and concurrency limits from current provider documentation.
- Keep Convex for application/run/payment state in the hackathon scope. The existing gbrain clone does not currently implement a Convex storage backend; a full storage-engine port is a post-hackathon project.
