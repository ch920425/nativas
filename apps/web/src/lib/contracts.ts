import type {
  AgentEvent as ContractAgentEvent,
  AuditError as ContractAuditError,
  AuditStatus,
  Direction,
} from "@nativas/contracts";

export type { AuditStatus, Direction } from "@nativas/contracts";
export type AuditError = ContractAuditError;

export type AgentEvent = ContractAgentEvent & { seq: number };

export type Finding = {
  findingId: string;
  rank: number;
  componentType: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
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
  findings: Finding[];
  limitations: string[];
  liveMarketEvidence: "AVAILABLE" | "DEGRADED";
};

export type AuditView = {
  auditId: string;
  status: AuditStatus;
  direction: Direction;
  homepageUrl: string;
  hermesRunId?: string;
  degraded: boolean;
  error?: AuditError;
  events: AgentEvent[];
  report?: AuditReport;
  paidAuditId?: string;
};

export type IntakeInput = {
  homepageUrl: string;
  direction: Direction;
  audience: string;
  launchGoal: string;
};

/** Temporary fixture-first boundary. Lane 2 will replace only this adapter. */
export interface AuditTransport {
  submit(input: IntakeInput): Promise<AuditView>;
  get(auditId: string): Promise<AuditView>;
  createCheckout(auditId: string): Promise<{ checkoutUrl: string }>;
}
