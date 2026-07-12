import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { createFixtureTransport } from "./data/fixtureTransport";
import type { AuditTransport, AuditView, PaidReport } from "./lib/contracts";

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = "";
});

const fastTransport = () => createFixtureTransport(2);

function staticTransport(view: AuditView): AuditTransport {
  return {
    mode: "LIVE",
    submit: async () => view,
    get: async (id) => id === view.auditId ? view : null,
    subscribe: (_id, onChange) => { onChange(view); return () => {}; },
    cancel: async () => view,
    createCheckout: async () => { throw new Error("not used"); },
    artifactUrl: (auditId, artifactId) => `/api/audits/${auditId}/artifacts/${artifactId}`,
  };
}

const paidPair = {
  pairId: "pair_pricing",
  role: "PRICING" as const,
  sourceUrl: "https://example.com/ko/pricing",
  targetUrl: "https://example.com/en/pricing",
  sourceLocale: "ko-KR" as const,
  targetLocale: "en-US" as const,
  pairingMethod: "HREFLANG" as const,
  sourceScreenshotId: "shot_source",
  targetScreenshotId: "shot_target",
};

const paidBase: AuditView = {
  auditId: "aud_paid_static",
  kind: "PAID",
  parentAuditId: "aud_free_static",
  status: "PAID_RUNNING",
  direction: "KR_TO_US",
  homepageUrl: "https://example.com",
  audience: "US buyers",
  launchGoal: "Increase trials",
  degraded: true,
  selectedPairs: [paidPair],
  startedAt: new Date(Date.now() - 4_000).toISOString(),
  hermesRunId: "run_paid_static",
  events: [{ schemaVersion: "1.0", eventId: "event_capture", auditId: "aud_paid_static", seq: 1, type: "CAPTURE_COMPLETED", actor: "RUNTIME", status: "SUCCEEDED", safeLabel: "Stored two rendered page screenshots", occurredAt: new Date().toISOString() }],
};

async function submitAudit(url = "https://example.co.kr") {
  const user = userEvent.setup();
  const box = screen.getByLabelText("Homepage URL");
  await user.clear(box);
  await user.type(box, url);
  await user.click(screen.getByRole("button", { name: /run my free/i }));
  return user;
}

describe("intake", () => {
  it("labels fixture mode visibly and discloses scope", () => {
    render(<App transport={fastTransport()} />);
    expect(screen.getByText(/demo fixtures — not a live audit/i)).toBeInTheDocument();
    expect(screen.getByText(/one public homepage locale pair/i)).toBeInTheDocument();
  });

  it("blocks malformed and private URLs with an honest scope error", async () => {
    render(<App transport={fastTransport()} />);
    await submitAudit("https://192.168.0.4");
    expect(screen.getByRole("alert")).toHaveTextContent(/out of scope/i);
    await submitAudit("nonsense");
    expect(screen.getByRole("alert")).toHaveTextContent(/complete URL/i);
    expect(screen.queryByText(/hermes live run/i)).not.toBeInTheDocument();
  });

  it("offers both directions with accessible radio semantics", async () => {
    render(<App transport={fastTransport()} />);
    expect(screen.getByRole("radio", { name: /korea → united states/i })).toBeChecked();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /united states → korea/i }));
    expect(screen.getByRole("radio", { name: /united states → korea/i })).toBeChecked();
  });

  it("shows a truthful error when the live audit request cannot start", async () => {
    render(<App transport={{
      mode: "LIVE",
      submit: async () => { throw new Error("The audit service is temporarily unavailable. Please try again."); },
      get: async () => null,
      subscribe: () => () => {},
      cancel: async () => { throw new Error("not used"); },
      createCheckout: async () => { throw new Error("not used"); },
      artifactUrl: () => "about:blank",
    }} />);
    await submitAudit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/temporarily unavailable/i);
  });
});

