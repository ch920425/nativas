import assert from "node:assert/strict";
import test from "node:test";
import { MemoryAuditStore, StateConflict } from "../../apps/runtime/src/store.ts";
import { HermesCreateError, HermesRelay, normalizeHermesEvent } from "../../apps/runtime/src/hermes.ts";
import { assertCompleteCapture, assertSafeCaptureUrl, capabilityMatches, hashCapability, searchLinkupOnce, verifyDodoWebhook } from "../../apps/runtime/src/adapters.ts";
import { NavitasOps, ParentCapabilityAuthorizer } from "../../apps/runtime/src/ops.ts";
import { processDodoWebhook } from "../../apps/runtime/src/payment.ts";
import { capturePublicPage, validateLocaleCandidate } from "../../workers/capture/src/index.ts";

test("free audit allows only its legal transition path", () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_1", "https://example.com/ko", "KR_TO_US");
  assert.throws(() => store.transition(audit.publicId, "FREE_RUNNING"), StateConflict);
  store.transition(audit.publicId, "ELIGIBILITY_CHECK"); store.transition(audit.publicId, "FREE_RUNNING");
  assert.equal(store.require(audit.publicId).status, "FREE_RUNNING");
});

test("maybe-dispatched Hermes create fails closed and creates no replacement", async () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_2", "https://example.com", "KR_TO_US"); store.transition(audit.publicId, "ELIGIBILITY_CHECK");
  const relay = new HermesRelay(store, { createRun: async () => { throw new HermesCreateError("MAYBE_DISPATCHED", "socket reset"); }, getRun: async () => ({ status: "queued" }) });
  await assert.rejects(() => relay.start(audit.publicId, "attempt_1", {}));
  assert.equal(store.require(audit.publicId).runStartState, "UNCERTAIN"); assert.equal(store.require(audit.publicId).error?.code, "HERMES_START_UNCERTAIN");
  assert.throws(() => store.reserveHermesStart(audit.publicId, "attempt_2"), StateConflict);
});

test("proven pre-dispatch failure releases the reservation for one safe retry", async () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_retry", "https://example.com", "KR_TO_US"); store.transition(audit.publicId, "ELIGIBILITY_CHECK");
  const relay = new HermesRelay(store, { createRun: async () => { throw new HermesCreateError("NOT_DISPATCHED", "connection refused before write"); }, getRun: async () => ({ status: "queued" }) });
  await assert.rejects(() => relay.start(audit.publicId, "attempt_1", {}));
  assert.equal(store.require(audit.publicId).runStartState, "UNRESERVED");
  store.reserveHermesStart(audit.publicId, "attempt_2");
});

test("acknowledged Hermes create binds a run and emits truthful relay lifecycle events", async () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_3", "https://example.com", "US_TO_KR"); store.transition(audit.publicId, "ELIGIBILITY_CHECK");
  const relay = new HermesRelay(store, { createRun: async () => ({ run_id: "run_123" }), getRun: async () => ({ status: "running" }) }); await relay.start(audit.publicId, "attempt_1", {});
  assert.equal(store.require(audit.publicId).hermesRunId, "run_123"); assert.deepEqual(store.events.get(audit.publicId)?.map((event) => event.type), ["RUN_CREATED", "RUN_STARTED"]);
});

test("paid audit stays queued until a Hermes run is bound", async () => {
  const store = new MemoryAuditStore(); const free = store.createFree("aud_paid_parent", "https://example.com", "KR_TO_US"); store.transition(free.publicId, "ELIGIBILITY_CHECK"); store.transition(free.publicId, "FREE_RUNNING"); store.transition(free.publicId, "FREE_REPORT");
  const paid = store.createPaidOnce(free.publicId, "dodo_evt_queued"); store.claim(paid.publicId); assert.equal(store.require(paid.publicId).status, "PAID_QUEUED");
  const relay = new HermesRelay(store, { createRun: async () => ({ run_id: "run_paid" }), getRun: async () => ({ status: "queued" }) }); await relay.start(paid.publicId, "attempt_paid", {}); assert.equal(store.require(paid.publicId).status, "PAID_RUNNING");
});

test("lease heartbeat rejects concurrent owners and permits reclaim only after expiry", () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_lease", "https://example.com", "KR_TO_US"); store.transition(audit.publicId, "ELIGIBILITY_CHECK");
  store.claim(audit.publicId, "relay_a", 1000, 100);
  assert.throws(() => store.claim(audit.publicId, "relay_b", 1050, 100), /lease is held/);
  assert.equal(store.heartbeat(audit.publicId, "relay_a", 1050, 100).leaseExpiresAt, new Date(1150).toISOString());
  assert.equal(store.claim(audit.publicId, "relay_b", 1200, 100).leaseOwner, "relay_b");
  assert.throws(() => store.heartbeat(audit.publicId, "relay_a", 1201, 100), /owned by another relay/);
});

