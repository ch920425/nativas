import type {
  AgentEvent as ContractAgentEvent,
  AuditError as ContractAuditError,
  AuditStatus,
  Direction,
} from "@nativas/contracts";

export type { AuditErrorCode, AuditStatus, Direction, Locale } from "@nativas/contracts";
export { CONTRACT_VERSION, canTransition, localesFor } from "@nativas/contracts";
export type AuditError = ContractAuditError;

/** Normalized event as persisted by Convex: `seq` is always assigned server-side. */
export type AgentEvent = ContractAgentEvent & { seq: number };

/**
 * View-layer finding. Mirrors docs/contracts/report-and-evidence.md Finding v1.
 * `packages/contracts` currently exports a narrower Finding; the missing fields
 * (severity, copy split, impact, confidence) are a pending contract change
 * request to Lane 2 — tracked in the lane handoff, not a competing contract.
 */
export type Finding = {
  findingId: string;
  rank: number;
  componentType:
    | "HERO_HEADLINE"
    | "VALUE_PROPOSITION"
    | "PRIMARY_CTA"
    | "TRUST_COPY"
    | "FEATURE_COPY"
    | "MICROCOPY";
  issueType:
    | "LITERAL_TRANSLATION"
    | "CULTURAL_TONE"
    | "VALUE_PROP_CLARITY"
    | "CTA_MARKET_FIT"
    | "TRUST_SIGNAL"
    | "TERMINOLOGY"
    | "VISUAL_FIT";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  componentRef: { kind: "CSS_SELECTOR" | "ACCESSIBILITY_NAME" | "TEXT_ANCHOR" | "SEMANTIC_LABEL"; value: string };
  sourceCopy: string;
  currentTargetCopy: string;
  proposedTargetCopy: string;
  businessImpact: string;
  rationale: string;
  confidence: number;
  evidenceRefs: Array<{ packId: string; evidenceId: string }>;
  kbRefs: string[];
};

export type AuditReport = {
  reportId: string;
  title: string;
  executiveSummary: string;
  sourceUrl: string;
  targetUrl: string;
  sourceLocale: string;
  targetLocale: string;
  screenshotLabels: [string, string];
  visualEvidence: {
    mode: "SCREENSHOT" | "HTML_TEXT_SNAPSHOT";
    source: { headline: string; supportingCopy: string; cta: string };
    target: { headline: string; supportingCopy: string; cta: string };
  };
  findings: Finding[];
  limitations: string[];
  liveMarketEvidence: "AVAILABLE" | "DEGRADED";
};

export type PaymentStatus = "NONE" | "CHECKOUT_OPEN" | "PENDING_CONFIRMATION" | "SUCCEEDED" | "FAILED";

export type AuditView = {
  auditId: string;
  status: AuditStatus;
  direction: Direction;
  homepageUrl: string;
  audience: string;
  launchGoal: string;
  hermesRunId?: string;
  degraded: boolean;
  error?: AuditError;
  events: AgentEvent[];
  report?: AuditReport;
  payment?: { paymentId: string; status: PaymentStatus };
  paidAuditId?: string;
  paidHermesRunId?: string;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
};

export type IntakeInput = {
  homepageUrl: string;
  direction: Direction;
  audience: string;
  launchGoal: string;
};

export type CheckoutSession = { checkoutUrl: string; paymentId: string };

/**
 * The single replaceable transport boundary. The fixture adapter implements it
 * for local development and tests; Lane 2's live adapter implements it against
 * Convex reactive queries + actions without UI changes.
 */
export interface AuditTransport {
  /** "FIXTURE" renders a persistent, visible fixture-mode badge. */
  readonly mode: "FIXTURE" | "LIVE";
  submit(input: IntakeInput): Promise<AuditView>;
  get(auditId: string): Promise<AuditView | null>;
  /** Convex-style reactive subscription. Returns an unsubscribe function. */
  subscribe(auditId: string, onChange: (view: AuditView) => void): () => void;
  cancel(auditId: string): Promise<AuditView>;
  /** Valid only in FREE_REPORT; idempotent per audit (one payment, one paid run). */
  createCheckout(auditId: string): Promise<CheckoutSession>;
}
