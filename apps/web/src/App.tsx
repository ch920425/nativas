import { Dialog } from "@base-ui/react/dialog";
import { Field } from "@base-ui/react/field";
import { Fieldset } from "@base-ui/react/fieldset";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createTransport } from "./data/transport";
import type { AuditTransport, AuditView, Direction, IntakeInput } from "./lib/contracts";
import { validatePublicHttpUrl } from "./lib/validateUrl";

const directionLabels: Record<Direction, string> = {
  KR_TO_US: "Korea → United States",
  US_TO_KR: "United States → Korea",
};

type Screen = "intake" | "run" | "report" | "paid" | "failed";

function screenFor(audit: AuditView | null): Screen {
  if (!audit) return "intake";
  switch (audit.status) {
    case "SUBMITTED":
    case "ELIGIBILITY_CHECK":
    case "FREE_RUNNING":
      return "run";
    case "FREE_REPORT":
      return audit.payment?.status === "SUCCEEDED" && audit.paidAuditId ? "paid" : "report";
    case "PAID_QUEUED":
    case "PAID_RUNNING":
      return "paid";
    default:
      return "failed";
  }
}

function auditIdFromHash(): string | null {
  const match = window.location.hash.match(/^#\/audit\/(.+)$/);
  return match ? match[1] : null;
}

export function App({ transport = createTransport() }: { transport?: AuditTransport }) {
  const [audit, setAudit] = useState<AuditView | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const id = auditIdFromHash();
    if (!id) return;
    let unsubscribe = () => {};
    transport.get(id).then((view) => {
      if (!view) { setNotFound(true); return; }
      setAudit(view);
      if (view.events.length > 0) setRecovered(true);
      unsubscribe = transport.subscribe(id, setAudit);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(input: IntakeInput) {
    const created = await transport.submit(input);
    window.location.hash = `#/audit/${created.auditId}`;
    setRecovered(false);
    setAudit(created);
    transport.subscribe(created.auditId, setAudit);
  }

  function reset() {
    window.location.hash = "";
    setAudit(null);
    setRecovered(false);
    setNotFound(false);
  }

  const screen = screenFor(audit);

  return (
    <div className="shell root">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="topbar">
        <button className="wordmark" onClick={reset} aria-label="nativas.ai home">nativas<span>.ai</span></button>
        <div className="header-side">
          {transport.mode === "FIXTURE" && <span className="fixture">Demo fixtures — not a live audit</span>}
          {transport.mode === "LIVE" && <span className="live">Live</span>}
        </div>
      </header>
      <main id="main">
        {notFound && <ErrorPanel title="We couldn't find that audit." body="The link may be stale. Start a new free homepage audit." onReset={reset} />}
        {!notFound && screen === "intake" && <Intake onSubmit={submit} />}
        {screen === "run" && audit && (
          <LiveRun
            audit={audit}
            recovered={recovered}
            onCancel={async () => setAudit(await transport.cancel(audit.auditId))}
          />
        )}
        {screen === "report" && audit?.report && (
          <Report audit={audit} onCheckout={async () => {
            const session = await transport.createCheckout(audit.auditId);
            window.location.assign(session.checkoutUrl);
          }} />
        )}
        {screen === "paid" && audit && <PaidStart audit={audit} />}
        {screen === "failed" && audit && <Failure audit={audit} onReset={reset} />}
      </main>
      <footer>Context-aware localization audits for public KR ↔ US websites. No website changes are made.</footer>
    </div>
  );
}

function Intake({ onSubmit }: { onSubmit(input: IntakeInput): Promise<void> }) {
  const [direction, setDirection] = useState<Direction>("KR_TO_US");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const url = String(data.get("homepageUrl") ?? "");
    const checked = validatePublicHttpUrl(url);
    if (!checked.ok) { setError(checked.reason); return; }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        homepageUrl: url,
        direction,
        audience: String(data.get("audience") ?? ""),
        launchGoal: String(data.get("launchGoal") ?? ""),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn't start the audit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="intake page-grid" aria-labelledby="intake-heading">
      <div className="intro">
        <p className="eyebrow">AI AS AGENCY · KR ↔ US</p>
        <h1 id="intake-heading">Localize the meaning, not just the words.</h1>
        <p className="lede">nativas.ai sends a Hermes-led agency through one public homepage pair, then returns the three copy decisions most likely to make your launch feel native.</p>
        <div className="promise">
          <span>01</span><p>Visual context from paired screenshots</p>
          <span>02</span><p>Bounded live market research</p>
          <span>03</span><p>Three clear, evidence-linked changes</p>
        </div>
      </div>
      <form className="intake-card" onSubmit={handleSubmit} noValidate>
        <div className="form-heading">
          <span className="step">01 / Intake</span>
          <h2>Start a homepage audit</h2>
          <p>We assess one public homepage locale pair. No login, crawl, or site changes.</p>
        </div>
        <Field.Root name="homepageUrl" className="field">
          <Field.Label className="field-label">Homepage URL</Field.Label>
          <Field.Control required type="url" placeholder="https://yourcompany.com" defaultValue="https://example.co.kr" className="field-input" />
        </Field.Root>
        <Fieldset.Root className="field" render={<fieldset />}>
          <Fieldset.Legend className="field-label">Localization direction</Fieldset.Legend>
          <RadioGroup value={direction} onValueChange={(value) => setDirection(value as Direction)} className="segmented">
            {(Object.keys(directionLabels) as Direction[]).map((value) => (
              <label key={value} className="segmented-option">
                <Radio.Root value={value} className="segmented-radio">
                  <Radio.Indicator className="segmented-indicator" />
                </Radio.Root>
                <span>{directionLabels[value]}</span>
              </label>
            ))}
          </RadioGroup>
        </Fieldset.Root>
        <Field.Root name="audience" className="field">
          <Field.Label className="field-label">Who are you trying to reach?</Field.Label>
          <Field.Control defaultValue="US startup operators" className="field-input" />
        </Field.Root>
        <Field.Root name="launchGoal" className="field">
          <Field.Label className="field-label">What should this page achieve?</Field.Label>
          <Field.Control defaultValue="Increase qualified demo requests" className="field-input" />
        </Field.Root>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary" disabled={submitting}>{submitting ? "Starting Hermes…" : "Run my free homepage audit"}<span aria-hidden="true">↗</span></button>
        <p className="fine-print">Free preview: one locale pair, exactly three findings. A deeper audit is offered only after you see the report.</p>
      </form>
    </section>
  );
}

function LiveRun({ audit, recovered, onCancel }: { audit: AuditView; recovered: boolean; onCancel(): Promise<void> }) {
  const events = useMemo(() => [...audit.events].sort((a, b) => a.seq - b.seq), [audit.events]);
  return (
    <section className="run-page narrow" aria-labelledby="run-heading">
      <div className="run-head">
        <div>
          <p className="eyebrow">HERMES LIVE RUN</p>
          <h1 id="run-heading">Reading your page in context.</h1>
          <p>{audit.homepageUrl} · {directionLabels[audit.direction]}</p>
        </div>
        <button className="secondary" onClick={onCancel}>Cancel this audit</button>
      </div>
      {recovered && <p className="recovery" role="status">Recovered the latest persisted state after refresh. Events are ordered by their server sequence.</p>}
      <div className="run-layout">
        <div className="run-card">
          <div className="run-card-head">
            <span className="pulse" aria-hidden="true" />
            <strong>{audit.status === "FREE_RUNNING" ? "Hermes is working" : "Preparing the run"}</strong>
            <small>{audit.hermesRunId ?? "Run ID pending"}</small>
          </div>
          {events.length === 0 && <p className="empty-note">Waiting for the first persisted event…</p>}
          <ol className="timeline" role="log" aria-live="polite" aria-label="Persisted run events">
            {events.map((event) => (
              <li key={event.eventId}>
                <span className={`event-dot ${event.status.toLowerCase()}`} aria-hidden="true" />
                <div>
                  <p>{event.safeLabel}</p>
                  <small>#{event.seq} · {event.actor.replace("_", " ").toLowerCase()}{event.toolName ? ` · ${event.toolName}` : ""}</small>
                </div>
                <time dateTime={event.occurredAt}>{event.occurredAt.slice(11, 19)}</time>
              </li>
            ))}
          </ol>
        </div>
        <aside className="truth-card" aria-label="What you are seeing">
          <p className="eyebrow">What you are seeing</p>
          <h2>Only real system events.</h2>
          <p>We show normalized Hermes and runtime events once they are persisted, ordered by server sequence. We do not guess child progress or invent activity between events.</p>
          <dl>
            <div><dt>Audit</dt><dd>{audit.auditId}</dd></div>
            <div><dt>Evidence per page</dt><dd>Screenshot · HTML · text · accessibility tree</dd></div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

function Report({ audit, onCheckout }: { audit: AuditView; onCheckout(): Promise<void> }) {
  const report = audit.report!;
  const degraded = report.liveMarketEvidence === "DEGRADED";
  const paymentPending = audit.payment?.status === "PENDING_CONFIRMATION";
  return (
    <section className="report-page" aria-labelledby="report-heading">
      <div className="report-hero">
        <p className="eyebrow">FREE HOMEPAGE AUDIT · COMPLETE</p>
        <h1 id="report-heading">{report.title}</h1>
        <p className="lede">{report.executiveSummary}</p>
        <div className="report-meta">
          <span>{report.sourceLocale} → {report.targetLocale}</span>
          <span>{audit.hermesRunId}</span>
          <span className={degraded ? "fixture" : "live"}>{degraded ? "KB-only evidence — live research was unavailable" : "Live market evidence"}</span>
        </div>
      </div>
      <section className="pair" aria-label="Paired screenshot evidence">
        <figure className="screen-card source">
          <div className="browser" aria-hidden="true"><i /><i /><i /><span>{report.sourceUrl}</span></div>
          <div className="screen-content korean" role="img" aria-label={`${report.visualEvidence.mode === "SCREENSHOT" ? "Captured screenshot" : "Captured HTML text snapshot"}: ${report.screenshotLabels[0]}`}>
            <b>{report.visualEvidence.source.headline}</b>
            <p>{report.visualEvidence.source.supportingCopy}</p>
            <button type="button" tabIndex={-1}>{report.visualEvidence.source.cta}</button>
          </div>
          <figcaption>{report.screenshotLabels[0]}</figcaption>
        </figure>
        <div className="pair-arrow" aria-hidden="true">→</div>
        <figure className="screen-card target">
          <div className="browser" aria-hidden="true"><i /><i /><i /><span>{report.targetUrl}</span></div>
          <div className="screen-content" role="img" aria-label={`${report.visualEvidence.mode === "SCREENSHOT" ? "Captured screenshot" : "Captured HTML text snapshot"}: ${report.screenshotLabels[1]}`}>
            <b>{report.visualEvidence.target.headline}</b>
            <p>{report.visualEvidence.target.supportingCopy}</p>
            <button type="button" tabIndex={-1}>{report.visualEvidence.target.cta}</button>
          </div>
          <figcaption>{report.screenshotLabels[1]}</figcaption>
        </figure>
      </section>
      <section className="findings" aria-label="The three findings">
        <div className="findings-head">
          <div>
            <p className="eyebrow">THE THREE HIGHEST-LEVERAGE FIXES</p>
            <h2>What to change, and why it earns its place.</h2>
          </div>
          <p>Every suggestion is tied to the captured page and bounded source material.</p>
        </div>
        {report.findings.map((finding) => (
          <article className="finding" key={finding.findingId} aria-label={`Finding ${finding.rank}`}>
            <div className="rank" aria-hidden="true">0{finding.rank}</div>
            <div className="finding-main">
              <div className="finding-label">
                <span>{finding.componentType.replaceAll("_", " ")}</span>
                <span className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</span>
                <span className="component-ref">{finding.componentRef.value}</span>
              </div>
              <div className="copy-compare">
                <p><small>Current</small>{finding.currentTargetCopy}</p>
                <p><small>Recommend</small>{finding.proposedTargetCopy}</p>
              </div>
              <p className="impact"><strong>Why this matters:</strong> {finding.businessImpact}</p>
            </div>
            <aside>
              <p>{finding.rationale}</p>
              <div className="refs">
                <span>{Math.round(finding.confidence * 100)}% confidence</span>
                {finding.evidenceRefs.map((ref) => <span key={ref.evidenceId}>{ref.packId}/{ref.evidenceId}</span>)}
                {finding.kbRefs.map((ref) => <span key={ref}>{ref}</span>)}
              </div>
            </aside>
          </article>
        ))}
      </section>
      <section className="upgrade" aria-label="Paid continuation">
        <div>
          <p className="eyebrow">GO DEEPER WHEN YOU'RE READY</p>
          <h2>Audit two more content surfaces with the same context.</h2>
          <p>We'll start one new, capped Hermes run for up to two additional public content surfaces—each compared as one source/target locale pair. Your free findings become its starting context.</p>
        </div>
        {paymentPending ? (
          <p className="recovery" role="status">Payment received by Dodo — waiting for the signed webhook to confirm before starting your paid run. This page updates automatically.</p>
        ) : (
          <CheckoutDialog onConfirm={onCheckout} />
        )}
      </section>
      <section className="limitations" aria-label="Scope and evidence">
        <h2>Scope and evidence</h2>
        {report.limitations.map((item) => <p key={item}>• {item}</p>)}
      </section>
    </section>
  );
}

function CheckoutDialog({ onConfirm }: { onConfirm(): Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="primary">Unlock two more surfaces <span aria-hidden="true">↗</span></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Popup className="dialog-popup">
          <Dialog.Title className="dialog-title">Start the paid continuation</Dialog.Title>
          <Dialog.Description className="dialog-description">
            One-time Dodo checkout. After the signed webhook verifies your payment, exactly one new Hermes run
            starts automatically, covering up to two additional public content surfaces (each one source/target
            locale pair, up to six findings). No subscription, no site changes.
          </Dialog.Description>
          {error && <p className="recovery" role="alert">{error}</p>}
          <div className="dialog-actions">
            <Dialog.Close className="secondary">Not now</Dialog.Close>
            <button
              className="primary"
              disabled={launching}
              onClick={async () => {
                setLaunching(true);
                setError("");
                try {
                  await onConfirm();
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Dodo checkout could not be opened. Please try again.");
                  setLaunching(false);
                }
              }}
            >
              {launching ? "Opening Dodo checkout…" : "Continue to Dodo checkout"}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaidStart({ audit }: { audit: AuditView }) {
  const running = Boolean(audit.paidHermesRunId);
  return (
    <section className="paid-page narrow" aria-labelledby="paid-heading">
      <p className="eyebrow">PAYMENT VERIFIED</p>
      <h1 id="paid-heading">{running ? "Your deeper audit is running." : "Your deeper audit is queued."}</h1>
      <p className="lede">One new Hermes run {running ? "is now assessing" : "will assess"} up to two additional public content surfaces, each as a source/target locale pair.</p>
      <div className="paid-state">
        <span className="pulse" aria-hidden="true" />
        <div>
          <strong>{running ? "Paid run queued and observed running" : "Paid audit created — waiting for the run to be observed"}</strong>
          <p>{audit.paidAuditId} · linked to {audit.auditId}{audit.paidHermesRunId ? ` · ${audit.paidHermesRunId}` : ""}</p>
        </div>
        <span className="tag">{running ? "PAID_RUNNING" : "PAID_QUEUED"}</span>
      </div>
      <p className="fine-print">P0 ends here: your verified payment created exactly one linked paid audit and its Hermes run {running ? "is active" : "is starting"}. The finished paid report is the next delivery.</p>
    </section>
  );
}

function Failure({ audit, onReset }: { audit: AuditView; onReset(): void }) {
  const cancelled = audit.status === "CANCELLED";
  const error = audit.error ?? { code: "HERMES_RUN_FAILED" as const, class: "TERMINAL" as const, message: "The run stopped before publishing a report." };
  return (
    <section className="failure narrow" aria-labelledby="failure-heading">
      <p className="eyebrow">{cancelled ? "AUDIT CANCELLED" : "AUDIT COULDN'T CONTINUE"}</p>
      <h1 id="failure-heading">{cancelled ? "Stopped at your request." : "We stopped rather than make up a result."}</h1>
      <p className="lede">{error.message}</p>
      <code>{error.code}</code>
      <div>
        <button className="primary" onClick={onReset}>Try another public homepage</button>
      </div>
    </section>
  );
}

function ErrorPanel({ title, body, onReset }: { title: string; body: string; onReset(): void }) {
  return (
    <section className="failure narrow">
      <h1>{title}</h1>
      <p className="lede">{body}</p>
      <button className="primary" onClick={onReset}>Start over</button>
    </section>
  );
}
