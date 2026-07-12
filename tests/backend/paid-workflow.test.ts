import assert from "node:assert/strict";
import test from "node:test";
import type { ArtifactRef, PagePair, PaidAudit, PaidReport } from "../../packages/contracts/src/index.ts";
import { executePaidWorkflow } from "../../apps/local-server/src/paid-workflow.ts";

const audit: PaidAudit = { auditId: "paid_1", kind: "PAID", parentAuditId: "free_1", paymentId: "pay_1", status: "PAID_QUEUED", input: { homepageUrl: "https://acme.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Demos" }, limits: { maxAdditionalPairs: 2, maxRenderedPages: 4, maxFindings: 6, maxChildren: 3, maxDepth: 1 }, selectedPairIds: [], revision: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
const pair: PagePair = { pairId: "pair_1", auditId: "paid_1", role: "PRICING", sourceUrl: "https://acme.com/ko/pricing", targetUrl: "https://acme.com/en/pricing", sourceLocale: "ko-KR", targetLocale: "en-US", pairingMethod: "HREFLANG", pairingEvidence: "hreflang", discoveryScore: 100 };
const artifacts = (["SOURCE", "TARGET"] as const).flatMap((side) => (["SCREENSHOT", "HTML", "MARKDOWN", "ACCESSIBILITY_TREE"] as const).map((kind): ArtifactRef => ({ artifactId: `${side}_${kind}`, auditId: "paid_1", pairId: "pair_1", side, kind, r2Key: `key/${side}/${kind}`, mimeType: kind === "SCREENSHOT" ? "image/png" : "text/plain", sha256: `${side}${kind}`, sizeBytes: 10, sourceUrl: side === "SOURCE" ? pair.sourceUrl : pair.targetUrl, finalUrl: side === "SOURCE" ? pair.sourceUrl : pair.targetUrl, capturedAt: "2026-01-01T00:00:00Z" })));
const output = JSON.stringify({ title: "Audit", executiveSummary: "Summary", auditedPairIds: ["pair_1"], findings: [{ findingId: "f1", rank: 1, pairId: "pair_1", targetUrl: pair.targetUrl, screenshotArtifactId: "TARGET_SCREENSHOT", componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "HIGH", componentRef: { kind: "TEXT_ANCHOR", value: "Start" }, sourceCopy: "시작", currentTargetCopy: "Start", proposedTargetCopy: "See pricing", businessImpact: "Clearer intent", rationale: "Grounded recommendation", confidence: 0.9, evidenceRefs: [{ packId: "linkup", evidenceId: "market_1" }], kbRefs: ["kb_1"] }], limitations: [] });

test("PHERMES-03/PEVID-02 paid workflow persists stages and publishes only after validated output", async () => {
  const current = structuredClone(audit); const events: string[] = []; let published: PaidReport | undefined;
  await executePaidWorkflow({}, current, {
    async discover() { return [pair]; }, async capture() { return artifacts; },
    async searchMarket() { return [{ id: "market_1", url: "https://evidence.test", title: "Evidence", content: "Evidence" }]; },
    async retrieveGolden() { return [{ id: "kb_1", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Reason" }, { id: "kb_2", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Reason" }, { id: "kb_3", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Reason" }]; },
    hermes: { async createRun() { return { run_id: "run_1" }; }, async waitForRun(_id, onEvent) { onEvent({ event: "tool.started", tool_name: "delegate_task" }); onEvent({ event: "tool.completed", tool_name: "delegate_task" }); return { status: "completed", output }; }, async stopRun() {} }, id: (prefix) => `${prefix}_1`,
  }, {
    transition(status) { current.status = status; }, event(type) { events.push(type); }, savePairs(pairs) { current.selectedPairIds = pairs.map((value) => value.pairId); }, saveArtifacts() {}, bindRun(runId) { current.hermesRunId = runId; }, publish(report) { published = report; }, current() { return structuredClone(current); },
  });
  assert.equal(current.status, "PAID_REPORT");
  assert.equal(published?.findings[0].screenshotArtifactId, "TARGET_SCREENSHOT");
  assert.ok(events.includes("DISCOVERY_STARTED") && events.includes("CAPTURE_COMPLETED") && events.includes("REPORT_ACCEPTED"));
});

test("PCAP-02 incomplete artifact set stops before Hermes starts", async () => {
  let created = false; const current = structuredClone(audit);
  await assert.rejects(executePaidWorkflow({}, current, {
    async discover() { return [pair]; }, async capture() { return artifacts.slice(0, 7); }, async searchMarket() { return []; }, async retrieveGolden() { return []; },
    hermes: { async createRun() { created = true; return { run_id: "run" }; }, async waitForRun() { return { status: "completed", output }; }, async stopRun() {} }, id: (prefix) => prefix,
  }, { transition(status) { current.status = status; }, event() {}, savePairs(pairs) { current.selectedPairIds = pairs.map((value) => value.pairId); }, saveArtifacts() {}, bindRun() {}, publish() {}, current() { return structuredClone(current); } }), /CAPTURE_INCOMPLETE/);
  assert.equal(created, false);
});

test("PEVID-02 Linkup timeout degrades explicitly but reviewed KB still permits publication", async () => {
  const current = structuredClone(audit); const events: string[] = [];
  await executePaidWorkflow({}, current, {
    async discover() { return [pair]; }, async capture() { return artifacts; }, async searchMarket() { throw new Error("timeout"); },
    async retrieveGolden() { return [{ id: "kb_1", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Reason" }, { id: "kb_2", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Reason" }, { id: "kb_3", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Reason" }]; },
    hermes: { async createRun() { return { run_id: "run_1" }; }, async waitForRun() { return { status: "completed", output: output.replace('[{"packId":"linkup","evidenceId":"market_1"}]', "[]") }; }, async stopRun() {} }, id: (prefix) => `${prefix}_1`,
  }, { transition(status) { current.status = status; }, event(type) { events.push(type); }, savePairs(values) { current.selectedPairIds = values.map((value) => value.pairId); }, saveArtifacts() {}, bindRun(id) { current.hermesRunId = id; }, publish() {}, current() { return structuredClone(current); } });
  assert.ok(events.includes("EVIDENCE_DEGRADED"));
  assert.equal(current.status, "PAID_REPORT");
});

test("PEVID-02 insufficient reviewed KB stops before Hermes and emits failure", async () => {
  const current = structuredClone(audit); const events: string[] = []; let created = false;
  await assert.rejects(executePaidWorkflow({}, current, {
    async discover() { return [pair]; }, async capture() { return artifacts; }, async searchMarket() { return []; }, async retrieveGolden() { return []; },
    hermes: { async createRun() { created = true; return { run_id: "run" }; }, async waitForRun() { return { status: "completed", output }; }, async stopRun() {} }, id: (prefix) => prefix,
  }, { transition(status) { current.status = status; }, event(type) { events.push(type); }, savePairs(values) { current.selectedPairIds = values.map((value) => value.pairId); }, saveArtifacts() {}, bindRun() {}, publish() {}, current() { return structuredClone(current); } }), /KB_UNAVAILABLE/);
  assert.equal(created, false);
  assert.equal(events.at(-1), "RUN_FAILED");
});

test("PHERMES-03 malformed or failed Hermes output never publishes", async () => {
  for (const result of [{ status: "failed" as const, error: "provider failed" }, { status: "completed" as const, output: "not-json" }]) {
    const current = structuredClone(audit); let published = false;
    await assert.rejects(executePaidWorkflow({}, current, {
      async discover() { return [pair]; }, async capture() { return artifacts; }, async searchMarket() { return [{ id: "market_1", url: "https://evidence.test", title: "Evidence", content: "Evidence" }]; }, async retrieveGolden() { return [{ id: "kb_1", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Reason" }, { id: "kb_2", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Reason" }, { id: "kb_3", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Reason" }]; },
      hermes: { async createRun() { return { run_id: "run_1" }; }, async waitForRun(_id, onEvent) { onEvent({ event: "message.delta" }); onEvent({ event: "tool.failed", tool_name: "delegate_task" }); return result; }, async stopRun() {} }, id: (prefix) => prefix,
    }, { transition(status) { current.status = status; }, event() {}, savePairs(values) { current.selectedPairIds = values.map((value) => value.pairId); }, saveArtifacts() {}, bindRun(id) { current.hermesRunId = id; }, publish() { published = true; }, current() { return structuredClone(current); } }));
    assert.equal(published, false);
  }
});

test("PHERMES-03 mechanical validation failure triggers at most two bounded repair turns", async () => {
  const runs: string[] = [];
  const makeHermes = (outputs: string[]) => ({
    async createRun() { runs.push(`run_${runs.length + 1}`); return { run_id: runs.at(-1)! }; },
    async waitForRun() { return { status: "completed" as const, output: outputs[Math.min(runs.length - 1, outputs.length - 1)] }; },
    async stopRun() {},
  });
  const deps = {
    async discover() { return [pair]; }, async capture() { return artifacts; },
    async searchMarket() { return [{ id: "market_1", url: "https://evidence.test", title: "Evidence", content: "Evidence" }]; },
    async retrieveGolden() { return [{ id: "kb_1", componentType: "PRIMARY_CTA", precedent: "Pattern", rationale: "Reason" }, { id: "kb_2", componentType: "HERO_HEADLINE", precedent: "Pattern", rationale: "Reason" }, { id: "kb_3", componentType: "TRUST_COPY", precedent: "Pattern", rationale: "Reason" }]; },
    id: (prefix: string) => `${prefix}_1`,
  };
  const makeHooks = (current: PaidAudit, events: string[], onPublish: (report: PaidReport) => void) => ({
    transition(status: PaidAudit["status"]) { current.status = status; }, event(type: string) { events.push(type); },
    savePairs(values: PagePair[]) { current.selectedPairIds = values.map((value) => value.pairId); }, saveArtifacts() {},
    bindRun(runId: string) { current.hermesRunId = runId; }, publish: onPublish, current: () => structuredClone(current),
  });

  // Invalid first output, valid repair output: publishes after exactly one repair run.
  const repaired = structuredClone(audit); const repairedEvents: string[] = []; let published: PaidReport | undefined;
  runs.length = 0;
  await executePaidWorkflow({}, repaired, { ...deps, hermes: makeHermes(["{\"broken\": true}", output]) }, makeHooks(repaired, repairedEvents, (report) => { published = report; }));
  assert.equal(repaired.status, "PAID_REPORT");
  assert.equal(runs.length, 2, "one initial run plus exactly one repair run");
  assert.ok(repairedEvents.includes("REPORT_REPAIR_REQUESTED"));
  assert.equal(published?.generation.hermesRunId, "run_2", "report is bound to the accepted repair run");

  // Never-valid output: one initial run plus two repairs, then a typed terminal failure.
  const exhausted = structuredClone(audit); const exhaustedEvents: string[] = [];
  runs.length = 0;
  await assert.rejects(
    executePaidWorkflow({}, exhausted, { ...deps, hermes: makeHermes(["nonsense"]) }, makeHooks(exhausted, exhaustedEvents, () => { throw new Error("must not publish"); })),
    /REPORT_INVALID/,
  );
  assert.equal(runs.length, 3, "repairs are bounded at two");
  assert.equal(exhaustedEvents.filter((type) => type === "REPORT_REPAIR_REQUESTED").length, 2);
});