describe("live run", () => {
  it("shows genuine persisted events ordered by seq, the run id, and the delegation stage", async () => {
    render(<App transport={createFixtureTransport(60)} />);
    await submitAudit();
    expect(await screen.findByText("Reading your page in context.")).toBeInTheDocument();
    const log = await screen.findByRole("log", { name: /persisted run events/i });
    await waitFor(() => expect(log).toHaveTextContent(/delegated bounded visual/i), { timeout: 4000 });
    const seqLabels = Array.from(log.querySelectorAll("small")).map((node) => Number(node.textContent?.match(/#(\d+)/)?.[1]));
    expect(seqLabels).toEqual([...seqLabels].sort((a, b) => a - b));
    expect(screen.getByText(/run_fx_/)).toBeInTheDocument();
    expect(screen.getByText(/only real system events/i)).toBeInTheDocument();
  });

  it("cancels truthfully", async () => {
    render(<App transport={createFixtureTransport(60)} />);
    await submitAudit();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /cancel this audit/i }));
    expect(await screen.findByText(/stopped at your request/i)).toBeInTheDocument();
    expect(screen.getByText("CANCELLED")).toBeInTheDocument();
  });

  it("recovers mid-run state after a refresh (remount from the same audit URL)", async () => {
    const transport = createFixtureTransport(40);
    const { unmount } = render(<App transport={transport} />);
    await submitAudit();
    await screen.findByRole("log", { name: /persisted run events/i });
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent(/#2/), { timeout: 4000 });
    unmount(); // simulate refresh: hash still points at the audit, storage persists
    render(<App transport={createFixtureTransport(40)} />);
    expect(await screen.findByRole("status")).toHaveTextContent(/recovered the latest persisted state/i);
    expect(screen.getByRole("log", { name: /persisted run events/i })).toHaveTextContent(/#1/);
  });
});

describe("failures and degradation", () => {
  it("shows the typed capture failure without inventing a report", async () => {
    render(<App transport={fastTransport()} />);
    await submitAudit("https://capture-fail.example.co.kr");
    expect(await screen.findByText(/we stopped rather than make up a result/i, undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText("CAPTURE_INCOMPLETE")).toBeInTheDocument();
    expect(screen.queryByText(/three highest-leverage fixes/i)).not.toBeInTheDocument();
  });

  it("labels a Linkup-degraded report prominently", async () => {
    render(<App transport={fastTransport()} />);
    await submitAudit("https://degraded.example.co.kr");
    expect(await screen.findByText(/kb-only evidence — live research was unavailable/i, undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/findings rely on the curated golden knowledge base only/i)).toBeInTheDocument();
  });
});

describe("free report", () => {
  it("renders exactly three findings with copy, impact, rationale, confidence, and references", async () => {
    render(<App transport={fastTransport()} />);
    await submitAudit();
    await screen.findByText(/three highest-leverage fixes/i, undefined, { timeout: 4000 });
    const findings = screen.getAllByRole("article");
    expect(findings).toHaveLength(3);
    for (const finding of findings) {
      expect(finding).toHaveTextContent(/current/i);
      expect(finding).toHaveTextContent(/recommend/i);
      expect(finding).toHaveTextContent(/why this matters/i);
      expect(finding).toHaveTextContent(/% confidence/);
      expect(finding).toHaveTextContent(/gold_/);
    }
    expect(screen.getByText("evi_us_b2b_01/web_1")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /captured html text snapshot/i })).toHaveLength(2);
    expect(screen.getByText(/html text snapshots document the audited state/i)).toBeInTheDocument();
  });
});

describe("paywall and paid continuation", () => {
  it("[PUI-01][PPAY-03] walks checkout → child route → screenshot-rich paid report without a stale CTA", async () => {
    render(<App transport={fastTransport()} />);
    const user = await submitAudit();
    await screen.findByText(/three highest-leverage fixes/i, undefined, { timeout: 4000 });
    await user.click(screen.getByRole("button", { name: /unlock two more surfaces/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/exactly one new hermes run/i);
    await user.click(screen.getByRole("button", { name: /continue to dodo checkout/i }));
    expect(await screen.findByText(/paid deep audit · complete/i, undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(window.location.hash).toMatch(/^#\/audit\/aud_fx_paid_/);
    expect(screen.getAllByRole("img", { name: /page in (ko-KR|en-US)/i })).toHaveLength(4);
    expect(screen.getAllByRole("article", { name: /finding/i })).toHaveLength(6);
    expect(screen.getByText(/two additional public locale pairs/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /unlock two more surfaces/i })).not.toBeInTheDocument();
  });

  it("[PUI-01][PPAY-03] recovers a paid report directly from its child route after refresh", async () => {
    const transport = fastTransport();
    const { unmount } = render(<App transport={transport} />);
    const user = await submitAudit();
    await screen.findByText(/three highest-leverage fixes/i, undefined, { timeout: 4000 });
    await user.click(screen.getByRole("button", { name: /unlock two more surfaces/i }));
    await user.click(await screen.findByRole("button", { name: /continue to dodo checkout/i }));
    await screen.findByText(/paid deep audit · complete/i, undefined, { timeout: 5000 });
    const childHash = window.location.hash;
    unmount();
    render(<App transport={createFixtureTransport(2)} />);
    expect(window.location.hash).toBe(childHash);
    expect(await screen.findByText(/paid deep audit · complete/i)).toBeInTheDocument();
    expect(screen.getAllByRole("article", { name: /finding/i })).toHaveLength(6);
  });

  it("keeps a truthful delayed-webhook state before claiming a paid run", async () => {
    render(<App transport={createFixtureTransport(60)} />);
    const user = await submitAudit("https://slow-pay.example.co.kr");
    await screen.findByText(/three highest-leverage fixes/i, undefined, { timeout: 6000 });
    await user.click(screen.getByRole("button", { name: /unlock two more surfaces/i }));
    await user.click(await screen.findByRole("button", { name: /continue to dodo checkout/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/waiting for the signed webhook/i);
    expect(screen.queryByText(/payment verified/i)).not.toBeInTheDocument();
  });

  it("[PUI-02] renders one-pair genuine progress, degraded evidence, elapsed time, and parent navigation without premature screenshots", async () => {
    window.location.hash = `#/audit/${paidBase.auditId}`;
    render(<App transport={staticTransport(paidBase)} />);
    expect(await screen.findByText(/hermes is auditing the next surfaces/i)).toBeInTheDocument();
    expect(screen.getByText(/live market evidence is degraded/i)).toBeInTheDocument();
    expect(screen.getByRole("log", { name: /paid audit events/i })).toHaveTextContent(/stored two rendered page screenshots/i);
    expect(screen.getByText("PRICING")).toBeInTheDocument();
    expect(screen.getByText(/4s|5s/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /free homepage report/i })).toHaveAttribute("href", "#/audit/aud_free_static");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("[PUI-02] renders reduced one-pair/one-finding output and an honest missing-artifact state", async () => {
    const paidReport: PaidReport = {
      schemaVersion: "1.0", jobType: "PAID", reportId: "report_static", auditId: paidBase.auditId, parentAuditId: paidBase.parentAuditId!,
      title: "Pricing now earns trust before it asks for commitment.", executiveSummary: "One page pair was safely available, so the report remains intentionally bounded.", auditedPairIds: [paidPair.pairId],
      findings: [{ findingId: "finding_static", rank: 1, pairId: paidPair.pairId, targetUrl: paidPair.targetUrl, screenshotArtifactId: "shot_target", componentType: "PRIMARY_CTA", issueType: "CTA_MARKET_FIT", severity: "HIGH", componentRef: { kind: "ACCESSIBILITY_NAME", value: "Pricing CTA" }, sourceCopy: "시작하기", currentTargetCopy: "Start", proposedTargetCopy: "Compare plans for your team", businessImpact: "Clarifies the next decision.", rationale: "The CTA now matches the visible comparison context.", confidence: .91, evidenceRefs: [], kbRefs: ["gold_pricing_cta"] }],
      limitations: ["Only one complete locale pair was safely captured."], liveMarketEvidence: "DEGRADED", generation: { hermesRunId: "run_paid_static", contractVersion: "1.0", promptVersion: "v1", skillVersion: "v1", kbVersion: "v1" }, generatedAt: new Date().toISOString(),
    };
    const view: AuditView = { ...paidBase, status: "PAID_REPORT", selectedPairs: [{ ...paidPair, sourceScreenshotId: undefined }], paidReport };
    window.location.hash = `#/audit/${view.auditId}`;
    render(<App transport={staticTransport(view)} />);
    expect(await screen.findByText(/1 additional page pair/i)).toBeInTheDocument();
    expect(screen.getAllByRole("article", { name: /finding/i })).toHaveLength(1);
    expect(screen.getByRole("img", { name: /source page.*unavailable/i })).toHaveTextContent(/screenshot unavailable/i);
    expect(screen.getByRole("img", { name: /target page/i })).toHaveAttribute("src", `/api/audits/${view.auditId}/artifacts/shot_target`);
    fireEvent.error(screen.getByRole("img", { name: /target page/i }));
    expect(screen.getByRole("img", { name: /target page.*unavailable/i })).toHaveTextContent(/screenshot unavailable/i);
    expect(screen.getByText(/only one complete locale pair/i)).toBeInTheDocument();
  });
});
