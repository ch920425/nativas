# Capture, evidence, and report contracts

## CaptureManifest

```json
{
  "schemaVersion": "1.0",
  "auditId": "aud_...",
  "captureId": "cap_...",
  "capturedAt": "2026-07-10T09:00:00.000Z",
  "viewport": { "width": 1440, "height": 900 },
  "pairs": [
    {
      "pairId": "pair_home",
      "role": "HOMEPAGE",
      "source": { "pageId": "page_ko", "locale": "ko-KR", "url": "https://example.com/ko", "artifactIds": ["art_..."] },
      "target": { "pageId": "page_en", "locale": "en-US", "url": "https://example.com/en", "artifactIds": ["art_..."] },
      "localeEvidence": { "method": "HREFLANG", "source": "rendered_html", "confidence": 0.98 }
    }
  ],
  "limitsApplied": { "maxPagePairs": 1, "redirects": 1, "totalBytes": 8420012 }
}
```

Free reports require exactly one complete `HOMEPAGE` pair. Paid reports accept one or two `SECONDARY` pairs. `localeEvidence.method` is `HREFLANG`, `DIRECT_LINK`, `SUBDOMAIN`, `PATH`, or `QUERY`; ambiguous language inference alone does not qualify.

## ArtifactRef

Every captured page requires these four artifact kinds from one Browser Run
snapshot request:

- `SCREENSHOT`: PNG or WebP at the capture viewport.
- `HTML`: rendered HTML, capped and sanitized for storage.
- `MARKDOWN`: rendered textual representation.
- `ACCESSIBILITY_TREE`: semantic component context. Missing output fails capture as `CAPTURE_INCOMPLETE` for the pinned v1 Browser Run contract.

```json
{
  "artifactId": "art_...",
  "auditId": "aud_...",
  "pageId": "page_en",
  "captureId": "cap_...",
  "kind": "SCREENSHOT",
  "r2Key": "audits/aud_.../pages/page_en/cap_.../screenshot.png",
  "mimeType": "image/png",
  "sha256": "hex...",
  "sizeBytes": 1200345,
  "sourceUrl": "https://example.com/en",
  "capturedAt": "2026-07-10T09:00:00.000Z"
}
```

Artifacts are immutable. Recapture creates new IDs and keys; reports pin exact IDs.

## EvidencePack

Linkup evidence is current external support; gbrain records are curated precedents. Neither is treated as ground truth by itself.

```json
{
  "schemaVersion": "1.0",
  "packId": "evi_...",
  "auditId": "aud_...",
  "provider": "LINKUP",
  "status": "AVAILABLE",
  "query": "...",
  "items": [
    {
      "evidenceId": "web_1",
      "title": "Official comparable page",
      "url": "https://official.example/page",
      "retrievedAt": "2026-07-10T09:00:00.000Z",
      "claim": "Comparable sites use a direct, low-commitment primary CTA.",
      "excerpt": "Short bounded excerpt",
      "comparability": "B2B SaaS homepage targeting US operators"
    }
  ]
}
```

Maximum three Linkup items. URLs must be public `https` sources. A report may cite an evidence item only for the bounded claim stored with it.

## Report v1

Required top-level fields:

- `schemaVersion: "1.0"`, `reportId`, `auditId`, `reportVersion: 1`
- `jobType: FREE | PAID`, `direction`, `sourceLocale`, `targetLocale`
- `title`, `executiveSummary`, `auditedPairIds[]`
- `evidenceStatus: { liveMarket, goldenSet, limitations[] }`
- `findings[]`
- `generation: { hermesRunId, hermesSessionId, promptVersion, skillVersion, kbVersion, durationMs, inputTokens?, outputTokens?, costMinorUsd? }`
- `publishedAt`

For `FREE`, `findings.length` is exactly 3 and all findings reference the homepage pair. For `PAID`, `auditedPairIds.length` is 1–2 and `findings.length` is 1–6.

### Finding

```json
{
  "findingId": "finding_1",
  "rank": 1,
  "pageId": "page_en",
  "pageArtifactId": "art_target_screenshot",
  "componentRef": { "kind": "ACCESSIBILITY_NAME", "value": "hero primary call to action" },
  "componentType": "PRIMARY_CTA",
  "sourceCopy": "지금 시작하기",
  "currentTargetCopy": "Start now",
  "proposedTargetCopy": "See nativas.ai on your site",
  "issueType": "CTA_MARKET_FIT",
  "severity": "HIGH",
  "businessImpact": "The existing CTA asks for commitment before explaining the result.",
  "rationale": "A concrete, low-risk action better matches this buyer stage and the visible page promise.",
  "confidence": 0.88,
  "evidenceRefs": [{ "packId": "evi_...", "evidenceId": "web_1" }],
  "kbRefs": ["gold_kr_us_cta_01"],
  "checks": {
    "meaningPreserved": true,
    "targetLanguage": "en-US",
    "evidenceGrounded": true
  }
}
```

Enums:

- `componentType`: `HERO_HEADLINE`, `VALUE_PROPOSITION`, `PRIMARY_CTA`, `TRUST_COPY`, `FEATURE_COPY`, `MICROCOPY`.
- `issueType`: `LITERAL_TRANSLATION`, `CULTURAL_TONE`, `VALUE_PROP_CLARITY`, `CTA_MARKET_FIT`, `TRUST_SIGNAL`, `TERMINOLOGY`, `VISUAL_FIT`.
- `severity`: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.
- `componentRef.kind`: `CSS_SELECTOR`, `ACCESSIBILITY_NAME`, `TEXT_ANCHOR`, `SEMANTIC_LABEL`. Geometry is intentionally absent from v1.

String caps: copy fields 500 characters each; rationale/business impact 800 each; executive summary 1,500; title 120. Confidence is `[0,1]` and is not presented as statistical calibration.

## Deterministic publication gates

`submit_report` accepts only when:

1. Audit/run identity and version fields match the claimed job.
2. Free/paid page and finding caps are exact.
3. Every page, artifact, Linkup `packId`/`evidenceId`, and gbrain record resolves to the audit's persisted inputs. Display URLs are derived from the referenced persisted evidence items.
4. Every finding includes a required screenshot artifact and nonempty component reference.
5. `currentTargetCopy` and `proposedTargetCopy` pass target-language identification; empty/identical proposals fail.
6. Enums, sizes, ordering, unique finding IDs, unique ranks, and URL safety pass.
7. `checks` are present and true. These booleans are Hermes assertions; the validator does not pretend to replace semantic QA.
8. The idempotency key has no conflicting accepted payload. Same key + same hash returns the original result; same key + different hash returns `IDEMPOTENCY_CONFLICT`.

The report stores recommendations, not automatic website changes. The UI displays limitations and evidence degradation prominently.
