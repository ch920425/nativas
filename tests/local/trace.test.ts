import assert from "node:assert/strict";
import test from "node:test";
import { LocalAuditService } from "../../apps/local-server/src/service.ts";
import type { ArtifactRef, PagePair, PaidAudit } from "../../packages/contracts/src/index.ts";

const freeOutput = JSON.stringify({
  title: "Audit", executiveSummary: "Summary",
  findings: [1, 2, 3].map((index) => ({
    componentType: index === 1 ? "HERO_HEADLINE" : index === 2 ? "PRIMARY_CTA" : "TRUST_COPY",
    issueType: index === 2 ? "CTA_MARKET_FIT" : index === 3 ? "TRUST_SIGNAL" : "VALUE_PROP_CLARITY",
    severity: "HIGH", componentRef: { kind: "TEXT_ANCHOR", value: `component ${index}` },
    sourceCopy: `소스 ${index}`, currentTargetCopy: `Current ${index}`, proposedTargetCopy: `Proposed ${index}`,
    businessImpact: "Impact", rationale: "Reason", confidence: 0.9,
    evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }],
    kbRefs: [index === 1 ? "DEMO_SEED_KR_US_HERO" : index === 2 ? "DEMO_SEED_KR_US_CTA" : "DEMO_SEED_KR_US_TRUST"],
  })),
});

const paidOutput = JSON.stringify({
  title: "Paid audit", executiveSummary: "One screenshot-grounded paid finding.", auditedPairIds: ["pair_pricing"], limitations: [],
  findings: [{ findingId: "paid_finding_1", rank: 1, pairId: "pair_pricing", targetUrl: "https://example.com/en/pricing", screenshotArtifactId: "pair_pricing_TARGET_SCREENSHOT", componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "HIGH", componentRef: { kind: "TEXT_ANCHOR", value: "Start" }, sourceCopy: "시작", currentTargetCopy: "Start", proposedTargetCopy: "See pricing", businessImpact: "Clarifies evaluation intent", rationale: "Grounded in the target screenshot.", confidence: 0.9, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["DEMO_SEED_KR_US_CTA"] }],
});

