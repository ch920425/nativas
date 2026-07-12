import assert from "node:assert/strict";
import test from "node:test";
import { LocalAuditService, parseFindings } from "../../apps/local-server/src/service.ts";
import { retrieveGoldenReferences } from "../../apps/local-server/src/dependencies.ts";
import type { ArtifactRef, PagePair, PaidAudit } from "../../packages/contracts/src/index.ts";

const reportOutput = JSON.stringify({
  title: "A clearer US-market homepage",
  executiveSummary: "Three bounded changes improve clarity, CTA fit, and trust without expanding the source claims.",
  findings: [
    {
      componentType: "HERO_HEADLINE", issueType: "VALUE_PROP_CLARITY", severity: "HIGH",
      componentRef: { kind: "TEXT_ANCHOR", value: "hero headline" }, sourceCopy: "팀의 모든 일이 한 곳에서",
      currentTargetCopy: "All your work in one place", proposedTargetCopy: "Move every team's work forward in one place.",
      businessImpact: "Makes the outcome legible before the category claim.", rationale: "The recommendation preserves the source promise and clarifies the result.",
      confidence: 0.9, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["DEMO_SEED_KR_US_HERO"]
    },
    {
      componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "HIGH",
      componentRef: { kind: "TEXT_ANCHOR", value: "primary CTA" }, sourceCopy: "무료로 시작하기",
      currentTargetCopy: "Start free", proposedTargetCopy: "See how it works",
      businessImpact: "Reduces commitment before an unfamiliar buyer understands the value.", rationale: "The CTA aligns with an evaluation-stage visitor.",
      confidence: 0.86, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["DEMO_SEED_KR_US_CTA"]
    },
    {
      componentType: "TRUST_COPY", issueType: "TRUST_SIGNAL", severity: "MEDIUM",
      componentRef: { kind: "TEXT_ANCHOR", value: "trust strip" }, sourceCopy: "10,000개 팀",
      currentTargetCopy: "10,000 teams", proposedTargetCopy: "Trusted by 10,000+ teams",
      businessImpact: "Makes the proof recognizable at the conversion point.", rationale: "The language preserves the supplied quantity and adds no new claim.",
      confidence: 0.82, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["DEMO_SEED_KR_US_TRUST"]
    }
  ]
});

const paidOutput = JSON.stringify({
  title: "Paid audit", executiveSummary: "One screenshot-grounded paid finding.", auditedPairIds: ["pair_pricing"], limitations: [],
  findings: [{ findingId: "paid_finding_1", rank: 1, pairId: "pair_pricing", targetUrl: "https://example.com/en/pricing", screenshotArtifactId: "pair_pricing_TARGET_SCREENSHOT", componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "HIGH", componentRef: { kind: "TEXT_ANCHOR", value: "Start" }, sourceCopy: "시작", currentTargetCopy: "Start", proposedTargetCopy: "See pricing", businessImpact: "Clarifies evaluation intent", rationale: "The screenshot and evidence show an evaluation-stage surface.", confidence: 0.9, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["DEMO_SEED_KR_US_CTA"] }],
});

function paidPair(audit: PaidAudit): PagePair { return { pairId: "pair_pricing", auditId: audit.auditId, role: "PRICING", sourceUrl: "https://example.com/ko/pricing", targetUrl: "https://example.com/en/pricing", sourceLocale: "ko-KR", targetLocale: "en-US", pairingMethod: "HREFLANG", pairingEvidence: "hreflang", discoveryScore: 100 }; }
function paidArtifacts(audit: PaidAudit, pair: PagePair): ArtifactRef[] {
  return (["SOURCE", "TARGET"] as const).flatMap((side) => (["SCREENSHOT", "HTML", "MARKDOWN", "ACCESSIBILITY_TREE"] as const).map((kind) => ({ artifactId: `${pair.pairId}_${side}_${kind}`, auditId: audit.auditId, pairId: pair.pairId, side, kind, r2Key: `audits/${audit.auditId}/${side}/${kind}`, mimeType: kind === "SCREENSHOT" ? "image/png" : "text/plain", sha256: `${side}-${kind}`, sizeBytes: 10, sourceUrl: side === "SOURCE" ? pair.sourceUrl : pair.targetUrl, finalUrl: side === "SOURCE" ? pair.sourceUrl : pair.targetUrl, capturedAt: new Date().toISOString() })));
}

