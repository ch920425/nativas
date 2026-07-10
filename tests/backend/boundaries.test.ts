import assert from "node:assert/strict";
import test from "node:test";
import { canTransition, validateReport, type Audit, type AuditStatus, type Finding, type Report } from "../../packages/contracts/src/index.ts";
import { assertCompleteCapture, assertPublicResolution, assertSafeCaptureUrl, isPrivateAddress, isUnsafeHostname, verifyDodoWebhook } from "../../apps/runtime/src/adapters.ts";
import { HermesCreateError, HermesRelay, normalizeHermesEvent } from "../../apps/runtime/src/hermes.ts";
import { NativasOps, ParentCapabilityAuthorizer } from "../../apps/runtime/src/ops.ts";
import { MemoryAuditStore, StateConflict } from "../../apps/runtime/src/store.ts";
import { capturePublicPage } from "../../workers/capture/src/index.ts";

const statuses: AuditStatus[] = ["SUBMITTED", "ELIGIBILITY_CHECK", "FREE_RUNNING", "FREE_REPORT", "PAID_QUEUED", "PAID_RUNNING", "PAID_REPORT", "FAILED", "CANCELLED"];
const allowed = new Set(["SUBMITTED>ELIGIBILITY_CHECK", "SUBMITTED>FAILED", "SUBMITTED>CANCELLED", "ELIGIBILITY_CHECK>FREE_RUNNING", "ELIGIBILITY_CHECK>FAILED", "ELIGIBILITY_CHECK>CANCELLED", "FREE_RUNNING>FREE_REPORT", "FREE_RUNNING>FAILED", "FREE_RUNNING>CANCELLED", "PAID_QUEUED>PAID_RUNNING", "PAID_QUEUED>FAILED", "PAID_QUEUED>CANCELLED", "PAID_RUNNING>PAID_REPORT", "PAID_RUNNING>FAILED", "PAID_RUNNING>CANCELLED"]);

test("state transition matrix exactly matches every documented legal edge", () => {
  for (const from of statuses) for (const to of statuses) assert.equal(canTransition(from, to), allowed.has(`${from}>${to}`), `${from}>${to}`);
});

test("store rejects missing, duplicate, unclaimable, mismatched, and terminal mutations", () => {
  const store = new MemoryAuditStore();
  assert.throws(() => store.require("missing"), StateConflict);
  const audit = store.createFree("aud_guard", "https://example.com", "KR_TO_US");
  assert.throws(() => store.createFree(audit.publicId, "https://example.com", "KR_TO_US"), /duplicate audit/);
  assert.throws(() => store.claim(audit.publicId), /not claimable/);
  store.transition(audit.publicId, "ELIGIBILITY_CHECK"); store.reserveHermesStart(audit.publicId, "attempt");
  assert.throws(() => store.markDispatch(audit.publicId, "wrong", "NOT_DISPATCHED"), /reservation mismatch/);
  store.markDispatch(audit.publicId, "attempt", "NOT_DISPATCHED");
  assert.throws(() => store.bindHermesRun(audit.publicId, "attempt", "run"), /undispatched/);
  store.releaseNotDispatched(audit.publicId, "attempt");
  assert.throws(() => store.releaseNotDispatched(audit.publicId, "attempt"), /reservation mismatch/);
  store.transition(audit.publicId, "FAILED");
  assert.throws(() => store.cancel(audit.publicId), /cannot be cancelled/);
  assert.throws(() => store.fail(audit.publicId, "HERMES_RUN_FAILED", "again"), /cannot fail/);
});

