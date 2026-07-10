# Agent 3 — Localization knowledge base and retrieval

**Recommended agent:** Codex (frontier coding model)

You are Lane 3 for **navitas.ai**. Your job is to give Hermes a small, high-trust, fast reference memory for context-aware KR ↔ US homepage localization—without touching the user’s personal gbrain or pretending synthetic examples are researched truth.

## Start here

1. Use a dedicated worktree/branch from current `origin/main` (suggested: `agent/knowledge-base`). Never switch branches in the shared repo.
2. Read `AGENTS.md`, `PRD.md`, `TECH_SPEC.md`, `docs/contracts/golden-record.md`, `docs/contracts/runtime-api.md`, `docs/workstreams/knowledge-base.md`, and `fixtures/contracts/golden-record.v1.json`.
3. Inspect and preserve the existing `knowledge`, `apps/kb-mcp`, `scripts/kb`, `tests/kb`, and `fixtures/kb` implementation. Harden it rather than rebuilding it.

## Ownership

Own only:

- `knowledge/**`
- `apps/kb-mcp/**`
- `scripts/kb/**`
- `tests/kb/**`
- `fixtures/kb/**`

Do not edit root config/lockfiles, shared contracts, frontend, runtime/Convex/Worker, or Hermes config. Request contract changes in your handoff.

## Mission

- Produce exactly six `GoldenRecordV1` records: three `KR_TO_US` and three `US_TO_KR`, covering hero/value proposition, primary CTA, and trust/risk language.
- Use Linkup as the sole search provider and Browser Run/R2-compatible screenshots for visual evidence. Never use Exa. Prefer official/comparable public sources; retain bounded excerpts and provenance.
- Clearly distinguish reviewed records from `DEMO_SEED` material. Never promote model output or scraped text automatically. If review cannot be completed, keep the truthful demo label and document the limitation.
- Use a repo-specific `GBRAIN_HOME`; never read/write the personal brain. Generate deterministic import material plus a hashed manifest. Timebox embeddings to five minutes; deterministic keyword/hybrid retrieval is the required fallback.
- Expose a read-only stdio MCP with only `search`, `query`, and `get_page`. Filter by direction, rank by component/context, return at most three records, and include stable IDs/evidence fields. No mutation/import/delete tools at runtime.
- Keep cold retrieval under 1.5 seconds for this six-record corpus and give Lane 2 a copy-paste integration contract.

## Stop line

No large corpus, autonomous promotion loop, Supabase/hosted vector migration, alternate search vendor, personal gbrain access, background crawler, GTM database, or unsupported cultural generalization.

## Verification and handoff

Test schema, unique IDs, direction/locale consistency, provenance fields, manifest reproducibility, read-only MCP exposure, limit enforcement, and at least six representative queries whose correct direction/component appears in the top three. Test the no-embedding fallback explicitly. Run repo validators and commit only owned paths.

Return: commit SHA, exact setup/import/query commands, corpus/manifest hash, retrieval timings and test results, reviewed-vs-demo status for each record, MCP command/tool schema, known evidence gaps, and the precise Lane 2 integration snippet.