test("status reconciliation and operator stop preserve persisted authority", async () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_reconcile", "https://example.com", "KR_TO_US"); store.transition(audit.publicId, "ELIGIBILITY_CHECK");
  let stopped = false; const relay = new HermesRelay(store, { createRun: async () => ({ run_id: "run_reconcile" }), getRun: async () => ({ status: "running" }), stopRun: async () => { stopped = true; } });
  await relay.start(audit.publicId, "attempt", {}); await relay.reconcile(audit.publicId); await relay.stop(audit.publicId);
  assert.equal(stopped, true); assert.equal(store.require(audit.publicId).status, "CANCELLED");
});

test("failed Hermes status becomes a typed terminal audit failure", async () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_failed", "https://example.com", "KR_TO_US"); store.transition(audit.publicId, "ELIGIBILITY_CHECK");
  let calls = 0; const relay = new HermesRelay(store, { createRun: async () => ({ run_id: "run_failed" }), getRun: async () => ({ status: calls++ === 0 ? "running" : "failed" }) });
  await relay.start(audit.publicId, "attempt", {}); await relay.reconcile(audit.publicId);
  assert.equal(store.require(audit.publicId).status, "FAILED"); assert.equal(store.require(audit.publicId).error?.code, "HERMES_RUN_FAILED");
});

test("duplicate events keep a single monotonic sequence", () => {
  const store = new MemoryAuditStore(); store.createFree("aud_4", "https://example.com", "KR_TO_US");
  const event = { schemaVersion: "1.0" as const, eventId: "hermes:same", auditId: "aud_4", type: "TOOL_STARTED", actor: "HERMES_PARENT" as const, status: "RUNNING" as const, safeLabel: "Capture", occurredAt: new Date().toISOString() };
  assert.equal(store.append(event).seq, 1); assert.equal(store.append(event).seq, 1); assert.equal(store.events.get("aud_4")?.length, 1);
});

test("reasoning is excluded while native tool events are normalized", () => {
  assert.equal(normalizeHermesEvent("aud_5", "run_5", { type: "reasoning.available" }), null);
  const normalized = normalizeHermesEvent("aud_5", "run_5", { type: "tool.started", tool_name: "capture_site" }); assert.equal(normalized?.toolName, "capture_site"); assert.match(normalized!.eventId, /^hermes:/);
});

test("capture requires all four Browser Run evidence artifacts and rejects unsafe URLs", () => {
  assert.throws(() => assertCompleteCapture(["SCREENSHOT", "HTML", "MARKDOWN"]), /CAPTURE_INCOMPLETE/);
  assert.equal(assertSafeCaptureUrl("https://example.com/ko").hostname, "example.com"); assert.throws(() => assertSafeCaptureUrl("http://127.0.0.1"), /UNSAFE_URL/);
});

test("capture validates DNS and every redirect before Browser Run", async () => {
  let snapshots = 0;
  const dependencies = {
    resolve: async (host: string) => host === "private.example.com" ? ["10.0.0.1"] : ["203.0.113.10"],
    preflight: async () => ({ finalUrl: "https://private.example.com/en", redirects: ["https://example.com/start"] }),
    snapshot: async (url: string) => { snapshots++; return { sourceUrl: url, artifacts: [] }; }
  };
  await assert.rejects(() => capturePublicPage("https://example.com", dependencies), /UNSAFE_URL/);
  assert.equal(snapshots, 0);
});

test("locale candidates stay on the submitted registrable domain", () => {
  assert.equal(validateLocaleCandidate("https://en.example.com/home", "example.com").hostname, "en.example.com");
  assert.throws(() => validateLocaleCandidate("https://example.com.attacker.test/en", "example.com"), /LOCALE_NOT_FOUND/);
});

