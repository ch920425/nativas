import assert from "node:assert/strict";
import test from "node:test";
import { LocalAuditService, parseFindings } from "../../apps/local-server/src/service.ts";
import { retrieveGoldenReferences } from "../../apps/local-server/src/dependencies.ts";

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

test("localhost checkout creates one linked paid run and is idempotent", async () => {
  let run = 0;
  const service = new LocalAuditService({
    statePath: null,
    capture: async () => ({ sourceUrl: "https://example.com", targetUrl: "https://example.com", paired: false, source: { headline: "Source", supportingCopy: "Body", cta: "Go", text: "source" }, target: { headline: "Target", supportingCopy: "Body", cta: "Go", text: "target" } }),
    searchMarket: async () => [{ id: "market_1", url: "https://example.org", title: "Evidence", content: "Evidence" }],
    retrieveGolden: async () => [{ id: "DEMO_SEED_KR_US_HERO", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Why" }, { id: "DEMO_SEED_KR_US_CTA", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Why" }, { id: "DEMO_SEED_KR_US_TRUST", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Why" }],
    hermes: {
      async createRun() { run += 1; return { run_id: `run_${run}` }; },
      async waitForRun(_id, onEvent) { onEvent({ event: "run.completed" }); return { status: "completed", output: reportOutput, usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }; },
      async stopRun() {},
    },
    id: (() => { let n = 0; return (prefix) => `${prefix}_${++n}`; })(),
  });
  const audit = await service.submit({ homepageUrl: "https://example.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Increase demos" });
  await waitFor(async () => service.get(audit.auditId), (view) => view?.status === "FREE_REPORT");

  const first = await service.createCheckout(audit.auditId);
  const second = await service.createCheckout(audit.auditId);
  assert.equal(first.paymentId, second.paymentId);
  const paid = await waitFor(async () => service.get(audit.auditId), (view) => Boolean(view?.paidHermesRunId));
  assert.equal(paid?.payment?.status, "SUCCEEDED");
  assert.ok(paid?.paidAuditId);
  assert.equal(run, 2);
});

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 2000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("timed out");
}
