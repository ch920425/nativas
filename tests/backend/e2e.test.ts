import assert from "node:assert/strict";
import test from "node:test";
import { loadCorpus, retrieve } from "../../apps/kb-mcp/src/retrieval.mjs";
import { searchLinkupOnce } from "../../apps/runtime/src/adapters.ts";
import { HermesRelay } from "../../apps/runtime/src/hermes.ts";
import { processDodoWebhook } from "../../apps/runtime/src/payment.ts";
import { MemoryAuditStore } from "../../apps/runtime/src/store.ts";
import { capturePublicPage } from "../../workers/capture/src/index.ts";

test("free audit through duplicate payment starts exactly one context-linked paid run", async () => {
  const store = new MemoryAuditStore();
  const free = store.createFree("aud_rehearsal_free", "https://example.com/ko", "KR_TO_US");
  store.transition(free.publicId, "ELIGIBILITY_CHECK");

  const started: Array<{ sessionId: string; runId: string }> = [];
  const hermes = new HermesRelay(store, {
    createRun: async (request) => {
      const sessionId = (request as { session_id: string }).session_id;
      const runId = `run_${sessionId}`;
      started.push({ sessionId, runId });
      return { run_id: runId };
    },
    getRun: async () => ({ status: "running" })
  });
  await hermes.start(free.publicId, "attempt_free", { jobType: "FREE", parentCapability: "redacted-at-boundary" });

  const capture = await capturePublicPage(free.homepageUrl, {
    resolve: async () => ["203.0.113.10"],
    preflight: async (url) => ({ finalUrl: url, redirects: [], contentLength: 4000 }),
    snapshot: async (url, formats) => ({ sourceUrl: url, artifacts: formats.map((kind) => ({ kind, bytes: 1000 })) })
  });
  assert.deepEqual(capture.artifacts.map((artifact) => artifact.kind), ["SCREENSHOT", "HTML", "MARKDOWN", "ACCESSIBILITY_TREE"]);

  const corpus = await loadCorpus();
  const kb = retrieve(corpus, { direction: free.direction, componentType: "PRIMARY_CTA", query: "trust reversible CTA", limit: 3 });
  assert.equal(kb.mode, "KEYWORD_DETERMINISTIC");
  assert.equal(kb.results[0].id, "DEMO_SEED_KR_US_CTA");

  const market = await searchLinkupOnce({ search: async () => ({ sources: [{ id: "market-1", url: "https://example.org/source", title: "Public market source" }] }) }, "US B2B homepage CTA evidence");
  assert.equal(market.status, "AVAILABLE");

  const findings = ["HERO_HEADLINE", "PRIMARY_CTA", "TRUST_COPY"].map((componentType, index) => ({
    id: `finding-${index + 1}`,
    title: `${componentType} localization issue`,
    componentType: componentType as "HERO_HEADLINE" | "PRIMARY_CTA" | "TRUST_COPY",
    sourceCopy: `Current copy ${index + 1}`,
    recommendation: `Recommended market-native copy ${index + 1}`,
    rationale: "Grounded in the captured page, bounded market evidence, and reviewed localization precedent.",
    artifactId: "artifact-screenshot-target",
    evidenceRefs: [{ packId: "market-pack", evidenceId: "market-1" }],
    goldenRecordIds: [kb.results[index % kb.results.length].id]
  }));
  const report = store.publish({ schemaVersion: "1.0", auditId: free.publicId, generatedAt: "2026-07-10T00:00:00Z", findings }, `report:${free.publicId}:v1`, {
    artifacts: new Set(["artifact-screenshot-target"]),
    evidence: new Set(["market-pack:market-1"]),
    golden: new Set(kb.results.map((record) => record.id))
  });
  assert.equal(report.findings.length, 3);
  assert.equal(store.require(free.publicId).status, "FREE_REPORT");

  const webhookHeaders = { "webhook-id": "delivery-rehearsal", "webhook-signature": "verified-fixture-signature", "webhook-timestamp": "2026-07-10T00:01:00Z" };
  const dodo = { unwrap: () => ({ id: "payment-event", type: "payment.succeeded", data: { metadata: { auditId: free.publicId } } }) };
  const paid = processDodoWebhook(store, dodo, "canonical-raw-body", webhookHeaders);
  const duplicate = processDodoWebhook(store, dodo, "canonical-raw-body", webhookHeaders);
  assert.equal(duplicate.publicId, paid.publicId);
  assert.equal(paid.parentAuditId, free.publicId);
  assert.equal(paid.limits.maxPagePairs, 2);

  await hermes.start(paid.publicId, "attempt_paid", { jobType: "PAID", priorContext: { parentAuditId: free.publicId, priorHermesRunId: free.hermesRunId, priorReportId: report.reportId }, limits: { maxPagePairs: 2 } });
  assert.equal(store.require(paid.publicId).status, "PAID_RUNNING");
  assert.equal(started.length, 2);
  assert.deepEqual(started.map((run) => run.sessionId), [free.publicId, paid.publicId]);
  assert.equal([...store.audits.values()].filter((audit) => audit.kind === "PAID").length, 1);
});
