import assert from "node:assert/strict";
import test from "node:test";
import { validatePaidReport, type ArtifactRef, type PagePair, type PaidAudit, type PaidReport } from "../../packages/contracts/src/index.ts";

const paid: PaidAudit = { auditId: "paid_1", kind: "PAID", parentAuditId: "free_1", paymentId: "pay_1", status: "PAID_RUNNING", input: { homepageUrl: "https://acme.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Demos" }, limits: { maxAdditionalPairs: 2, maxRenderedPages: 4, maxFindings: 6, maxChildren: 3, maxDepth: 1 }, selectedPairIds: ["pair_1"], hermesRunId: "run_1", revision: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
const pair: PagePair = { pairId: "pair_1", auditId: "paid_1", role: "PRICING", sourceUrl: "https://acme.com/ko/pricing", targetUrl: "https://acme.com/en/pricing", sourceLocale: "ko-KR", targetLocale: "en-US", pairingMethod: "HREFLANG", pairingEvidence: "hreflang", discoveryScore: 100 };
const screenshot: ArtifactRef = { artifactId: "shot_1", auditId: "paid_1", pairId: "pair_1", side: "TARGET", kind: "SCREENSHOT", r2Key: "audits/paid_1/shot.png", mimeType: "image/png", sha256: "abc", sizeBytes: 10, sourceUrl: pair.targetUrl, finalUrl: pair.targetUrl, capturedAt: "2026-01-01T00:00:00Z" };
const report: PaidReport = { schemaVersion: "1.0", jobType: "PAID", reportId: "report_1", auditId: "paid_1", parentAuditId: "free_1", title: "Audit", executiveSummary: "Summary", auditedPairIds: ["pair_1"], findings: [{ findingId: "finding_1", rank: 1, pairId: "pair_1", targetUrl: pair.targetUrl, screenshotArtifactId: "shot_1", componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "HIGH", componentRef: { kind: "TEXT_ANCHOR", value: "Start" }, sourceCopy: "시작", currentTargetCopy: "Start", proposedTargetCopy: "See pricing", businessImpact: "Clarifies intent", rationale: "Matches evaluation stage", confidence: 0.9, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["kb_1"] }], limitations: [], liveMarketEvidence: "AVAILABLE", generation: { hermesRunId: "run_1", contractVersion: "1.0", promptVersion: "v1", skillVersion: "v1", kbVersion: "v1" }, generatedAt: "2026-01-01T00:00:00Z" };

test("PCON-01/PREPORT-01 validates a fully resolved screenshot-grounded paid report", () => {
  assert.deepEqual(validatePaidReport(report, paid, new Map([[pair.pairId, pair]]), new Map([[screenshot.artifactId, screenshot]]), new Set(["linkup:market_1"]), new Set(["kb_1"])), { ok: true });
});

test("PREPORT-01 rejects unknown screenshot, duplicate ranks, unchanged copy, and conflicting run", () => {
  const invalid = structuredClone(report);
  invalid.findings.push({ ...structuredClone(invalid.findings[0]), findingId: "finding_2", screenshotArtifactId: "missing", proposedTargetCopy: "Start" });
  invalid.generation.hermesRunId = "other";
  const result = validatePaidReport(invalid, paid, new Map([[pair.pairId, pair]]), new Map([[screenshot.artifactId, screenshot]]), new Set(["linkup:market_1"]), new Set(["kb_1"]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(new Set(result.errors.map((error) => error.code)), new Set(["DUPLICATE_OR_INVALID_RANK", "UNKNOWN_REFERENCE", "INVALID_COPY", "RUN_MISMATCH"]));
});

test("PREPORT-01 malformed model findings produce typed errors, never validator exceptions", () => {
  const malformed = structuredClone(report);
  malformed.findings = [
    // Entirely missing fields.
    {} as never,
    // Wrong types everywhere.
    { findingId: 7, rank: "1", pairId: 42, targetUrl: null, screenshotArtifactId: {}, componentRef: "hero", sourceCopy: null, currentTargetCopy: 3, proposedTargetCopy: 3, businessImpact: undefined, rationale: [], confidence: "high", evidenceRefs: "market_1", kbRefs: "kb" } as never,
    // Confidence missing entirely must not slip through numeric comparisons.
    { findingId: "f3", rank: 3, pairId: "pair_1", targetUrl: pair.targetUrl, screenshotArtifactId: "shot_1", componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "HIGH", componentRef: { kind: "TEXT_ANCHOR", value: "hero" }, sourceCopy: "소스", currentTargetCopy: "Current", proposedTargetCopy: "Proposed", businessImpact: "Impact", rationale: "Reason", evidenceRefs: [], kbRefs: ["kb_1"] } as never,
  ];
  const validation = validatePaidReport(malformed, paid, new Map([[pair.pairId, pair]]), new Map([[screenshot.artifactId, screenshot]]), new Set(["linkup:market_1"]), new Set(["kb_1"]));
  assert.equal(validation.ok, false);
  if (!validation.ok) {
    assert.ok(validation.errors.some((error) => error.path === "findings[0].findingId" && error.code === "DUPLICATE_OR_MISSING_ID"));
    assert.ok(validation.errors.some((error) => error.path === "findings[1].componentRef" && error.code === "INVALID_COMPONENT_REF"));
    assert.ok(validation.errors.some((error) => error.path === "findings[2]" && error.code === "INVALID_ANALYSIS"), "missing confidence must be invalid");
  }
});
