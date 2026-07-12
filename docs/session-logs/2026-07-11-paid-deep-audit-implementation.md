# 2026-07-11 - Paid deep audit implementation checkpoint

## Decision

For this hackathon build, Nativas keeps gbrain on an isolated local PGLite store. Supabase/Postgres + pgvector remains the later migration path, not the current demo dependency. Convex remains the production-facing state, telemetry, and realtime database layer.

## Implemented in this checkpoint

- Added the deterministic paid deep-audit slice: paid workflow orchestration, page discovery helpers, paid report persistence, recovery behavior, and contract/test coverage.
- Hardened the KB retrieval path with explicit lifecycle policy, gbrain proxy boundaries, deterministic fallback behavior, and Convex retrieval observability schemas.
- Fixed the Hermes native launcher to run `hermes -p nativas gateway run --force --accept-hooks` instead of the invalid `nativas gateway run` command.
- Updated Cloudflare deployment scripts and preflight copy for the current bindings: Browser Rendering and private R2 artifacts.
- Updated the technical spec and Hermes retrieval lifecycle docs to reflect the local PGLite decision and the remaining production gates.
- Deployed Cloudflare Worker version `a93b0678-619d-4d0d-ae84-7e76766eeca3`.
- Restarted the local origin/Hermes runtime. Production `/health` returned `{"ok":true,"runtime":"local","hermes":"native-runs"}` after restart.

## Validation run

- `npm test` - passed.
- `npm run typecheck` - passed.
- `npm run build:cloudflare` - passed.
- `npm run validate` - passed.
- `npm run preflight:cloudflare` - passed.
- `npm audit --audit-level=moderate` - passed with zero vulnerabilities.

## Remaining release gates

These are intentionally not claimed as complete yet:

- Replace the temporary Cloudflare Quick Tunnel with the stable named tunnel.
- Run a protected production paid checkout smoke that ends in `PAID_REPORT`.
- Confirm private R2 screenshot artifacts are created and retrievable only through signed/protected report access.
- Capture Hermes run evidence that proves the paid visual specialists consumed real screenshot pixels, not only text/HTML.
