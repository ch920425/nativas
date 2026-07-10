# Lane 3 — Codex knowledge base and golden set

## Mission and ownership

Produce a reproducible, high-trust six-record corpus retrievable in under 1.5 seconds. Own `knowledge/**`, `apps/kb-mcp/**`, `scripts/kb/**`, `tests/kb/**`, and `fixtures/kb/**`.

## Exact corpus

Version `golden-six-v1` contains exactly three records per direction: hero/value proposition, primary CTA, and trust language. Canonical direction values are `KR_TO_US | US_TO_KR`; canonical BCP-47 locale values are `ko-KR | en-US`. Every record has stable ID, direction/locales, component type, category, audience, source/current/recommended copy, rationale, precedent/anti-pattern label, official source URL, capture timestamp, screenshot artifact ref, reviewer status, and keywords.

- Use Linkup—not Exa—for search; Browser Run for visual capture.
- Use an isolated project `GBRAIN_HOME`; never touch the personal brain.
- Import Markdown deterministically and emit a hashed manifest.
- Timebox embeddings to five minutes; keyword retrieval is the truthful fallback.
- Preserve only short excerpts and sources; do not infer unsupported market rules.
- Runtime access is read-only; freeze the corpus before integration.
- The MCP returns at most three records for one audit, filtered to the requested direction and ranked by component/context relevance. It never returns the full corpus as implicit prompt context.

## Tests and handoff

Validate schema, unique IDs, URLs, hashes, screenshot refs, and cold-import reproducibility. Six representative queries must return the correct direction/component in the top three; the no-embedding fallback must pass the same assertions. Handoff includes corpus, manifest/hash, setup/query commands, timings, fixtures, and review checklist.
