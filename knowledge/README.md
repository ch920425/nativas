# navitas.ai golden knowledge base

This directory defines the deterministic, project-isolated localization-reference corpus used by the demo. The canonical six records live in [`fixtures/contracts/golden-record.v1.json`](../fixtures/contracts/golden-record.v1.json), which is versioned as `golden-six-v1`.

## Safety and truthfulness

- The current six records are explicitly `DEMO_SEED` examples, not external research. A report using them must label them **demo reference material**.
- Linkup is the sole allowed discovery/research provider when the corpus is refreshed. Do not use Exa.
- A production promotion needs a public source URL, retained Browser Run screenshot, a human review, and a new immutable record ID or dataset version.
- Use a project-only `GBRAIN_HOME`; never point these commands at a personal gbrain.

## Local preparation

```bash
export GBRAIN_HOME="$PWD/.runtime/gbrain-navitas"
node scripts/kb/build-import.mjs --out "$PWD/.runtime/gbrain-import"
node scripts/kb/prepare-gbrain.mjs --home "$GBRAIN_HOME" --import "$PWD/.runtime/gbrain-import"
```

`prepare-gbrain.mjs` calls `gbrain init --pglite --no-embedding` and imports the generated Markdown with `--no-embed`. It does not use or require embeddings for P0. The deterministic keyword ranker remains the required fallback and is what routine tests exercise.

## Retrieval boundary

The MCP server exposes only `search`, `query`, and `get_page`; all are read-only. `search` and `query` accept `direction`, `componentType`, `industry`, `audience`, `issueHypothesis`, and `limit` (capped at 3). They return concise records only—not the entire corpus. Start it with:

```bash
node apps/kb-mcp/src/server.mjs
```

The runtime must configure this process as the `navitas_kb` MCP server and permit only these three tools. It must never expose gbrain's write/import/delete/embed tools to Hermes.
