import { createHash } from "node:crypto";
import { canTransition, localesFor, validateReport, type AgentEvent, type Audit, type AuditStatus, type Direction, type Report } from "../../../packages/contracts/src/index.ts";

export class StateConflict extends Error {}

type Refs = { artifacts: ReadonlySet<string>; evidence: ReadonlySet<string>; golden: ReadonlySet<string> };

export class MemoryAuditStore {
  readonly audits = new Map<string, Audit>();
  readonly events = new Map<string, AgentEvent[]>();
  private readonly eventIds = new Set<string>();
  private readonly reports = new Map<string, Report>();
  private readonly reportKeys = new Map<string, string>();
  private readonly paymentEvents = new Map<string, string>();

  createFree(publicId: string, homepageUrl: string, direction: Direction): Audit {
    if (this.audits.has(publicId)) throw new StateConflict("duplicate audit");
    const [sourceLocale, targetLocale] = localesFor(direction);
    const now = new Date().toISOString();
    const audit: Audit = { publicId, kind: "FREE", status: "SUBMITTED", revision: 0, nextEventSeq: 1, homepageUrl, direction, sourceLocale, targetLocale, siteBoundary: { submittedHost: new URL(homepageUrl).hostname, registrableDomain: new URL(homepageUrl).hostname, verifiedHosts: [] }, limits: { maxPagePairs: 1, exactFindingCount: 3, maxFindings: 3, maxChildren: 3, maxDepth: 1, maxRuntimeSeconds: 240 }, runStartState: "UNRESERVED", createdAt: now, updatedAt: now };
    this.audits.set(publicId, audit);
    return audit;
  }

  require(publicId: string): Audit {
    const audit = this.audits.get(publicId);
    if (!audit) throw new StateConflict("audit not found");
    return audit;
  }

  transition(publicId: string, next: AuditStatus): Audit {
    const audit = this.require(publicId);
    if (!canTransition(audit.status, next)) throw new StateConflict(`${audit.status} -> ${next}`);
    audit.status = next;
    audit.revision++;
    audit.updatedAt = new Date().toISOString();
    return audit;
  }

  claim(publicId: string): Audit {
    const audit = this.require(publicId);
    if (audit.kind === "FREE" && audit.status !== "ELIGIBILITY_CHECK") throw new StateConflict("free audit not claimable");
    if (audit.kind === "PAID" && audit.status !== "PAID_QUEUED") throw new StateConflict("paid audit not claimable");
    return audit;
  }

  reserveHermesStart(publicId: string, attemptId: string): Audit {
    const audit = this.claim(publicId);
    if (audit.runStartState !== "UNRESERVED") throw new StateConflict("Hermes start already reserved");
    audit.runStartState = "STARTING";
    audit.runStartAttemptId = attemptId;
    audit.runStartDispatchState = "RESERVED";
    audit.revision++;
    return audit;
  }

  markDispatch(publicId: string, attemptId: string, state: "NOT_DISPATCHED" | "MAYBE_DISPATCHED"): Audit {
    const audit = this.requireReservation(publicId, attemptId);
    audit.runStartDispatchState = state;
    audit.revision++;
    return audit;
  }

  markStartUncertain(publicId: string, attemptId: string): Audit {
    const audit = this.requireReservation(publicId, attemptId);
    audit.runStartState = "UNCERTAIN";
    audit.runStartDispatchState = "MAYBE_DISPATCHED";
    audit.error = { code: "HERMES_START_UNCERTAIN", class: "TERMINAL", message: "Hermes create may have been dispatched; operator reconciliation required" };
    audit.revision++;
    return audit;
  }

  releaseNotDispatched(publicId: string, attemptId: string): Audit {
    const audit = this.requireReservation(publicId, attemptId);
    if (audit.runStartDispatchState !== "NOT_DISPATCHED") throw new StateConflict("dispatch outcome is not retryable");
    audit.runStartState = "UNRESERVED";
    delete audit.runStartAttemptId;
    delete audit.runStartDispatchState;
    audit.revision++;
    return audit;
  }

  bindHermesRun(publicId: string, attemptId: string, runId: string): Audit {
    const audit = this.requireReservation(publicId, attemptId);
    if (audit.runStartDispatchState === "NOT_DISPATCHED") throw new StateConflict("undispatched attempt cannot bind");
    audit.hermesRunId = runId;
    audit.hermesSessionId = publicId;
    audit.runStartState = "BOUND";
    audit.runStartDispatchState = "ACKNOWLEDGED";
    this.transition(publicId, audit.kind === "FREE" ? "FREE_RUNNING" : "PAID_RUNNING");
    return audit;
  }

  append(event: AgentEvent): AgentEvent {
    this.require(event.auditId);
    const key = `${event.auditId}:${event.eventId}`;
    const existing = this.events.get(event.auditId)?.find((item) => item.eventId === event.eventId);
    if (existing) return existing;
    if (this.eventIds.has(key)) throw new StateConflict("event conflict");
    const audit = this.require(event.auditId);
    const persisted = { ...event, seq: audit.nextEventSeq++ };
    this.eventIds.add(key);
    this.events.set(event.auditId, [...(this.events.get(event.auditId) ?? []), persisted]);
    return persisted;
  }

  publish(report: Report, idempotencyKey: string, refs: Refs): Report {
    const previousId = this.reportKeys.get(idempotencyKey);
    if (previousId) return this.reports.get(previousId)!;
    const audit = this.require(report.auditId);
    if (!['FREE_RUNNING', 'PAID_RUNNING'].includes(audit.status)) throw new StateConflict("audit is not publishable");
    const validation = validateReport(report, audit, refs.artifacts, refs.evidence, refs.golden);
    if (!validation.ok) throw new StateConflict(`REPORT_INVALID:${JSON.stringify(validation.errors)}`);
    const reportId = report.reportId ?? `rep_${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16)}`;
    const persisted = { ...report, reportId };
    this.reports.set(reportId, persisted);
    this.reportKeys.set(idempotencyKey, reportId);
    audit.reportId = reportId;
    this.transition(audit.publicId, audit.kind === "FREE" ? "FREE_REPORT" : "PAID_REPORT");
    return persisted;
  }

  createPaidOnce(parentAuditId: string, deliveryId: string): Audit {
    const existing = this.paymentEvents.get(deliveryId);
    if (existing) return this.require(existing);
    const parent = this.require(parentAuditId);
    if (parent.kind !== "FREE" || parent.status !== "FREE_REPORT") throw new StateConflict("paid continuation requires a free report");
    const publicId = `aud_paid_${createHash('sha256').update(`${parentAuditId}:${deliveryId}`).digest('hex').slice(0, 16)}`;
    const now = new Date().toISOString();
    const paid: Audit = { ...parent, publicId, kind: "PAID", parentAuditId, status: "PAID_QUEUED", revision: 0, nextEventSeq: 1, limits: { ...parent.limits, maxPagePairs: 2, exactFindingCount: undefined, maxFindings: 6 }, runStartState: "UNRESERVED", paymentId: deliveryId, createdAt: now, updatedAt: now, hermesRunId: undefined, hermesSessionId: undefined, reportId: undefined, error: undefined };
    this.audits.set(publicId, paid);
    this.paymentEvents.set(deliveryId, publicId);
    return paid;
  }

  private requireReservation(publicId: string, attemptId: string): Audit {
    const audit = this.require(publicId);
    if (audit.runStartState !== "STARTING" || audit.runStartAttemptId !== attemptId) throw new StateConflict("start reservation mismatch");
    return audit;
  }
}
