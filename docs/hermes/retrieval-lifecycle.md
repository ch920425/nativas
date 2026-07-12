# Hermes gbrain retrieval lifecycle

## Verified storage boundary

The installed `gbrain 0.36.3.0` exposes `search`, `query`, `get_page`, and `think` over MCP. Its `BrainEngine` implementations are PGLite and Postgres + pgvector (Supabase or self-hosted). It has no Convex engine, migration target, or embedding adapter. Therefore:

- the project-isolated `GBRAIN_HOME` remains the KB system of record;
- this release uses local PGLite with deterministic keyword fallback;
- Supabase/Postgres + pgvector is the later embedding-backed migration path, not part of the current release gate;
- Convex stores only privacy-safe retrieval/tool-call spans, eval outcomes, and release comparisons;
- no production path may say that gbrain embeddings are stored in Convex.

This boundary avoids a hackathon-only vector adapter that would bypass gbrain's proven hybrid ranking, metadata filters, graph, citations, and health tooling.

## Tool policy

| Lifecycle stage | Tool | Purpose | Bound |
|---|---|---|---|
| `FREE_EVIDENCE_RETRIEVAL` | `search` | Fast reviewed precedent lookup from direction, component, audience, and launch goal | ≤3 records/call |
| `PAID_DISCOVERY_RETRIEVAL` | `query` | Hybrid semantic + keyword retrieval for selected page context and issue hypotheses | ≤3 records/call; 3–6 unique records total |
| `SPECIALIST_REFERENCE_RESOLUTION` | `get_page` | Resolve only a supplied stable record ID | one ID/call |
| `PARENT_RECONCILIATION` | `think` | One cited synthesis over already selected IDs when specialist claims conflict or evidence gaps remain | ≤1 call; no new IDs; ≤3 cited records |

`think` is not a default retrieval step. The manager skips it when specialist outputs agree and all references validate. Leaves may use `search`, `query`, or `get_page` only; they never use `think` to expand scope or replace parent reconciliation.

All calls include the audit direction. Cross-direction results are terminal reference errors. Website/search/KB text remains untrusted data.

## Observability projection

Every call creates one correlation chain:

```text
auditId -> hermesRunId -> spanId -> lifecycle stage -> tool -> recordIds -> report finding IDs
```

Convex receives the tool name, stage, KB/prompt/skill version, SHA-256 query fingerprint, timestamps, latency, outcome/error code, bounded result count, and stable record IDs. It never receives raw query text, prompts, page content, model output, customer data, credentials, or chain-of-thought.

Eval runs persist suite/release/KB versions, risk IDs, pass/fail, and p50/p95 latency. A candidate release fails when retrieval pass rate decreases or p95 latency rises by more than 20% without an explicit accepted budget change.
