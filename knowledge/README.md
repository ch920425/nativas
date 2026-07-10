# nativas.ai golden knowledge base

This directory defines the deterministic, project-isolated localization-reference corpus used by the demo. The Lane 3 corpus lives in [`fixtures/kb/golden-six.v1.json`](../fixtures/kb/golden-six.v1.json), is versioned as `golden-six-v1`, and is separate from the shared synthetic contract fixture.

## Safety and truthfulness

- The current six records are explicitly `DEMO_SEED` examples, not external research. A report using them must label them **demo reference material**; `reviewerStatus: REVIEWED` satisfies the schema only and is not a claim of external human review.
- Linkup is the sole allowed discovery/research provider when the corpus is refreshed. Do not use Exa.
- A production promotion needs a public source URL, retained Browser Run screenshot, a human review, and a new immutable record ID or dataset version.
- Use a project-only `GBRAIN_HOME`; never point these commands at a personal gbrain.

## Local preparation

```bash
export GBRAIN_HOME="$PWD/.runtime/gbrain-nativas"
node scripts/kb/build-import.mjs --out "$PWD/.runtime/gbrain-import"
node scripts/kb/prepare-gbrain.mjs --home "$GBRAIN_HOME" --import "$PWD/.runtime/gbrain-import"
```

`prepare-gbrain.mjs` calls `gbrain init --pglite --no-embedding` and imports the generated Markdown with `--no-embed`. It rejects the personal default `~/.gbrain`. It does not use or require embeddings for P0. To try embeddings after a valid provider is configured, add `--try-embeddings`; that attempt is bounded to five minutes and failure leaves the deterministic keyword fallback active.

## Retrieval boundary

The MCP server exposes only `search`, `query`, and `get_page`; all are read-only. `search` and `query` accept `direction`, optional matching `sourceLocale`/`targetLocale`, `componentType`, `industry`, `audience`, `issueHypothesis`, and `limit` (capped at 3). They return concise records only—not the entire corpus. Start it with:

```bash
node apps/kb-mcp/src/server.mjs
```

The runtime must configure this process as the `nativas_kb` MCP server and permit only these three tools. It must never expose gbrain's write/import/delete/embed tools to Hermes.

## Lane 2 integration snippet

```js
const kbRequest = {
  direction: audit.direction,
  sourceLocale: audit.direction === "KR_TO_US" ? "ko-KR" : "en-US",
  targetLocale: audit.direction === "KR_TO_US" ? "en-US" : "ko-KR",
  componentType: "PRIMARY_CTA",
  industry: audit.category,
  audience: audit.audience,
  issueHypothesis: "CTA commitment and trust risk",
  limit: 3
};
// Call only nativas_kb.search/query. Cite returned id, sourceUrl, and
// screenshotArtifactRef; surface supportLabel verbatim and never treat demo
// material as live market research.
```
