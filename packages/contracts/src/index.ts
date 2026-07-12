export const CONTRACT_VERSION = "1.0" as const;

export type Direction = "KR_TO_US" | "US_TO_KR";
export type Locale = "ko-KR" | "en-US";
export type AuditKind = "FREE" | "PAID";
export type AuditStatus = "SUBMITTED" | "ELIGIBILITY_CHECK" | "FREE_RUNNING" | "FREE_REPORT" | "PAID_QUEUED" | "PAID_DISCOVERING" | "PAID_CAPTURING" | "PAID_RUNNING" | "PAID_REPORT" | "FAILED" | "CANCELLED";
export type RunStartState = "UNRESERVED" | "STARTING" | "BOUND" | "UNCERTAIN";
export type RunDispatchState = "RESERVED" | "NOT_DISPATCHED" | "MAYBE_DISPATCHED" | "ACKNOWLEDGED";
export type AuditErrorCode =
  | "INVALID_URL" | "UNSAFE_URL" | "LOCALE_NOT_FOUND" | "BLOCKED_BY_ORIGIN"
  | "CAPTURE_TIMEOUT" | "CAPTURE_INCOMPLETE" | "RESEARCH_UNAVAILABLE" | "KB_UNAVAILABLE"
  | "HERMES_PROVIDER_AUTH_FAILED" | "HERMES_START_FAILED" | "HERMES_START_UNCERTAIN" | "HERMES_RUN_FAILED"
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
export type PageRole = "PRICING" | "PRODUCT" | "FEATURES" | "SOLUTION" | "USE_CASE" | "CUSTOMER" | "DOCUMENTATION" | "OTHER";
export type PairingMethod = "HREFLANG" | "LANGUAGE_SWITCH" | "LOCALE_PATTERN";
export type PagePair = {
  pairId: string; auditId: string; role: PageRole; sourceUrl: string; targetUrl: string;
  sourceLocale: Locale; targetLocale: Locale; pairingMethod: PairingMethod;
  pairingEvidence: string; discoveryScore: number;
};
export type ArtifactRef = {
  artifactId: string; auditId: string; pairId: string; side: "SOURCE" | "TARGET";
  kind: "SCREENSHOT" | "HTML" | "MARKDOWN" | "ACCESSIBILITY_TREE";
  r2Key: string; mimeType: string; sha256: string; sizeBytes: number;
  sourceUrl: string; finalUrl: string; capturedAt: string; width?: number; height?: number;
};
export type PaidAudit = {
  auditId: string; kind: "PAID"; parentAuditId: string; paymentId: string;
  status: Extract<AuditStatus, "PAID_QUEUED" | "PAID_DISCOVERING" | "PAID_CAPTURING" | "PAID_RUNNING" | "PAID_REPORT" | "FAILED" | "CANCELLED">;
  input: { homepageUrl: string; direction: Direction; audience: string; launchGoal: string };
  limits: { maxAdditionalPairs: 2; maxRenderedPages: 4; maxFindings: 6; maxChildren: 3; maxDepth: 1 };
  selectedPairIds: string[]; captureId?: string; hermesRunId?: string; reportId?: string;
  error?: AuditError; revision: number; createdAt: string; updatedAt: string;
};
export type PaidFinding = {
  findingId: string; rank: number; pairId: string; targetUrl: string; screenshotArtifactId: string;
  componentType: "HERO_HEADLINE" | "VALUE_PROPOSITION" | "PRIMARY_CTA" | "TRUST_COPY" | "FEATURE_COPY" | "MICROCOPY";
  issueType: "LITERAL_TRANSLATION" | "CULTURAL_TONE" | "VALUE_PROP_CLARITY" | "CTA_MARKET_FIT" | "TRUST_SIGNAL" | "TERMINOLOGY" | "VISUAL_FIT";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  componentRef: { kind: "CSS_SELECTOR" | "ACCESSIBILITY_NAME" | "TEXT_ANCHOR" | "SEMANTIC_LABEL"; value: string };
  sourceCopy: string; currentTargetCopy: string; proposedTargetCopy: string;
  businessImpact: string; rationale: string; confidence: number;
  evidenceRefs: Array<{ packId: string; evidenceId: string }>; kbRefs: string[];
};
export type PaidReport = {
  schemaVersion: "1.0"; jobType: "PAID"; reportId: string; auditId: string; parentAuditId: string;
  title: string; executiveSummary: string; auditedPairIds: string[]; findings: PaidFinding[];
  limitations: string[]; liveMarketEvidence: "AVAILABLE" | "DEGRADED";
  generation: { hermesRunId: string; contractVersion: string; promptVersion: string; skillVersion: string; kbVersion: string };
  generatedAt: string;
};
export type Finding = { id: string; title: string; componentType: "HERO_HEADLINE" | "VALUE_PROPOSITION" | "PRIMARY_CTA" | "TRUST_COPY"; sourceCopy: string; recommendation: string; rationale: string; artifactId: string; evidenceRefs: Array<{ packId: string; evidenceId: string }>; goldenRecordIds: string[] };
export type Report = { schemaVersion: "1.0"; auditId: string; reportId?: string; findings: Finding[]; generatedAt: string };
export type ReportValidation = { ok: true } | { ok: false; errors: Array<{ path: string; code: string }> };