test("the real golden corpus yields all three required reference classes in both directions", async () => {
  for (const direction of ["KR_TO_US", "US_TO_KR"] as const) {
    const references = await retrieveGoldenReferences({
      homepageUrl: "https://example.com",
      direction,
      audience: direction === "KR_TO_US" ? "US business buyers" : "Korean business buyers",
      launchGoal: "Increase qualified sign-ups",
    });
    assert.equal(references.length, 3);
    assert.equal(new Set(references.map((reference) => reference.id)).size, 3);
    assert.ok(references.some((reference) => ["HERO_HEADLINE", "VALUE_PROPOSITION"].includes(reference.componentType)));
    assert.ok(references.some((reference) => reference.componentType === "PRIMARY_CTA"));
    assert.ok(references.some((reference) => reference.componentType === "TRUST_COPY"));
  }
});

test("mechanical Hermes aliases normalize without accepting invented references", () => {
  const variant = JSON.stringify({
    title: "Audit",
    executiveSummary: "Summary",
    findings: [
      { componentType: "HEADLINE", issueType: "localization_quality", severity: "medium", componentRef: { kind: "headline", value: "Hero" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.9, evidenceRefs: ["capture.source.headline", "market_1"], kbRefs: ["gold_1"] },
      { componentType: "VALUE_PROPOSITION", issueType: "message_drift", severity: "high", componentRef: { kind: "subheadline", value: "Value" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.8, evidenceRefs: ["market_1"], kbRefs: ["gold_1"] },
      { componentType: "PRIMARY_CTA", issueType: "conversion_friction", severity: "medium", componentRef: { kind: "cta", value: "CTA" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.7, evidenceRefs: ["market_1"], kbRefs: ["gold_1"] },
    ],
  });
  const parsed = parseFindings(
    variant,
    [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }],
    [{ id: "gold_1", componentType: "VALUE_PROPOSITION", precedent: "Pattern", rationale: "Reason" }],
  );
  assert.deepEqual(parsed.findings.map((finding) => finding.componentType), ["HERO_HEADLINE", "VALUE_PROPOSITION", "PRIMARY_CTA"]);
  assert.deepEqual(parsed.findings.map((finding) => finding.issueType), ["LITERAL_TRANSLATION", "CULTURAL_TONE", "CTA_MARKET_FIT"]);
  assert.ok(parsed.findings.every((finding) => finding.componentRef.kind === "TEXT_ANCHOR"));
  assert.ok(parsed.findings.every((finding) => finding.evidenceRefs.length === 1 && finding.evidenceRefs[0].evidenceId === "market_1"));
});

test("unsupported report enums still fail closed after mechanical normalization", () => {
  const invalid = JSON.stringify({
    title: "Audit",
    executiveSummary: "Summary",
    findings: Array.from({ length: 3 }, () => ({ componentType: "UNKNOWN_COMPONENT", issueType: "UNKNOWN_ISSUE", severity: "medium", componentRef: { kind: "unknown", value: "copy" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.9, evidenceRefs: ["market_1"], kbRefs: ["gold_1"] })),
  });
  assert.throws(
    () => parseFindings(invalid, [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }], [{ id: "gold_1", componentType: "VALUE_PROPOSITION", precedent: "Pattern", rationale: "Reason" }]),
    /REPORT_INVALID/,
  );
});

test("a missing KB citation is repaired only with a component-matched golden reference", () => {
  const variant = JSON.stringify({
    title: "Audit",
    executiveSummary: "Summary",
    findings: [
      { componentType: "HERO_HEADLINE", issueType: "CULTURAL_TONE", severity: "high", componentRef: { kind: "TEXT_ANCHOR", value: "Hero" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.9, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["hero_gold"] },
      { componentType: "VALUE_PROPOSITION", issueType: "VALUE_PROP_CLARITY", severity: "medium", componentRef: { kind: "TEXT_ANCHOR", value: "Value" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.8, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: [] },
      { componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "medium", componentRef: { kind: "TEXT_ANCHOR", value: "CTA" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.7, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["cta_gold"] },
    ],
  });
  const parsed = parseFindings(
    variant,
    [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }],
    [
      { id: "hero_gold", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Reason" },
      { id: "value_gold", componentType: "VALUE_PROPOSITION", precedent: "Pattern", rationale: "Reason" },
      { id: "cta_gold", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Reason" },
    ],
  );
  assert.deepEqual(parsed.findings[1].kbRefs, ["value_gold"]);
});

test("feature copy may reuse only the reviewed value-proposition precedent family", () => {
  const variant = JSON.stringify({
    title: "Audit",
    executiveSummary: "Summary",
    findings: [
      { componentType: "HERO_HEADLINE", issueType: "CULTURAL_TONE", severity: "high", componentRef: { kind: "TEXT_ANCHOR", value: "Hero" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.9, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["hero_gold"] },
      { componentType: "FEATURE_COPY", issueType: "VISUAL_FIT", severity: "medium", componentRef: { kind: "TEXT_ANCHOR", value: "Feature" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.8, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: [] },
      { componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "medium", componentRef: { kind: "TEXT_ANCHOR", value: "CTA" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.7, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["cta_gold"] },
    ],
  });
  const parsed = parseFindings(
    variant,
    [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }],
    [
      { id: "hero_gold", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Reason" },
      { id: "value_gold", componentType: "VALUE_PROPOSITION", precedent: "Pattern", rationale: "Reason" },
      { id: "cta_gold", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Reason" },
    ],
  );
  assert.deepEqual(parsed.findings[1].kbRefs, ["value_gold"]);
});

test("feature copy falls back to the reviewed hero precedent when no value-proposition precedent exists", () => {
  const variant = JSON.stringify({
    title: "Audit",
    executiveSummary: "Summary",
    findings: [
      { componentType: "HERO_HEADLINE", issueType: "CULTURAL_TONE", severity: "high", componentRef: { kind: "TEXT_ANCHOR", value: "Hero" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.9, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["hero_gold"] },
      { componentType: "FEATURE_COPY", issueType: "TERMINOLOGY", severity: "medium", componentRef: { kind: "TEXT_ANCHOR", value: "Feature" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.8, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: [] },
      { componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "medium", componentRef: { kind: "TEXT_ANCHOR", value: "CTA" }, sourceCopy: "A", currentTargetCopy: "B", proposedTargetCopy: "C", businessImpact: "Impact", rationale: "Reason", confidence: 0.7, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["cta_gold"] },
    ],
  });
  const parsed = parseFindings(
    variant,
    [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }],
    [
      { id: "hero_gold", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Reason" },
      { id: "cta_gold", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Reason" },
      { id: "trust_gold", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Reason" },
    ],
  );
  assert.deepEqual(parsed.findings[1].kbRefs, ["hero_gold"]);
});

test("real local workflow persists capture, Linkup, KB, Hermes events, and exactly three findings", async () => {
  const service = new LocalAuditService({
    statePath: null,
    capture: async () => ({
      sourceUrl: "https://example.com/ko", targetUrl: "https://example.com/en", paired: true,
      source: { headline: "팀의 모든 일이 한 곳에서", supportingCopy: "더 빠르게 협업하세요", cta: "무료로 시작하기", text: "source" },
      target: { headline: "All your work in one place", supportingCopy: "Work faster", cta: "Start free", text: "target" },
    }),
    searchMarket: async () => [{ id: "market_1", url: "https://example.org/source", title: "US SaaS homepage evidence", content: "Evaluation-stage buyers need clear outcomes." }],
    retrieveGolden: async () => [
      { id: "DEMO_SEED_KR_US_HERO", componentType: "HERO_HEADLINE", precedent: "Outcome before category", rationale: "Reviewed pattern" },
      { id: "DEMO_SEED_KR_US_CTA", componentType: "PRIMARY_CTA", precedent: "Low commitment CTA", rationale: "Reviewed pattern" },
      { id: "DEMO_SEED_KR_US_TRUST", componentType: "TRUST_COPY", precedent: "Contextual proof", rationale: "Reviewed pattern" },
    ],
    hermes: {
      async createRun() { return { run_id: "run_real_1" }; },
      async waitForRun(_runId, onEvent) {
        onEvent({ event: "tool.started", tool_name: "delegate_task" });
        onEvent({ event: "tool.completed", tool_name: "delegate_task" });
        return { status: "completed", output: reportOutput, usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 } };
      },
      async stopRun() {},
    },
    id: (() => { let n = 0; return (prefix) => `${prefix}_${++n}`; })(),
  });

  const submitted = await service.submit({ homepageUrl: "https://example.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Increase demos" });
  assert.equal(submitted.status, "SUBMITTED");

  const completed = await waitFor(async () => service.get(submitted.auditId), (view) => view?.status === "FREE_REPORT");
  assert.equal(completed?.hermesRunId, "run_real_1");
  assert.equal(completed?.report?.findings.length, 3);
  assert.equal(completed?.report?.visualEvidence.mode, "HTML_TEXT_SNAPSHOT");
  assert.ok(completed?.events.some((event) => event.toolName === "delegate_task" && event.status === "SUCCEEDED"));
  assert.deepEqual(completed?.usage, { inputTokens: 100, outputTokens: 50, totalTokens: 150 });
});

test("Dodo checkout is idempotent and does not start paid work before webhook confirmation", async () => {
  let run = 0;
  const service = new LocalAuditService({
    statePath: null,
    capture: async () => ({ sourceUrl: "https://example.com", targetUrl: "https://example.com", paired: false, source: { headline: "Source", supportingCopy: "Body", cta: "Go", text: "source" }, target: { headline: "Target", supportingCopy: "Body", cta: "Go", text: "target" } }),
    searchMarket: async () => [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }],
    retrieveGolden: async () => [{ id: "DEMO_SEED_KR_US_HERO", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Why" }, { id: "DEMO_SEED_KR_US_CTA", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Why" }, { id: "DEMO_SEED_KR_US_TRUST", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Why" }],
    hermes: {
      async createRun() { run += 1; return { run_id: `run_${run}` }; },
      async waitForRun(id, onEvent) { onEvent({ event: "run.completed" }); return { status: "completed", output: id === "run_1" ? reportOutput : paidOutput, usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }; },
      async stopRun() {},
    },
    paid: {
      async discover(audit) { return [paidPair(audit)]; },
      async capture(audit, pairs) { return paidArtifacts(audit, pairs[0]); },
      async searchMarket() { return [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }]; },
      async retrieveGolden() { return [{ id: "DEMO_SEED_KR_US_HERO", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Why" }, { id: "DEMO_SEED_KR_US_CTA", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Why" }, { id: "DEMO_SEED_KR_US_TRUST", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Why" }]; },
    },
    checkout: { async create() { return { checkoutUrl: "https://test.checkout.dodopayments.com/session/test", paymentId: "pay_dodo_1" }; }, async findSucceededPayment() { return null; } },
    id: (() => { let n = 0; return (prefix) => `${prefix}_${++n}`; })(),
  });
  const audit = await service.submit({ homepageUrl: "https://example.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Increase demos" });
  await waitFor(async () => service.get(audit.auditId), (view) => view?.status === "FREE_REPORT");

  const first = await service.createCheckout(audit.auditId);
  const second = await service.createCheckout(audit.auditId);
  assert.equal(first.paymentId, second.paymentId);
  const pending = await service.get(audit.auditId);
  assert.equal(pending?.payment?.status, "PENDING_CONFIRMATION");
  assert.equal(pending?.paidAuditId, undefined);
  assert.equal(run, 1);

  const confirmed = await service.confirmPayment(audit.auditId, first.paymentId);
  assert.equal(confirmed.payment?.status, "SUCCEEDED");
  assert.ok(confirmed.paidAuditId);
  const paid = await waitFor(async () => service.get(confirmed.paidAuditId!), (view) => view?.status === "PAID_REPORT");
  assert.equal(paid?.paidReport?.findings.length, 1);
  assert.equal((await service.getPaidReport(confirmed.paidAuditId!))?.jobType, "PAID");
  assert.equal(run, 2);
});

test("PPAY-02/PSTATE-01 duplicate confirmation creates one child and one paid Hermes run", async () => {
  let runs = 0;
  const service = paidService(() => ++runs);
  const audit = await service.submit({ homepageUrl: "https://example.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Increase demos" });
  await waitFor(async () => service.get(audit.auditId), (view) => view?.status === "FREE_REPORT");
  await service.createCheckout(audit.auditId);
  const [first, second] = await Promise.all([service.confirmPayment(audit.auditId, "pay_1"), service.confirmPayment(audit.auditId, "pay_1")]);
  assert.equal(first.paidAuditId, second.paidAuditId);
  await waitFor(async () => service.get(first.paidAuditId!), (view) => view?.status === "PAID_REPORT");
  assert.equal(runs, 2, "one free and one paid run");
});

test("PPAY-02 conflicting payment replay fails and artifact ownership is audit-scoped", async () => {
  let runs = 0; const service = paidService(() => ++runs);
  const audit = await service.submit({ homepageUrl: "https://example.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Increase demos" });
  await waitFor(async () => service.get(audit.auditId), (view) => view?.status === "FREE_REPORT");
  await service.createCheckout(audit.auditId);
  const confirmed = await service.confirmPayment(audit.auditId, "pay_1");
  await assert.rejects(service.confirmPayment(audit.auditId, "pay_other"), /STATE_CONFLICT/);
  await waitFor(async () => service.get(confirmed.paidAuditId!), (view) => view?.status === "PAID_REPORT");
  assert.equal((await service.getArtifact(confirmed.paidAuditId!, "pair_pricing_TARGET_SCREENSHOT"))?.kind, "SCREENSHOT");
  assert.equal(await service.getArtifact("another_audit", "pair_pricing_TARGET_SCREENSHOT"), null);
});

test("PPAY-02 webhook identity replay accepts identical bytes and rejects a different body", async () => {
  let runs = 0; const service = paidService(() => ++runs);
  const audit = await service.submit({ homepageUrl: "https://example.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Increase demos" });
  await waitFor(async () => service.get(audit.auditId), (view) => view?.status === "FREE_REPORT");
  await service.createCheckout(audit.auditId);
  const first = await service.acceptPaymentEvent({ auditId: audit.auditId, paymentId: "pay_1", eventId: "evt_1", payloadHash: "hash_1" });
  const replay = await service.acceptPaymentEvent({ auditId: audit.auditId, paymentId: "pay_1", eventId: "evt_1", payloadHash: "hash_1" });
  assert.equal(first.paidAuditId, replay.paidAuditId);
  await assert.rejects(service.acceptPaymentEvent({ auditId: audit.auditId, paymentId: "pay_1", eventId: "evt_1", payloadHash: "different" }), /WEBHOOK_INVALID/);
});

function paidService(onRun: () => number) {
  return new LocalAuditService({
    statePath: null,
    capture: async () => ({ sourceUrl: "https://example.com/ko", targetUrl: "https://example.com/en", paired: true, source: { headline: "Source", supportingCopy: "Body", cta: "Go", text: "source" }, target: { headline: "Target", supportingCopy: "Body", cta: "Go", text: "target" } }),
    searchMarket: async () => [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }],
    retrieveGolden: async () => [{ id: "DEMO_SEED_KR_US_HERO", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Why" }, { id: "DEMO_SEED_KR_US_CTA", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Why" }, { id: "DEMO_SEED_KR_US_TRUST", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Why" }],
    hermes: { async createRun() { return { run_id: `run_${onRun()}` }; }, async waitForRun(id, onEvent) { onEvent({ event: "tool.completed", tool_name: "delegate_task" }); return { status: "completed", output: id === "run_1" ? reportOutput : paidOutput }; }, async stopRun() {} },
    checkout: { async create() { return { checkoutUrl: "https://checkout.test", paymentId: "session_1" }; }, async findSucceededPayment() { return null; } },
    paid: { async discover(audit) { return [paidPair(audit)]; }, async capture(audit, pairs) { return paidArtifacts(audit, pairs[0]); }, async searchMarket() { return [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }]; }, async retrieveGolden() { return [{ id: "DEMO_SEED_KR_US_HERO", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Why" }, { id: "DEMO_SEED_KR_US_CTA", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Why" }, { id: "DEMO_SEED_KR_US_TRUST", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Why" }]; } },
    id: (() => { let n = 0; return (prefix) => `${prefix}_${++n}`; })(),
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
