import { describe, expect, it, vi } from "vitest";
import type { AuditView } from "../lib/contracts";
import { createLiveTransport } from "./liveTransport";

const baseView: AuditView = {
  auditId: "aud_live_1",
  status: "SUBMITTED",
  direction: "KR_TO_US",
  homepageUrl: "https://example.com",
  audience: "US buyers",
  launchGoal: "Increase demos",
  degraded: false,
  events: [],
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("live HTTP transport", () => {
  it("uses the localhost API contract for submit, get, cancel, and checkout", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/audits") && init?.method === "POST") return response(baseView, 201);
      if (url.endsWith("/api/audits/aud_live_1") && !init?.method) return response(baseView);
      if (url.endsWith("/cancel")) return response({ ...baseView, status: "CANCELLED" });
      if (url.endsWith("/checkout")) return response({ checkoutUrl: "http://localhost/checkout", paymentId: "pay_local_1" });
      return response({ error: "not found" }, 404);
    });
    const transport = createLiveTransport("http://127.0.0.1:8787", { fetchImpl, pollMs: 5 });

    await expect(transport.submit({ homepageUrl: baseView.homepageUrl, direction: "KR_TO_US", audience: "US buyers", launchGoal: "Increase demos" })).resolves.toMatchObject({ auditId: "aud_live_1" });
    await expect(transport.get("aud_live_1")).resolves.toMatchObject({ status: "SUBMITTED" });
    await expect(transport.cancel("aud_live_1")).resolves.toMatchObject({ status: "CANCELLED" });
    await expect(transport.createCheckout("aud_live_1")).resolves.toEqual({ checkoutUrl: "http://localhost/checkout", paymentId: "pay_local_1" });
    expect(transport.mode).toBe("LIVE");
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("polls until a terminal report and then stops", async () => {
    const states: AuditView[] = [
      { ...baseView, status: "FREE_RUNNING" },
      { ...baseView, status: "FREE_REPORT" },
    ];
    const fetchImpl = vi.fn(async () => response(states.shift() ?? { ...baseView, status: "FREE_REPORT" }));
    const transport = createLiveTransport("http://127.0.0.1:8787", { fetchImpl, pollMs: 5 });
    const seen: string[] = [];

    const unsubscribe = transport.subscribe("aud_live_1", (view) => seen.push(view.status));
    await vi.waitFor(() => expect(seen).toEqual(["FREE_RUNNING", "FREE_REPORT"]));
    const callsAtTerminal = fetchImpl.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchImpl).toHaveBeenCalledTimes(callsAtTerminal);
    unsubscribe();
  });

  it("returns null only for a real 404 and surfaces other API failures", async () => {
    const notFound = createLiveTransport("http://127.0.0.1:8787", { fetchImpl: async () => response({ error: "missing" }, 404) });
    await expect(notFound.get("missing")).resolves.toBeNull();

    const failed = createLiveTransport("http://127.0.0.1:8787", { fetchImpl: async () => response({ error: "gateway down" }, 503) });
    await expect(failed.get("aud_live_1")).rejects.toThrow("gateway down");
  });
});