const transitionMap: Record<AuditStatus, AuditStatus[]> = {
  SUBMITTED: ["ELIGIBILITY_CHECK", "FAILED", "CANCELLED"], ELIGIBILITY_CHECK: ["FREE_RUNNING", "FAILED", "CANCELLED"],
  FREE_RUNNING: ["FREE_REPORT", "FAILED", "CANCELLED"], FREE_REPORT: [], PAID_QUEUED: ["PAID_DISCOVERING", "PAID_RUNNING", "FAILED", "CANCELLED"],
  PAID_DISCOVERING: ["PAID_CAPTURING", "FAILED", "CANCELLED"], PAID_CAPTURING: ["PAID_RUNNING", "FAILED", "CANCELLED"],
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

export function validatePaidReport(
  report: PaidReport,
  audit: PaidAudit,
  pairs: ReadonlyMap<string, PagePair>,
  artifacts: ReadonlyMap<string, ArtifactRef>,
  evidenceRefs: ReadonlySet<string>,
  goldenRecords: ReadonlySet<string>,
): ReportValidation {
  const errors: Array<{ path: string; code: string }> = [];
  if (report.schemaVersion !== CONTRACT_VERSION || report.jobType !== "PAID") errors.push({ path: "schemaVersion", code: "UNSUPPORTED_VERSION" });
  if (report.auditId !== audit.auditId || report.parentAuditId !== audit.parentAuditId) errors.push({ path: "auditId", code: "AUDIT_MISMATCH" });
  if (report.auditedPairIds.length < 1 || report.auditedPairIds.length > 2 || new Set(report.auditedPairIds).size !== report.auditedPairIds.length) errors.push({ path: "auditedPairIds", code: "INVALID_PAIR_COUNT" });
  if (report.findings.length < 1 || report.findings.length > audit.limits.maxFindings) errors.push({ path: "findings", code: "INVALID_FINDING_COUNT" });
  const ids = new Set<string>();
  const ranks = new Set<number>();
  // Model output is untrusted: every field may be missing or mistyped, and the
  // validator must return typed errors (so bounded repair can run), never throw.
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  for (const [index, rawFinding] of report.findings.entries()) {
    const path = `findings[${index}]`;
    const finding = (rawFinding && typeof rawFinding === "object" ? rawFinding : {}) as Partial<PaidFinding>;
    const findingId = text(finding.findingId);
    const pair = typeof finding.pairId === "string" ? pairs.get(finding.pairId) : undefined;
    const artifact = typeof finding.screenshotArtifactId === "string" ? artifacts.get(finding.screenshotArtifactId) : undefined;
    if (!findingId.trim() || ids.has(findingId)) errors.push({ path: `${path}.findingId`, code: "DUPLICATE_OR_MISSING_ID" });
    if (!Number.isInteger(finding.rank) || (finding.rank as number) < 1 || ranks.has(finding.rank as number)) errors.push({ path: `${path}.rank`, code: "DUPLICATE_OR_INVALID_RANK" });
    ids.add(findingId); ranks.add(finding.rank as number);
    if (!pair || !report.auditedPairIds.includes(finding.pairId as string) || !audit.selectedPairIds.includes(finding.pairId as string)) errors.push({ path: `${path}.pairId`, code: "UNKNOWN_REFERENCE" });
    if (!pair || pair.targetUrl !== finding.targetUrl) errors.push({ path: `${path}.targetUrl`, code: "PAGE_MISMATCH" });
    if (!artifact || artifact.auditId !== audit.auditId || artifact.pairId !== finding.pairId || artifact.side !== "TARGET" || artifact.kind !== "SCREENSHOT") errors.push({ path: `${path}.screenshotArtifactId`, code: "UNKNOWN_REFERENCE" });
    const currentTargetCopy = text(finding.currentTargetCopy);
    const proposedTargetCopy = text(finding.proposedTargetCopy);
    if (!text(finding.sourceCopy).trim() || !currentTargetCopy.trim() || !proposedTargetCopy.trim() || currentTargetCopy.trim() === proposedTargetCopy.trim()) errors.push({ path, code: "INVALID_COPY" });
    if (!text(finding.businessImpact).trim() || !text(finding.rationale).trim() || typeof finding.confidence !== "number" || finding.confidence < 0 || finding.confidence > 1) errors.push({ path, code: "INVALID_ANALYSIS" });
    const componentRef = (finding.componentRef && typeof finding.componentRef === "object" ? finding.componentRef : {}) as Partial<PaidFinding["componentRef"]>;
    if (!text(componentRef.kind).trim() || !text(componentRef.value).trim()) errors.push({ path: `${path}.componentRef`, code: "INVALID_COMPONENT_REF" });
    const findingEvidence = Array.isArray(finding.evidenceRefs) ? finding.evidenceRefs : [];
    for (const ref of findingEvidence) if (!ref || typeof ref !== "object" || !evidenceRefs.has(`${text(ref.packId)}:${text(ref.evidenceId)}`)) errors.push({ path: `${path}.evidenceRefs`, code: "UNKNOWN_REFERENCE" });
    const kbRefs = Array.isArray(finding.kbRefs) ? finding.kbRefs : [];
    if (kbRefs.length === 0 || kbRefs.some((id) => typeof id !== "string" || !goldenRecords.has(id))) errors.push({ path: `${path}.kbRefs`, code: "UNKNOWN_REFERENCE" });
  }
  for (const pairId of report.auditedPairIds) if (!pairs.has(pairId) || !audit.selectedPairIds.includes(pairId)) errors.push({ path: "auditedPairIds", code: "UNKNOWN_REFERENCE" });
  if (!report.generation.hermesRunId || report.generation.hermesRunId !== audit.hermesRunId) errors.push({ path: "generation.hermesRunId", code: "RUN_MISMATCH" });
  return errors.length ? { ok: false, errors } : { ok: true };
}
