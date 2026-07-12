# Supabase Postgres backend for the isolated nativas gbrain

The isolated nativas knowledge base runs on gbrain `0.36.3`, which supports two engines: PGLite (local file, deterministic fallback) and Postgres + pgvector (Supabase or self-hosted). The Hermes-facing retrieval surface (`search`, `query`, `get_page`, `think` through `apps/kb-mcp/src/gbrain-proxy.mjs`) is identical on both engines.

## Engine selection

`apps/kb-mcp/src/gbrain-env.mjs` resolves the engine at proxy/script start:

| Priority | Source | Engine |
| --- | --- | --- |
| 1 | `GBRAIN_DATABASE_URL` or `NATIVAS_GBRAIN_DATABASE_URL` env | Postgres |
| 2 | macOS Keychain service `nativas-supabase-db-url` | Postgres |
| 3 | none of the above | PGLite under `GBRAIN_HOME` |

`NATIVAS_GBRAIN_ENGINE=pglite` pins PGLite even when a URL is stored (use for deterministic local test runs). The connection string is never logged, never written to the repo, and never sent to the client or Hermes children.

## Environment variables

| Variable | Purpose | Storage |
| --- | --- | --- |
| `NATIVAS_GBRAIN_DATABASE_URL` | Supabase session-pooler Postgres URL for the nativas KB | macOS Keychain (`nativas-supabase-db-url`) or launch environment; never in git |
| `GBRAIN_HOME` | Isolated brain home (`<repo>/.runtime/gbrain`) | Hermes profile config / script flag |
| `NATIVAS_GBRAIN_ENGINE` | Optional `pglite` pin | environment only |

Use the **session pooler** URL shape (direct `db.*.supabase.co:5432` connections are IPv6-only and rejected with a warning):

```text
postgresql://postgres.[project-ref]:[db-password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

## Setup commands

```bash
# 1. Authenticate the CLI against the Supabase account that owns the project slot.
supabase login

# 2. Create the project (password never echoes; store it in Keychain first).
PW=$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)
security add-generic-password -U -a "$USER" -s nativas-supabase-db-password -w "$PW"
supabase projects create nativas-kb --org-id <org-id> --db-password "$PW" --region us-west-1

# 3. Store the session-pooler URL in Keychain (fill in ref/region from the dashboard).
security add-generic-password -U -a "$USER" -s nativas-supabase-db-url \
  -w "postgresql://postgres.<ref>:$PW@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# 4. Initialize + import the six reviewed golden records on the Supabase engine.
node scripts/kb/prepare-gbrain.mjs --home .runtime/gbrain \
  --import .runtime/gbrain-import --engine supabase --try-embeddings

# 5. Verify through gbrain's own surface.
GBRAIN_HOME=.runtime/gbrain gbrain doctor --fast
```

Embeddings activate only when an embedding provider key (for example `OPENAI_API_KEY` or `VOYAGE_API_KEY`) is present in the launch environment; otherwise gbrain's keyword/hybrid retrieval remains the honest fallback, matching the PRD knowledge policy. Re-run `gbrain embed --all` after configuring a provider.

## Boundaries that do not change

- Hermes reaches the KB only through the read-only proxy allowlist (`search`, `query`, `get_page`, `think`).
- Convex stores privacy-safe retrieval spans and eval projections only — never records, vectors, or queries.
- Audit output is never auto-promoted into the corpus; the six-record golden set stays reviewed.
- No secrets in git: the connection string lives in Keychain (or the launch environment) only.

## Tests

- `tests/kb/gbrain-env.test.mjs` — engine selection, keychain fallback, PGLite pin, URL validation, no secret leakage.
- `tests/kb/supabase-boundary.test.mjs` — real-engine proof when a URL is configured; explicit skip otherwise.
