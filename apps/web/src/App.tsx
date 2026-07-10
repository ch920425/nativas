import { FormEvent, useMemo, useState } from "react";
import { fixtureTransport } from "./data/fixtureTransport";
import type { AuditError, AuditView, Direction, IntakeInput } from "./lib/contracts";

type Screen = "intake" | "run" | "report" | "failed" | "paid";

const directionLabels: Record<Direction, string> = {
  KR_TO_US: "Korea → United States",
  US_TO_KR: "United States → Korea",
};

export function App() {
  const [screen, setScreen] = useState<Screen>("intake");
  const [audit, setAudit] = useState<AuditView | null>(null);
  const [isFixture, setIsFixture] = useState(true);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  async function submit(input: IntakeInput) {
    const created = await fixtureTransport.submit(input);
    setAudit(created);
    setScreen("run");
    window.setTimeout(async () => {
      const complete = await fixtureTransport.get(created.auditId);
      setAudit({ ...complete, auditId: created.auditId, homepageUrl: input.homepageUrl, direction: input.direction });
      setScreen("report");
    }, 1200);
  }

  async function refresh() {
    if (!audit) return;
    const current = await fixtureTransport.get(audit.auditId);
    setAudit({ ...current, auditId: audit.auditId, homepageUrl: audit.homepageUrl, direction: audit.direction });
    setRefreshNote("Recovered the latest persisted state. Events are ordered by their server sequence.");
  }

  async function beginCheckout() {
    if (!audit) return;
    await fixtureTransport.createCheckout(audit.auditId);
    setAudit({ ...audit, status: "PAID_RUNNING", paidAuditId: "aud_paid_demo_01" });
    setScreen("paid");
  }

  return <div className="shell">
    <header className="topbar">
      <button className="wordmark" onClick={() => setScreen("intake")} aria-label="nativas.ai home">nativas<span>.ai</span></button>
      <div className="header-side"><span className={isFixture ? "fixture" : "live"}>{isFixture ? "Demo fixtures" : "Live"}</span><button className="text-button" onClick={() => setIsFixture(!isFixture)}>{isFixture ? "Preview mode" : "Live mode"}</button></div>
    </header>
    <main>
      {screen === "intake" && <Intake onSubmit={submit} />}
      {screen === "run" && audit && <LiveRun audit={audit} onRefresh={refresh} refreshNote={refreshNote} />}
      {screen === "report" && audit?.report && <Report audit={audit} onCheckout={beginCheckout} />}
      {screen === "paid" && audit && <PaidStart audit={audit} />}
      {screen === "failed" && <Failure error={{ code: "CAPTURE_INCOMPLETE", class: "TERMINAL", message: "The public locale pair could not be captured completely." }} onReset={() => setScreen("intake")} />}
    </main>
    <footer>Context-aware localization audits for public KR ↔ US websites. No website changes are made.</footer>
  </div>;
}