test("capture enforces redirect, byte, and evidence completeness limits", async () => {
  const base = { resolve: async () => ["203.0.113.10"], preflight: async () => ({ finalUrl: "https://example.com/en", redirects: [] as string[] }), snapshot: async (url: string) => ({ sourceUrl: url, artifacts: ["SCREENSHOT", "HTML", "MARKDOWN", "ACCESSIBILITY_TREE"].map((kind) => ({ kind, bytes: 10 })) }) };
  const result = await capturePublicPage("https://example.com", base); assert.equal(result.artifacts.length, 4);
  await assert.rejects(() => capturePublicPage("https://example.com", { ...base, preflight: async () => ({ finalUrl: "https://example.com", redirects: Array(4).fill("https://example.com") }) }), /CAPTURE_INCOMPLETE/);
  await assert.rejects(() => capturePublicPage("https://example.com", { ...base, snapshot: async (url) => ({ sourceUrl: url, artifacts: [{ kind: "SCREENSHOT", bytes: 13_000_000 }] }) }), /CAPTURE_INCOMPLETE/);
});

test("Linkup makes a single bounded standard call and degrades on failure", async () => {
  let calls = 0; const available = await searchLinkupOnce({ search: async ({ depth, maxResults }) => { calls++; assert.equal(depth, "standard"); assert.equal(maxResults, 3); return { sources: [{ id: "source_1", url: "https://example.com", title: "Example" }] }; } }, "B2B CTA");
  assert.equal(calls, 1); assert.equal(available.status, "AVAILABLE"); const unavailable = await searchLinkupOnce({ search: async () => { throw new Error("timeout"); } }, "B2B CTA"); assert.deepEqual(unavailable, { status: "UNAVAILABLE", code: "RESEARCH_UNAVAILABLE" });
});

test("Linkup rejects malformed, insecure, empty, and oversized result packets", async () => {
  for (const sources of [[], [{ id: "1", url: "http://example.com", title: "bad" }], Array.from({ length: 4 }, (_, index) => ({ id: String(index), url: "https://example.com", title: "x" })), [{ id: 1, url: "https://example.com", title: "bad" }]]) {
    assert.deepEqual(await searchLinkupOnce({ search: async () => ({ sources }) }, "query"), { status: "UNAVAILABLE", code: "RESEARCH_UNAVAILABLE" });
  }
});

test("report publication validates references and is idempotent", () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_6", "https://example.com", "KR_TO_US"); store.transition(audit.publicId, "ELIGIBILITY_CHECK"); store.transition(audit.publicId, "FREE_RUNNING");
  const report = { schemaVersion: "1.0" as const, auditId: "aud_6", reportId: "rep_1", generatedAt: new Date().toISOString(), findings: Array.from({ length: 3 }, (_, index) => ({ id: String(index), title: "Issue", componentType: "PRIMARY_CTA" as const, sourceCopy: "Start", recommendation: "Get started", rationale: "Native convention", artifactId: "art_1", evidenceRefs: [{ packId: "pack_1", evidenceId: "evidence_1" }], goldenRecordIds: ["gold_1"] })) };
  const refs = { artifacts: new Set(["art_1"]), evidence: new Set(["pack_1:evidence_1"]), golden: new Set(["gold_1"]) }; assert.equal(store.publish(report, "report:aud_6:v1", refs).reportId, "rep_1"); assert.equal(store.publish(report, "report:aud_6:v1", refs).reportId, "rep_1"); assert.equal(store.require("aud_6").status, "FREE_REPORT");
});

test("conflicting report replay and invalid mechanical fields cannot publish", () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_report_bad", "https://example.com", "KR_TO_US"); store.transition(audit.publicId, "ELIGIBILITY_CHECK"); store.transition(audit.publicId, "FREE_RUNNING");
  const finding = { id: "one", title: "Issue", componentType: "PRIMARY_CTA" as const, sourceCopy: "Start", recommendation: "Get started", rationale: "Native convention", artifactId: "art", evidenceRefs: [{ packId: "pack", evidenceId: "evidence" }], goldenRecordIds: ["gold"] };
  const refs = { artifacts: new Set(["art"]), evidence: new Set(["pack:evidence"]), golden: new Set(["gold"]) };
  const report = { schemaVersion: "1.0" as const, auditId: audit.publicId, reportId: "report", generatedAt: new Date().toISOString(), findings: [finding, { ...finding, id: "two" }, { ...finding, id: "three" }] };
  store.publish(report, "report:key", refs);
  assert.throws(() => store.publish({ ...report, findings: report.findings.map((item, index) => index === 0 ? { ...item, recommendation: "Different" } : item) }, "report:key", refs), /REPORT_IDEMPOTENCY_CONFLICT/);
  const second = store.createFree("aud_report_invalid", "https://example.com", "KR_TO_US"); store.transition(second.publicId, "ELIGIBILITY_CHECK"); store.transition(second.publicId, "FREE_RUNNING");
  assert.throws(() => store.publish({ ...report, auditId: second.publicId, findings: [{ ...finding, recommendation: "Start" }, { ...finding }, { ...finding }] }, "report:invalid", refs), /REPORT_INVALID/);
});

