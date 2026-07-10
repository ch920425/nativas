import assert from "node:assert/strict";
import test from "node:test";
import { MemoryAuditStore, StateConflict } from "../../apps/runtime/src/store.ts";
import { HermesCreateError, HermesRelay, normalizeHermesEvent } from "../../apps/runtime/src/hermes.ts";
import { assertCompleteCapture, assertSafeCaptureUrl, capabilityMatches, hashCapability, searchLinkupOnce, verifyDodoWebhook } from "../../apps/runtime/src/adapters.ts";

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

test("Linkup makes a single bounded standard call and degrades on failure", async () => {
  let calls = 0; const available = await searchLinkupOnce({ search: async ({ depth, maxResults }) => { calls++; assert.equal(depth, "standard"); assert.equal(maxResults, 3); return { sources: [{ id: "source_1", url: "https://example.com", title: "Example" }] }; } }, "B2B CTA");
  assert.equal(calls, 1); assert.equal(available.status, "AVAILABLE"); const unavailable = await searchLinkupOnce({ search: async () => { throw new Error("timeout"); } }, "B2B CTA"); assert.deepEqual(unavailable, { status: "UNAVAILABLE", code: "RESEARCH_UNAVAILABLE" });
});

test("report publication validates references and is idempotent", () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_6", "https://example.com", "KR_TO_US"); store.transition(audit.publicId, "ELIGIBILITY_CHECK"); store.transition(audit.publicId, "FREE_RUNNING");
  const report = { schemaVersion: "1.0" as const, auditId: "aud_6", reportId: "rep_1", generatedAt: new Date().toISOString(), findings: Array.from({ length: 3 }, (_, index) => ({ id: String(index), title: "Issue", componentType: "PRIMARY_CTA" as const, sourceCopy: "Start", recommendation: "Get started", rationale: "Native convention", artifactId: "art_1", evidenceRefs: [{ packId: "pack_1", evidenceId: "evidence_1" }], goldenRecordIds: ["gold_1"] })) };
  const refs = { artifacts: new Set(["art_1"]), evidence: new Set(["pack_1:evidence_1"]), golden: new Set(["gold_1"]) }; assert.equal(store.publish(report, "report:aud_6:v1", refs).reportId, "rep_1"); assert.equal(store.publish(report, "report:aud_6:v1", refs).reportId, "rep_1"); assert.equal(store.require("aud_6").status, "FREE_REPORT");
});

test("verified payment event creates exactly one two-surface paid child", () => {
  const store = new MemoryAuditStore(); const audit = store.createFree("aud_7", "https://example.com", "KR_TO_US"); store.transition(audit.publicId, "ELIGIBILITY_CHECK"); store.transition(audit.publicId, "FREE_RUNNING"); store.transition(audit.publicId, "FREE_REPORT");
  const paid = store.createPaidOnce("aud_7", "dodo_evt_1"); assert.equal(paid.limits.maxPagePairs, 2); assert.equal(store.createPaidOnce("aud_7", "dodo_evt_1").publicId, paid.publicId);
});

test("Dodo raw-body verification requires all delivery headers and capabilities are scoped", () => {
  const verifier = { unwrap: (body: string) => ({ id: "evt", type: "payment.succeeded", data: body }) }; assert.throws(() => verifyDodoWebhook(verifier, "{}", {}), /WEBHOOK_INVALID/); assert.equal(verifyDodoWebhook(verifier, "{}", { "webhook-id": "a", "webhook-signature": "b", "webhook-timestamp": "c" }).id, "evt");
  const secret = "random-secret"; assert.equal(capabilityMatches(hashCapability(secret), secret), true); assert.equal(capabilityMatches(hashCapability(secret), "wrong"), false);
});
