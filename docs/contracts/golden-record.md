# Golden localization record contract

`GoldenRecordV1` is the canonical unit stored in the navitas.ai localization
knowledge base. It gives Hermes a reviewed precedent or anti-pattern with
enough product, copy, and visual context to support a recommendation. It is an
evidence aid, not an instruction to copy another company's language.

## Canonical shape

```ts
type GoldenRecordV1 = {
  schemaVersion: "1.0";
  id: string;
  version: "golden-six-v1";
  direction: "KR_TO_US" | "US_TO_KR";
  sourceLocale: "ko-KR" | "en-US";
  targetLocale: "en-US" | "ko-KR";
  industry: string;
  audience: string;
  pageType: "HOMEPAGE";
  componentType:
    | "HERO_HEADLINE"
    | "VALUE_PROPOSITION"
    | "PRIMARY_CTA"
    | "TRUST_COPY";
  category: string;
  sourceCopy: string;
  currentTargetCopy: string;
  recommendedTargetCopy: string;
  intent: string;
  rationale: string;
  visualConstraints: string[];
  patternType: "PRECEDENT" | "ANTI_PATTERN";
  sourceUrls: string[];
  screenshotArtifactRef: string;
  capturedAt: string;
  reviewedAt: string;
  reviewerStatus: "REVIEWED";
  keywords: string[];
};
```

`direction`, `sourceLocale`, and `targetLocale` must agree. Timestamps use ISO
8601 UTC. `sourceUrls` contains only public pages reviewed for that record, and
`screenshotArtifactRef` resolves to the retained visual evidence used during
review. A production ingestion path must reject missing evidence, mismatched
locale directions, and unknown enum values.

## Retrieval contract

- Filter by direction and locale pair before ranking.
- Prefer matches on industry, audience, component type, category, and keywords.
- Return at most three records per retrieval call.
- Supply record IDs and evidence references to Hermes; never present retrieved
  copy as independently verified fact.
- Treat `ANTI_PATTERN` records as warnings, not positive examples.
- Keep production records immutable. A substantive correction creates a new
  record ID or dataset version so audit outputs remain reproducible.

## Demo fixture and promotion rule

[`golden-record.v1.json`](../../fixtures/contracts/golden-record.v1.json)
contains exactly six synthetic `DEMO_SEED` records: three per localization
direction. They exist only to make the contract, retrieval path, and demo
deterministic. The `example.invalid` URLs, artifact references, copy, rationale,
and `REVIEWED` values are illustrative; `REVIEWED` indicates schema state in
the fixture and does not claim external research or human validation.

Lane 3 should replace these demo seeds with genuinely reviewed records before
judging if time permits. A replacement requires accessible source evidence, a
retained screenshot, a human review pass, and the same contract validation.
Until then, the UI and report must label any seed-derived support as demo
reference material rather than researched localization ground truth.