function reportFixture(direction: "KR_TO_US" | "US_TO_KR" = "KR_TO_US") {
  const [sourceLocale, targetLocale] = direction === "KR_TO_US" ? ["ko-KR", "en-US"] as const : ["en-US", "ko-KR"] as const;
  const audit: Pick<Audit, "publicId" | "kind" | "limits" | "targetLocale"> = { publicId: "aud_report_matrix", kind: "FREE", targetLocale, limits: { maxPagePairs: 1, exactFindingCount: 3, maxFindings: 3, maxChildren: 3, maxDepth: 1, maxRuntimeSeconds: 240 } };
  void sourceLocale;
  const recommendation = direction === "KR_TO_US" ? "Start your free audit" : "무료 진단 시작";
  const finding: Finding = { id: "finding-1", title: "Primary CTA lacks specificity", componentType: "PRIMARY_CTA", sourceCopy: direction === "KR_TO_US" ? "Start" : "Get started", recommendation, rationale: "The proposed action states what begins next.", artifactId: "artifact-1", evidenceRefs: [{ packId: "pack-1", evidenceId: "evidence-1" }], goldenRecordIds: ["gold-1"] };
  const report: Report = { schemaVersion: "1.0", auditId: audit.publicId, generatedAt: "2026-07-10T00:00:00Z", findings: [finding, { ...finding, id: "finding-2" }, { ...finding, id: "finding-3" }] };
  const refs = { artifacts: new Set(["artifact-1"]), evidence: new Set(["pack-1:evidence-1"]), golden: new Set(["gold-1"]) };
  return { audit, finding, report, refs };
}

test("report validator accepts both target languages and rejects every mechanical publication fault", () => {
  for (const direction of ["KR_TO_US", "US_TO_KR"] as const) {
    const { audit, report, refs } = reportFixture(direction);
    assert.deepEqual(validateReport(report, audit, refs.artifacts, refs.evidence, refs.golden), { ok: true });
  }
  const { audit, finding, report, refs } = reportFixture();
  const cases: Report[] = [
    { ...report, schemaVersion: "0.9" as "1.0" },
    { ...report, auditId: "wrong" },
    { ...report, findings: report.findings.slice(0, 2) },
    { ...report, findings: [{ ...finding, id: "" }, { ...finding }, { ...finding }] },
    { ...report, findings: [{ ...finding, artifactId: "unknown" }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, evidenceRefs: [{ packId: "unknown", evidenceId: "unknown" }] }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, goldenRecordIds: ["unknown"] }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, title: "" }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, title: "x".repeat(121) }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, sourceCopy: "" }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, sourceCopy: "x".repeat(501) }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, recommendation: "" }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, recommendation: "x".repeat(501) }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, rationale: "x".repeat(801) }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, recommendation: finding.sourceCopy }, report.findings[1], report.findings[2]] },
    { ...report, findings: [{ ...finding, recommendation: "시작하기" }, report.findings[1], report.findings[2]] }
  ];
  for (const invalid of cases) assert.equal(validateReport(invalid, audit, refs.artifacts, refs.evidence, refs.golden).ok, false);
});

test("URL and DNS boundary rejects credentials, local names, metadata, and private address families", async () => {
  for (const url of ["not-a-url", "ftp://example.com/file", "https://user:pass@example.com", "https://localhost", "https://metadata.google.internal", "https://127.0.0.1", "https://[::1]"]) assert.throws(() => assertSafeCaptureUrl(url));
  for (const host of ["localhost.", "service.localhost", "metadata.google.internal", "127.0.0.1"]) assert.equal(isUnsafeHostname(host), true);
  for (const address of ["0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "224.0.0.1", "100.64.0.1", "198.18.0.1", "::", "::1", "fc00::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "bad-address"]) assert.equal(isPrivateAddress(address), true, address);
  for (const address of ["1.1.1.1", "172.32.0.1", "203.0.113.10", "2001:4860:4860::8888"]) assert.equal(isPrivateAddress(address), false, address);
  const url = assertSafeCaptureUrl("https://example.com");
  await assert.rejects(() => assertPublicResolution(url, async () => []), /UNSAFE_URL/);
  await assert.rejects(() => assertPublicResolution(url, async () => ["203.0.113.10", "10.0.0.1"]), /UNSAFE_URL/);
  assert.deepEqual(await assertPublicResolution(url, async () => ["203.0.113.10"]), ["203.0.113.10"]);
  assert.doesNotThrow(() => assertCompleteCapture(["SCREENSHOT", "HTML", "MARKDOWN", "ACCESSIBILITY_TREE"]));
});

