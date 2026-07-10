import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { createFixtureTransport } from "./data/fixtureTransport";

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = "";
});

const fastTransport = () => createFixtureTransport(2);

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
  it("walks checkout → verified payment → truthful paid-run start", async () => {
    render(<App transport={fastTransport()} />);
    const user = await submitAudit();
    await screen.findByText(/three highest-leverage fixes/i, undefined, { timeout: 4000 });
    await user.click(screen.getByRole("button", { name: /unlock two more surfaces/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/exactly one new hermes run/i);
    await user.click(screen.getByRole("button", { name: /continue to dodo checkout/i }));
    expect(await screen.findByText(/payment verified/i, undefined, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("PAID_RUNNING")).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByText(/aud_fx_paid_/)).toBeInTheDocument();
    expect(screen.getByText(/linked to aud_fx_/)).toBeInTheDocument();
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
});