const golden = [
  { id: "DEMO_SEED_KR_US_HERO", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Why" },
  { id: "DEMO_SEED_KR_US_CTA", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Why" },
  { id: "DEMO_SEED_KR_US_TRUST", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Why" },
];
const market = [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }];

function pair(audit: PaidAudit): PagePair {
  return { pairId: "pair_pricing", auditId: audit.auditId, role: "PRICING", sourceUrl: "https://example.com/ko/pricing", targetUrl: "https://example.com/en/pricing", sourceLocale: "ko-KR", targetLocale: "en-US", pairingMethod: "HREFLANG", pairingEvidence: "hreflang", discoveryScore: 100 };
}
function artifacts(audit: PaidAudit, selected: PagePair): ArtifactRef[] {
  return (["SOURCE", "TARGET"] as const).flatMap((side) => (["SCREENSHOT", "HTML", "MARKDOWN", "ACCESSIBILITY_TREE"] as const).map((kind) => ({ artifactId: `${selected.pairId}_${side}_${kind}`, auditId: audit.auditId, pairId: selected.pairId, side, kind, r2Key: `audits/${audit.auditId}/${side}/${kind}`, mimeType: kind === "SCREENSHOT" ? "image/png" : "text/plain", sha256: `${side}-${kind}`, sizeBytes: 10, sourceUrl: selected.sourceUrl, finalUrl: side === "SOURCE" ? selected.sourceUrl : selected.targetUrl, capturedAt: new Date().toISOString() })));
}

function makeService() {
  let runs = 0;
  return new LocalAuditService({
    statePath: null,
    capture: async () => ({ sourceUrl: "https://example.com/ko", targetUrl: "https://example.com/en", paired: true, source: { headline: "Source", supportingCopy: "Body", cta: "Go", text: "source" }, target: { headline: "Target", supportingCopy: "Body", cta: "Go", text: "target" } }),
    searchMarket: async () => market,
    retrieveGolden: async () => golden,
    hermes: {
      async createRun() { runs += 1; return { run_id: `run_${runs}` }; },
      async waitForRun(id) { return { status: "completed", output: id === "run_1" ? freeOutput : paidOutput, usage: { input_tokens: 1200, output_tokens: 800, total_tokens: 2000 } }; },
      async stopRun() {},
    },
    checkout: { async create() { return { checkoutUrl: "https://checkout.test", paymentId: "session_1" }; }, async findSucceededPayment() { return null; } },
    paid: { async discover(audit) { return [pair(audit)]; }, async capture(audit, pairs) { return artifacts(audit, pairs[0]); }, async searchMarket() { return market; }, async retrieveGolden() { return golden; } },
    id: (() => { let n = 0; return (prefix: string) => `${prefix}_${++n}`; })(),
  });
}

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("timed out");
}

test("POBS-01 free and paid runs emit a correlated, privacy-safe trace ending in the report", async () => {
  const service = makeService();
  const audit = await service.submit({ homepageUrl: "https://example.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Increase demos" });
  await waitFor(async () => service.get(audit.auditId), (view) => view?.status === "FREE_REPORT");

  const freeTrace = (await service.getTrace(audit.auditId))!;
  const freeNames = freeTrace.map((span) => span.name);
  for (const expected of ["FREE_AUDIT", "capture_public_homepage", "linkup_search", "nativas_kb", "free_manager_run", "free_report_published"]) assert.ok(freeNames.includes(expected), `missing ${expected} span`);
  const freeRun = freeTrace.find((span) => span.name === "free_manager_run")!;
  assert.equal(freeRun.outcome, "SUCCEEDED");
  assert.equal(freeRun.correlation.hermesRunId, "run_1");
  assert.deepEqual(freeRun.usage, { inputTokens: 1200, outputTokens: 800, totalTokens: 2000 });
  assert.ok(typeof freeRun.durationMs === "number" && freeRun.durationMs >= 0);
  const published = freeTrace.find((span) => span.name === "free_report_published")!;
  assert.ok(published.correlation.reportId, "report correlation missing");

  await service.createCheckout(audit.auditId);
  const confirmed = await service.confirmPayment(audit.auditId, "pay_1");
  await waitFor(async () => service.get(confirmed.paidAuditId!), (view) => view?.status === "PAID_REPORT");

  const paidTrace = (await service.getTrace(confirmed.paidAuditId!))!;
  const payment = paidTrace.find((span) => span.kind === "PAYMENT")!;
  assert.equal(payment.correlation.paymentId, "pay_1");
  assert.equal(payment.correlation.parentAuditId, audit.auditId);
  for (const stage of ["PAID_DISCOVERING", "PAID_CAPTURING", "PAID_RUNNING"]) assert.ok(paidTrace.some((span) => span.kind === "STAGE" && span.name === stage && span.outcome === "SUCCEEDED"), `missing ${stage} stage span`);
  const paidRun = paidTrace.find((span) => span.name === "paid_manager_run")!;
  assert.equal(paidRun.outcome, "SUCCEEDED");
  assert.equal(paidRun.correlation.hermesRunId, "run_2");
  assert.equal(paidRun.correlation.paymentId, "pay_1");
  assert.deepEqual(paidRun.usage, { inputTokens: 1200, outputTokens: 800, totalTokens: 2000 });
  const paidReport = paidTrace.find((span) => span.name === "paid_report_published")!;
  assert.equal(paidReport.correlation.captureId, `capture:${confirmed.paidAuditId}:v1`);
  assert.ok(paidReport.correlation.reportId, "paid report correlation missing");
  const serialized = JSON.stringify(paidTrace);
  for (const forbidden of ["proposedTargetCopy", "sourceCopy", "Bearer", "secret"]) assert.ok(!serialized.includes(forbidden), `${forbidden} must not appear in trace output`);

  assert.equal(await service.getTrace("aud_unknown"), null);
});

test("POBS-01 a failing paid stage records a typed failure span", async () => {
  const service = new LocalAuditService({
    statePath: null,
    capture: async () => ({ sourceUrl: "https://example.com/ko", targetUrl: "https://example.com/en", paired: true, source: { headline: "S", supportingCopy: "B", cta: "Go", text: "s" }, target: { headline: "T", supportingCopy: "B", cta: "Go", text: "t" } }),
    searchMarket: async () => market,
    retrieveGolden: async () => golden,
    hermes: { async createRun() { return { run_id: "run_1" }; }, async waitForRun() { return { status: "completed", output: freeOutput }; }, async stopRun() {} },
    checkout: { async create() { return { checkoutUrl: "https://checkout.test", paymentId: "session_1" }; }, async findSucceededPayment() { return null; } },
    paid: { async discover() { return []; }, async capture() { return []; }, async searchMarket() { return market; }, async retrieveGolden() { return golden; } },
    id: (() => { let n = 0; return (prefix: string) => `${prefix}_${++n}`; })(),
  });
  const audit = await service.submit({ homepageUrl: "https://example.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Demos" });
  await waitFor(async () => service.get(audit.auditId), (view) => view?.status === "FREE_REPORT");
  await service.createCheckout(audit.auditId);
  const confirmed = await service.confirmPayment(audit.auditId, "pay_1");
  await waitFor(async () => service.get(confirmed.paidAuditId!), (view) => view?.status === "FAILED");
  const trace = (await service.getTrace(confirmed.paidAuditId!))!;
  const failed = trace.find((span) => span.outcome === "FAILED")!;
  assert.equal(failed.errorCode, "LOCALE_NOT_FOUND");
});