test("Hermes malformed create, terminal statuses, and stop/reconcile guards fail closed", async () => {
  const setup = (id: string) => { const store = new MemoryAuditStore(); const audit = store.createFree(id, "https://example.com", "KR_TO_US"); store.transition(id, "ELIGIBILITY_CHECK"); return { store, audit }; };
  {
    const { store, audit } = setup("aud_missing_run"); const relay = new HermesRelay(store, { createRun: async () => ({ run_id: "" }), getRun: async () => ({ status: "queued" }) });
    await assert.rejects(() => relay.start(audit.publicId, "attempt", {}), HermesCreateError); assert.equal(store.require(audit.publicId).runStartState, "UNCERTAIN");
  }
  {
    const { store, audit } = setup("aud_bad_status"); const relay = new HermesRelay(store, { createRun: async () => ({ run_id: "run" }), getRun: async () => ({ status: "authentication_failed" }) });
    await assert.rejects(() => relay.start(audit.publicId, "attempt", {}), /HERMES_RUN_FAILED/);
  }
  {
    const { store, audit } = setup("aud_no_stop"); const relay = new HermesRelay(store, { createRun: async () => ({ run_id: "run" }), getRun: async () => ({ status: "queued" }) });
    await relay.start(audit.publicId, "attempt", {}); await assert.rejects(() => relay.stop(audit.publicId), /HERMES_RUN_FAILED/);
  }
  {
    const { store, audit } = setup("aud_cancelled"); let status = "running"; const relay = new HermesRelay(store, { createRun: async () => ({ run_id: "run" }), getRun: async () => ({ status }) });
    await relay.start(audit.publicId, "attempt", {}); status = "cancelled"; await relay.reconcile(audit.publicId); assert.equal(store.require(audit.publicId).status, "CANCELLED");
  }
  const unbound = setup("aud_unbound"); assert.throws(() => unbound.store.reconcileHermesStatus(unbound.audit.publicId, "running"), /no bound/);
});

test("Hermes event normalization covers completed, failed, timestamped, and malformed events", () => {
  assert.equal(normalizeHermesEvent("audit", "run", {}), null);
  assert.equal(normalizeHermesEvent("audit", "run", { type: "tool.completed", tool_name: "submit_report", occurred_at: "2026-07-10T00:00:00Z" })?.status, "SUCCEEDED");
  assert.equal(normalizeHermesEvent("audit", "run", { type: "tool.failed", tool_name: "capture_site" })?.status, "FAILED");
  assert.equal(normalizeHermesEvent("audit", "run", { type: "delegation.started", tool_name: "delegate_task" })?.actor, "HERMES_PARENT");
});

test("webhook verification wraps provider signature failures and ops reject malformed authority", async () => {
  assert.throws(() => verifyDodoWebhook({ unwrap: () => { throw new Error("bad signature"); } }, "raw", { "webhook-id": "id", "webhook-signature": "sig", "webhook-timestamp": "time" }), /WEBHOOK_INVALID/);
  const ops = new NativasOps(new ParentCapabilityAuthorizer(new Map()), { capture_site: () => null, search_market_evidence: () => null, submit_report: () => null });
  await assert.rejects(() => ops.call("capture_site", { auditId: "audit", runId: "run" }), /PARENT_CAPABILITY_DENIED/);
});

test("capture blocks oversized preflight before invoking the browser", async () => {
  let snapshotCalled = false;
  await assert.rejects(() => capturePublicPage("https://example.com", { resolve: async () => ["203.0.113.10"], preflight: async () => ({ finalUrl: "https://example.com", redirects: [], contentLength: 12_000_001 }), snapshot: async (url) => { snapshotCalled = true; return { sourceUrl: url, artifacts: [] }; } }), /CAPTURE_INCOMPLETE/);
  assert.equal(snapshotCalled, false);
});