function Intake({ onSubmit }: { onSubmit(input: IntakeInput): Promise<void> }) {
  const [url, setUrl] = useState("https://example.co.kr");
  const [direction, setDirection] = useState<Direction>("KR_TO_US");
  const [audience, setAudience] = useState("US startup operators");
  const [goal, setGoal] = useState("Increase qualified demo requests");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported protocol");
      setError(""); setSubmitting(true);
      await onSubmit({ homepageUrl: url, direction, audience, launchGoal: goal });
    } catch { setError("Enter a complete public http(s) URL. Private, authenticated, and app-only surfaces are out of scope."); }
    finally { setSubmitting(false); }
  }
  return <section className="intake page-grid">
    <div className="intro"><p className="eyebrow">AI AS AGENCY · KR ↔ US</p><h1>Localize the meaning, not just the words.</h1><p className="lede">nativas.ai sends a Hermes-led agency through one public homepage pair, then returns the three copy decisions most likely to make your launch feel native.</p><div className="promise"><span>01</span><p>Visual context from paired screenshots</p><span>02</span><p>Bounded live market research</p><span>03</span><p>Three clear, evidence-linked changes</p></div></div>
    <form className="intake-card" onSubmit={handleSubmit}>
      <div className="form-heading"><span className="step">01 / Intake</span><h2>Start a homepage audit</h2><p>We assess one public homepage locale pair. No login, crawl, or site changes.</p></div>
      <label>Homepage URL<input aria-label="Homepage URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://yourcompany.com" required /></label>
      <fieldset><legend>Localization direction</legend><div className="segmented">{(Object.keys(directionLabels) as Direction[]).map(value => <button type="button" key={value} aria-pressed={direction === value} onClick={() => setDirection(value)}>{directionLabels[value]}</button>)}</div></fieldset>
      <label>Who are you trying to reach?<input value={audience} onChange={e => setAudience(e.target.value)} /></label>
      <label>What should this page achieve?<input value={goal} onChange={e => setGoal(e.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary" disabled={submitting}>{submitting ? "Starting Hermes…" : "Run my free homepage audit"}<span>↗</span></button>
      <p className="fine-print">Free preview: one locale pair, exactly three findings. A full public-site audit is offered only after you see the report.</p>
    </form>
  </section>;
}

function LiveRun({ audit, onRefresh, refreshNote }: { audit: AuditView; onRefresh(): Promise<void>; refreshNote: string | null }) {
  const events = useMemo(() => [...audit.events].sort((a, b) => a.seq - b.seq), [audit.events]);
  return <section className="run-page narrow"><div className="run-head"><div><p className="eyebrow">HERMES LIVE RUN</p><h1>Reading your page in context.</h1><p>{audit.homepageUrl} · {directionLabels[audit.direction]}</p></div><button className="secondary" onClick={onRefresh}>Refresh persisted state</button></div>
    {refreshNote && <p className="recovery" role="status">{refreshNote}</p>}
    <div className="run-layout"><div className="run-card"><div className="run-card-head"><span className="pulse" aria-hidden="true" /> <strong>{audit.status === "FREE_RUNNING" ? "Hermes is working" : "Run state recovered"}</strong><small>{audit.hermesRunId ?? "Run ID pending"}</small></div><ol className="timeline">{events.map(event => <li key={event.eventId}><span className={`event-dot ${event.status.toLowerCase()}`} /><div><p>{event.safeLabel}</p><small>#{event.seq} · {event.actor.replace("_", " ")} {event.toolName ? `· ${event.toolName}` : ""}</small></div><time>{event.occurredAt}</time></li>)}</ol></div>
    <aside className="truth-card"><p className="eyebrow">What you are seeing</p><h2>Only real system events.</h2><p>We show normalized Hermes and runtime events once they are persisted. We do not guess child progress or invent activity between events.</p><dl><div><dt>Audit</dt><dd>{audit.auditId}</dd></div><div><dt>Evidence</dt><dd>Screenshot + HTML + text + accessibility tree</dd></div></dl></aside></div></section>;
}

function Report({ audit, onCheckout }: { audit: AuditView; onCheckout(): Promise<void> }) {
  const report = audit.report!;
  return <section className="report-page"><div className="report-hero"><p className="eyebrow">FREE HOMEPAGE AUDIT · COMPLETE</p><h1>{report.title}</h1><p className="lede">{report.executiveSummary}</p><div className="report-meta"><span>{report.sourceLocale} → {report.targetLocale}</span><span>{audit.hermesRunId}</span><span className={report.liveMarketEvidence === "AVAILABLE" ? "live" : "fixture"}>{report.liveMarketEvidence === "AVAILABLE" ? "Live market evidence" : "KB-only evidence"}</span></div></div>
    <section className="pair" aria-label="Paired screenshot evidence"><div className="screen-card source"><div className="browser"><i/><i/><i/><span>{report.sourceUrl}</span></div><div className="screen-content korean"><b>팀의 모든 일이<br/>한 곳에서</b><p>더 빠르게 협업하고,<br/>중요한 일에 집중하세요.</p><button>무료로 시작하기</button></div><p>{report.screenshotLabels[0]}</p></div><div className="pair-arrow" aria-hidden="true">→</div><div className="screen-card target"><div className="browser"><i/><i/><i/><span>{report.targetUrl}</span></div><div className="screen-content"><b>Give every team one clear place<br/>to move work forward.</b><p>Build better workflows. Stay focused on what matters.</p><button>See how your team works better</button></div><p>{report.screenshotLabels[1]}</p></div></section>
    <section className="findings"><div className="findings-head"><div><p className="eyebrow">THE THREE HIGHEST-LEVERAGE FIXES</p><h2>What to change, and why it earns its place.</h2></div><p>Every suggestion is tied to the captured page and bounded source material.</p></div>{report.findings.map(finding => <article className="finding" key={finding.findingId}><div className="rank">0{finding.rank}</div><div className="finding-main"><div className="finding-label"><span>{finding.componentType.replaceAll("_", " ")}</span><span className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</span></div><div className="copy-compare"><p><small>Current</small>{finding.currentTargetCopy}</p><p><small>Recommend</small>{finding.proposedTargetCopy}</p></div><p className="impact"><strong>Why this matters:</strong> {finding.businessImpact}</p></div><aside><p>{finding.rationale}</p><div className="refs"><span>{Math.round(finding.confidence * 100)}% confidence</span><span>{finding.evidenceRefs[0].packId}/{finding.evidenceRefs[0].evidenceId}</span><span>{finding.kbRefs[0]}</span></div></aside></article>)}</section>
    <section className="upgrade"><div><p className="eyebrow">GO DEEPER WHEN YOU’RE READY</p><h2>Audit the rest of your public site with the same context.</h2><p>We’ll start a new, capped Hermes run for two additional content surfaces—each compared as one source/target locale pair. Your free findings become its starting context.</p></div><button className="primary" onClick={onCheckout}>Unlock two more surfaces <span>↗</span></button></section>
    <section className="limitations"><h2>Scope and evidence</h2>{report.limitations.map(item => <p key={item}>• {item}</p>)}</section>
  </section>;
}

function PaidStart({ audit }: { audit: AuditView }) { return <section className="paid-page narrow"><p className="eyebrow">PAYMENT VERIFIED</p><h1>Your deeper audit has started.</h1><p className="lede">A new Hermes run is now assessing up to two additional public content surfaces, each as a source/target locale pair.</p><div className="paid-state"><span className="pulse"/><div><strong>Paid run queued and observed</strong><p>{audit.paidAuditId} · linked to {audit.auditId}</p></div><span className="tag">{audit.status}</span></div><p className="fine-print">P0 ends here: payment created one linked paid audit and its Hermes run is active. A finished paid report is the next delivery.</p></section> }

function Failure({ error, onReset }: { error: AuditError; onReset(): void }) { return <section className="failure narrow"><p className="eyebrow">AUDIT COULDN’T CONTINUE</p><h1>We stopped rather than make up a result.</h1><p className="lede">{error.message}</p><code>{error.code}</code><button className="primary" onClick={onReset}>Try another public homepage</button></section> }
