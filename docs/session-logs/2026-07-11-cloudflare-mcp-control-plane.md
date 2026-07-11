# Cloudflare MCP control-plane migration — 2026-07-11

## Outcome

Installed Cloudflare's official agent skills and registered authenticated Cloudflare MCP control surfaces: primary Cloudflare, bindings, builds, observability, and public documentation. Production control now belongs to MCP/OAuth rather than repository scripts that invoke local Wrangler with an API token or OAuth session.

## Runtime boundary

The deployed Worker continues to be the public edge. The laptop API continues to be protected with `NATIVAS_EDGE_TOKEN`. A future named `api.nativas.ai` Cloudflare Tunnel connector receives only its revocable connector token from the macOS Keychain. MCP is never called from the request path and no Cloudflare control-plane credential belongs in the Node backend or repository.

## Repository changes

- Removed the Quick Tunnel launcher so rotating random `trycloudflare.com` URLs cannot be treated as production.
- Changed launchd tunnel startup to the named connector script.
- Made origin/tunnel scripts retrieve runtime secrets from Keychain and fail with a clear message if missing.
- Replaced local deployment mutations with a build/preflight script that directs operators to Cloudflare MCP.
- Added production-control documentation and a UI regression test for a failed live audit submission.

## Validation

- `npm test --workspace @nativas/web -- --run src/App.test.tsx` — 12 passing.
- `npm run preflight:cloudflare` — passing.
- `plutil -lint cloudflare/launchd/*.plist` — passing.
- Agentic-harness pre/post hooks and tool discovery verification completed; the host verifier reported 98.9% coverage, with one pre-existing js_repl configuration warning unrelated to this change.

## Follow-up after MCP tool refresh

Use the MCP to create a named tunnel and `api.nativas.ai` hostname, store its connector token in Keychain, set the Worker `API_ORIGIN` and `EDGE_ORIGIN_TOKEN` through MCP, and confirm `https://nativas.ai/health` from an external network.
