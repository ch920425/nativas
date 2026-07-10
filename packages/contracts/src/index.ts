export const CONTRACT_VERSION = "1.0" as const;

export type Direction = "KR_TO_US" | "US_TO_KR";
export type Locale = "ko-KR" | "en-US";
export type AuditKind = "FREE" | "PAID";
export type AuditStatus = "SUBMITTED" | "ELIGIBILITY_CHECK" | "FREE_RUNNING" | "FREE_REPORT" | "PAID_QUEUED" | "PAID_RUNNING" | "PAID_REPORT" | "FAILED" | "CANCELLED";
export type RunStartState = "UNRESERVED" | "STARTING" | "BOUND" | "UNCERTAIN";
export type RunDispatchState = "RESERVED" | "NOT_DISPATCHED" | "MAYBE_DISPATCHED" | "ACKNOWLEDGED";
export type AuditErrorCode =
  | "INVALID_URL" | "UNSAFE_URL" | "LOCALE_NOT_FOUND" | "BLOCKED_BY_ORIGIN"
  | "CAPTURE_TIMEOUT" | "CAPTURE_INCOMPLETE" | "RESEARCH_UNAVAILABLE" | "KB_UNAVAILABLE"
  | "HERMES_START_FAILED" | "HERMES_START_UNCERTAIN" | "HERMES_RUN_FAILED"
  | "DELEGATION_FAILED" | "REPORT_INVALID" | "PAYMENT_FAILED" | "WEBHOOK_INVALID"
  | "STATE_CONFLICT" | "CANCELLED";
export type AuditError = { code: AuditErrorCode; class: "TERMINAL" | "RETRYABLE" | "DEGRADABLE" | "CONFLICT"; message: string; retryAfter?: string };
export type SiteBoundary = { submittedHost: string; registrableDomain: string; verifiedHosts: string[] };
export type AuditLimits = { maxPagePairs: number; exactFindingCount?: number; maxFindings: number; maxChildren: number; maxDepth: number; maxRuntimeSeconds: number };
export type Audit = {
  publicId: string; kind: AuditKind; parentAuditId?: string; status: AuditStatus; revision: number; nextEventSeq: number;
  homepageUrl: string; direction: Direction; sourceLocale: Locale; targetLocale: Locale; siteBoundary: SiteBoundary; limits: AuditLimits;
  hermesRunId?: string; hermesSessionId?: string; reportId?: string; paymentId?: string;
  runStartState: RunStartState; runStartAttemptId?: string; runStartDispatchState?: RunDispatchState;
  leaseOwner?: string; leaseExpiresAt?: string; lastHeartbeatAt?: string;
  error?: AuditError; createdAt: string; updatedAt: string;
};
export type AgentEvent = { schemaVersion: "1.0"; eventId: string; auditId: string; seq?: number; type: string; actor: "HERMES_PARENT" | "HERMES_CHILD" | "RUNTIME" | "PAYMENT"; status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED"; safeLabel: string; hermesRunId?: string; toolName?: string; occurredAt: string };
export type ArtifactRef = { artifactId: string; pageId: string; kind: "SCREENSHOT" | "HTML" | "MARKDOWN" | "ACCESSIBILITY_TREE"; sourceUrl: string };
export type Finding = { id: string; title: string; componentType: "HERO_HEADLINE" | "VALUE_PROPOSITION" | "PRIMARY_CTA" | "TRUST_COPY"; sourceCopy: string; recommendation: string; rationale: string; artifactId: string; evidenceRefs: Array<{ packId: string; evidenceId: string }>; goldenRecordIds: string[] };
export type Report = { schemaVersion: "1.0"; auditId: string; reportId?: string; findings: Finding[]; generatedAt: string };
export type ReportValidation = { ok: true } | { ok: false; errors: Array<{ path: string; code: string }> };

const transitionMap: Record<AuditStatus, AuditStatus[]> = {
  SUBMITTED: ["ELIGIBILITY_CHECK", "FAILED", "CANCELLED"], ELIGIBILITY_CHECK: ["FREE_RUNNING", "FAILED", "CANCELLED"],
  FREE_RUNNING: ["FREE_REPORT", "FAILED", "CANCELLED"], FREE_REPORT: [], PAID_QUEUED: ["PAID_RUNNING", "FAILED", "CANCELLED"],
  PAID_RUNNING: ["PAID_REPORT", "FAILED", "CANCELLED"], PAID_REPORT: [], FAILED: [], CANCELLED: []
};
export function canTransition(from: AuditStatus, to: AuditStatus) { return transitionMap[from].includes(to); }
export function localesFor(direction: Direction): readonly [Locale, Locale] { return direction === "KR_TO_US" ? ["ko-KR", "en-US"] : ["en-US", "ko-KR"]; }
export function validateReport(report: Report, audit: Pick<Audit, "publicId" | "kind" | "limits" | "targetLocale">, artifacts: ReadonlySet<string>, evidenceRefs: ReadonlySet<string>, goldenRecords: ReadonlySet<string>): ReportValidation {
  const errors: Array<{ path: string; code: string }> = [];
  if (report.schemaVersion !== CONTRACT_VERSION) errors.push({ path: "schemaVersion", code: "UNSUPPORTED_VERSION" });
  if (report.auditId !== audit.publicId) errors.push({ path: "auditId", code: "AUDIT_MISMATCH" });
  const expected = audit.limits.exactFindingCount;
  if ((expected !== undefined && report.findings.length !== expected) || report.findings.length > audit.limits.maxFindings) errors.push({ path: "findings", code: "INVALID_FINDING_COUNT" });
  const ids = new Set<string>();
  for (const [index, finding] of report.findings.entries()) {
    if (!finding.id.trim() || ids.has(finding.id)) errors.push({ path: `findings[${index}].id`, code: "DUPLICATE_OR_MISSING_ID" });
    ids.add(finding.id);
    if (!artifacts.has(finding.artifactId)) errors.push({ path: `findings[${index}].artifactId`, code: "UNKNOWN_REFERENCE" });
    for (const ref of finding.evidenceRefs) if (!evidenceRefs.has(`${ref.packId}:${ref.evidenceId}`)) errors.push({ path: `findings[${index}].evidenceRefs`, code: "UNKNOWN_REFERENCE" });
    for (const id of finding.goldenRecordIds) if (!goldenRecords.has(id)) errors.push({ path: `findings[${index}].goldenRecordIds`, code: "UNKNOWN_REFERENCE" });
    if (!finding.title.trim() || finding.title.length > 120) errors.push({ path: `findings[${index}].title`, code: "INVALID_SIZE" });
    if (!finding.sourceCopy.trim() || finding.sourceCopy.length > 500 || !finding.recommendation.trim() || finding.recommendation.length > 500 || finding.rationale.length > 800) errors.push({ path: `findings[${index}]`, code: "INVALID_SIZE" });
    if (finding.sourceCopy.trim() === finding.recommendation.trim()) errors.push({ path: `findings[${index}].recommendation`, code: "UNCHANGED_RECOMMENDATION" });
    const targetIsKorean = /[\uac00-\ud7af]/.test(finding.recommendation);
    const targetIsEnglish = /^[\x00-\x7F]*$/.test(finding.recommendation) && /[A-Za-z]/.test(finding.recommendation);
    if ((audit.targetLocale === "ko-KR" && !targetIsKorean) || (audit.targetLocale === "en-US" && !targetIsEnglish)) errors.push({ path: `findings[${index}].recommendation`, code: "TARGET_LANGUAGE_INVALID" });
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