test("verified payment event creates exactly one two-surface paid child", () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_7", "https://example.com", "KR_TO_US"); store.transition(audit.publicId, "ELIGIBILITY_CHECK"); store.transition(audit.publicId, "FREE_RUNNING"); store.transition(audit.publicId, "FREE_REPORT");
  const paid = store.createPaidOnce("aud_7", "dodo_evt_1"); assert.equal(paid.limits.maxPagePairs, 2); assert.equal(store.createPaidOnce("aud_7", "dodo_evt_1").publicId, paid.publicId);
});

test("Dodo raw-body verification requires all delivery headers and capabilities are scoped", () => {
  const verifier = { unwrap: (body: string) => ({ id: "evt", type: "payment.succeeded", data: body }) }; assert.throws(() => verifyDodoWebhook(verifier, "{}", {}), /WEBHOOK_INVALID/); assert.equal(verifyDodoWebhook(verifier, "{}", { "webhook-id": "a", "webhook-signature": "b", "webhook-timestamp": "c" }).id, "evt");
  const secret = "random-secret"; assert.equal(capabilityMatches(hashCapability(secret), secret), true); assert.equal(capabilityMatches(hashCapability(secret), "wrong"), false);
});

test("parent capability denies missing, expired, wrong-run, and child calls", async () => {
  const capability = "parent-only-secret"; const records = new Map([["aud_ops", { auditId: "aud_ops", runId: "run_ops", hash: hashCapability(capability), expiresAt: 2000 }]]);
  const ops = new NavitasOps(new ParentCapabilityAuthorizer(records, () => 1000), { capture_site: (input) => input.auditId, search_market_evidence: () => null, submit_report: () => null });
  assert.equal(await ops.call("capture_site", { auditId: "aud_ops", runId: "run_ops", parentCapability: capability }), "aud_ops");
  await assert.rejects(() => ops.call("capture_site", { auditId: "aud_ops", runId: "child_run", parentCapability: capability }), /PARENT_CAPABILITY_DENIED/);
  await assert.rejects(() => ops.call("capture_site", { auditId: "aud_ops", runId: "run_ops", parentCapability: "wrong" }), /PARENT_CAPABILITY_DENIED/);
  await assert.rejects(() => new NavitasOps(new ParentCapabilityAuthorizer(records, () => 3000), { capture_site: () => null, search_market_evidence: () => null, submit_report: () => null }).call("capture_site", { auditId: "aud_ops", runId: "run_ops", parentCapability: capability }), /PARENT_CAPABILITY_DENIED/);
  await assert.rejects(() => ops.call("unknown", { auditId: "aud_ops", runId: "run_ops", parentCapability: capability }), /TOOL_NOT_ALLOWED/);
});

test("verified canonical Dodo event is atomic and duplicate delivery cannot double-create", () => {
  const store = new MemoryAuditStore(); const free = store.createFree("aud_dodo", "https://example.com", "KR_TO_US"); store.transition(free.publicId, "ELIGIBILITY_CHECK"); store.transition(free.publicId, "FREE_RUNNING"); store.transition(free.publicId, "FREE_REPORT");
  const client = { unwrap: () => ({ id: "provider_event", type: "payment.succeeded", data: { metadata: { auditId: free.publicId } } }) };
  const headers = { "webhook-id": "delivery_1", "webhook-signature": "signature", "webhook-timestamp": "timestamp" };
  const first = processDodoWebhook(store, client, "raw-body", headers); const duplicate = processDodoWebhook(store, client, "raw-body", headers);
  assert.equal(first.publicId, duplicate.publicId); assert.equal([...store.audits.values()].filter((audit) => audit.kind === "PAID").length, 1);
});

test("Dodo rejects noncanonical event type and missing audit metadata", () => {
  const store = new MemoryAuditStore(); const headers = { "webhook-id": "delivery", "webhook-signature": "signature", "webhook-timestamp": "timestamp" };
  assert.throws(() => processDodoWebhook(store, { unwrap: () => ({ id: "event", type: "payment.success", data: { metadata: { auditId: "aud" } } }) }, "raw", headers), /WEBHOOK_INVALID/);
  assert.throws(() => processDodoWebhook(store, { unwrap: () => ({ id: "event", type: "payment.succeeded", data: {} }) }, "raw", headers), /WEBHOOK_INVALID/);
});
