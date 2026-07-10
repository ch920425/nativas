import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditView, IntakeInput } from "../lib/contracts";
import { createFixtureTransport } from "./fixtureTransport";

const input = (overrides: Partial<IntakeInput> = {}): IntakeInput => ({
  homepageUrl: "https://example.co.kr",
  direction: "KR_TO_US",
  audience: "US startup operators",
  launchGoal: "Increase qualified demo requests",
  ...overrides,
});

function waitUntil(check: () => Promise<boolean>, timeoutMs = 4000): Promise<void> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (await check()) return resolve();
      if (Date.now() - startedAt > timeoutMs) return reject(new Error("condition not reached"));
      setTimeout(poll, 5);
    };
    void poll();
  });
}

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("fixture transport run lifecycle", () => {
  it("progresses a happy run to FREE_REPORT with contract-legal transitions and monotonic seq", async () => {
    const transport = createFixtureTransport(2);
    const created = await transport.submit(input());
    expect(created.status).toBe("SUBMITTED");

    const seen: string[] = [];
    transport.subscribe(created.auditId, (view) => seen.push(view.status));

    await waitUntil(async () => (await transport.get(created.auditId))?.status === "FREE_REPORT");
    const done = (await transport.get(created.auditId))!;

    expect(done.report?.findings).toHaveLength(3);
    expect(done.hermesRunId).toMatch(/^run_fx_/);
    expect(done.degraded).toBe(false);
    expect(done.report?.liveMarketEvidence).toBe("AVAILABLE");
    // Events strictly ordered by server-assigned seq, no duplicates.
    const seqs = done.events.map((event) => event.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(done.events.at(-1)?.type).toBe("REPORT_ACCEPTED");
    // Delegation stage is genuinely represented.
    expect(done.events.some((event) => event.type === "DELEGATION_STARTED" && event.toolName === "delegate_task")).toBe(true);
    // Subscription observed only legal, forward-moving statuses.
    expect(seen).toContain("FREE_RUNNING");
    expect(seen.at(-1)).toBe("FREE_REPORT");
  });

  it("marks the report degraded when live research is unavailable", async () => {
    const transport = createFixtureTransport(2);
    const created = await transport.submit(input({ homepageUrl: "https://degraded.example.co.kr" }));
    await waitUntil(async () => (await transport.get(created.auditId))?.status === "FREE_REPORT");
    const done = (await transport.get(created.auditId))!;
    expect(done.degraded).toBe(true);
    expect(done.report?.liveMarketEvidence).toBe("DEGRADED");
    expect(done.report?.limitations.join(" ")).toMatch(/unavailable/i);
    expect(done.report?.findings.every((finding) => finding.evidenceRefs.length === 0)).toBe(true);
    expect(done.report?.findings.every((finding) => finding.kbRefs.length > 0)).toBe(true);
  });

  it.each([
    ["capture-fail", "CAPTURE_INCOMPLETE"],
    ["blocked", "BLOCKED_BY_ORIGIN"],
  ])("fails typed and terminal for %s", async (keyword, code) => {
    const transport = createFixtureTransport(2);
    const created = await transport.submit(input({ homepageUrl: `https://${keyword}.example.co.kr` }));
    await waitUntil(async () => (await transport.get(created.auditId))?.status === "FAILED");
    const done = (await transport.get(created.auditId))!;
    expect(done.error?.code).toBe(code);
    expect(done.error?.class).toBe("TERMINAL");
    expect(done.report).toBeUndefined();
    const eventCount = done.events.length;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect((await transport.get(created.auditId))!.events).toHaveLength(eventCount); // terminal: no zombie events
  });

  it("cancels a running audit and stops emitting", async () => {
    const transport = createFixtureTransport(20);
    const created = await transport.submit(input());
    await waitUntil(async () => ((await transport.get(created.auditId))?.events.length ?? 0) >= 1);
    const cancelled = await transport.cancel(created.auditId);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.error?.code).toBe("CANCELLED");
    expect(cancelled.events.at(-1)?.type).toBe("RUN_CANCELLED");
    const eventCount = cancelled.events.length;
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect((await transport.get(created.auditId))!.events).toHaveLength(eventCount);
  });

  it("recovers persisted state through a new transport instance, as after a refresh", async () => {
    const first = createFixtureTransport(2);
    const created = await first.submit(input());
    await waitUntil(async () => (await first.get(created.auditId))?.status === "FREE_REPORT");
    const reloaded = createFixtureTransport(2);
    const view = await reloaded.get(created.auditId);
    expect(view?.status).toBe("FREE_REPORT");
    expect(view?.report?.findings).toHaveLength(3);
  });

  it("returns null for unknown audits", async () => {
    expect(await createFixtureTransport(2).get("aud_missing")).toBeNull();
  });
});

describe("payment continuation", () => {
  async function completedAudit(transport = createFixtureTransport(2), url = "https://example.co.kr") {
    const created = await transport.submit(input({ homepageUrl: url }));
    await waitUntil(async () => (await transport.get(created.auditId))?.status === "FREE_REPORT");
    return { transport, auditId: created.auditId };
  }

  it("rejects checkout before the free report exists", async () => {
    const transport = createFixtureTransport(50);
    const created = await transport.submit(input());
    await expect(transport.createCheckout(created.auditId)).rejects.toThrow(/free report/i);
  });

  it("is idempotent: repeated checkouts share one payment and create exactly one paid audit", async () => {
    const { transport, auditId } = await completedAudit();
    const one = await transport.createCheckout(auditId);
    const two = await transport.createCheckout(auditId);
    expect(two.paymentId).toBe(one.paymentId);
    await waitUntil(async () => Boolean((await transport.get(auditId))?.paidHermesRunId));
    const done = (await transport.get(auditId))!;
    expect(done.paidAuditId).toBeDefined();
    expect(done.payment?.status).toBe("SUCCEEDED");
    expect(done.events.filter((event) => event.type === "PAYMENT_SUCCEEDED")).toHaveLength(1);
    expect(done.events.filter((event) => event.type === "PAID_RUN_QUEUED")).toHaveLength(1);
    // Free report remains available after continuation starts.
    expect(done.report?.findings).toHaveLength(3);
    expect(done.status).toBe("FREE_REPORT");
  });

  it("holds a truthful pending state while the webhook is delayed", async () => {
    const { transport, auditId } = await completedAudit(createFixtureTransport(30), "https://slow-pay.example.co.kr");
    await transport.createCheckout(auditId);
    const pending = (await transport.get(auditId))!;
    expect(pending.payment?.status).toBe("PENDING_CONFIRMATION");
    expect(pending.paidAuditId).toBeUndefined(); // never claim a paid run before verification
    await waitUntil(async () => (await transport.get(auditId))?.payment?.status === "SUCCEEDED", 8000);
    expect((await transport.get(auditId))!.paidAuditId).toBeDefined();
  });
});
