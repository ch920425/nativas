/**
 * Convex projection contract for gbrain/Hermes observability.
 * gbrain remains the retrieval system of record in isolated PGLite/pgvector;
 * Convex stores privacy-safe spans, eval outcomes, and release comparisons only.
 */
export const retrievalObservabilityContract = {
  schemaVersion: "1.0",
  tools: ["search", "query", "get_page", "think"],
  stages: ["FREE_EVIDENCE_RETRIEVAL", "PAID_DISCOVERY_RETRIEVAL", "SPECIALIST_REFERENCE_RESOLUTION", "PARENT_RECONCILIATION"],
  outcomes: ["RUNNING", "SUCCEEDED", "FAILED"],
  forbiddenFields: ["query", "prompt", "result", "rawContent", "chainOfThought", "apiKey", "customerEmail"]
} as const;

export type RetrievalSpanProjection = {
  schemaVersion: "1.0";
  spanId: string;
  auditId: string;
  hermesRunId: string;
  stage: typeof retrievalObservabilityContract.stages[number];
  toolName: typeof retrievalObservabilityContract.tools[number];
  kbVersion: string;
  queryFingerprint: string;
  startedAt: string;
  endedAt?: string;
  latencyMs?: number;
  outcome: typeof retrievalObservabilityContract.outcomes[number];
  resultCount?: number;
  recordIds?: string[];
  errorCode?: string;
};

export type EvalRunProjection = {
  schemaVersion: "1.0";
  evalRunId: string;
  suite: "KB_RETRIEVAL_V1" | "AUDIT_LIFECYCLE_V1";
  releaseSha: string;
  kbVersion: string;
  startedAt: string;
  endedAt?: string;
  status: "RUNNING" | "PASSED" | "FAILED";
  passed: number;
  failed: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
};

export function assertSafeRetrievalProjection(value: unknown): asserts value is RetrievalSpanProjection {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("retrieval projection must be an object");
  const row = value as Record<string, unknown>;
  for (const key of retrievalObservabilityContract.forbiddenFields) if (key in row) throw new Error(`forbidden observability field ${key}`);
  for (const key of ["spanId", "auditId", "hermesRunId", "kbVersion", "queryFingerprint", "startedAt"]) if (typeof row[key] !== "string" || !row[key]) throw new Error(`missing retrieval projection ${key}`);
  if (!retrievalObservabilityContract.tools.includes(row.toolName as never)) throw new Error("invalid retrieval tool");
  if (!retrievalObservabilityContract.stages.includes(row.stage as never)) throw new Error("invalid lifecycle stage");
  if (!retrievalObservabilityContract.outcomes.includes(row.outcome as never)) throw new Error("invalid retrieval outcome");
  if (row.queryFingerprint && !/^[a-f0-9]{64}$/.test(String(row.queryFingerprint))) throw new Error("queryFingerprint must be sha256");
  if (row.recordIds !== undefined && (!Array.isArray(row.recordIds) || row.recordIds.length > 6 || row.recordIds.some((id) => typeof id !== "string"))) throw new Error("invalid bounded recordIds");
  if (row.latencyMs !== undefined && (typeof row.latencyMs !== "number" || row.latencyMs < 0)) throw new Error("invalid latencyMs");
}

export function compareRetrievalPerformance(baseline: EvalRunProjection, candidate: EvalRunProjection) {
  if (baseline.status === "RUNNING" || candidate.status === "RUNNING") throw new Error("only terminal eval runs can be compared");
  const baselineTotal = baseline.passed + baseline.failed;
  const candidateTotal = candidate.passed + candidate.failed;
  if (!baselineTotal || !candidateTotal) throw new Error("eval runs need cases");
  return {
    schemaVersion: "1.0" as const,
    metric: "KB_RETRIEVAL_PASS_RATE_AND_P95",
    baselineRelease: baseline.releaseSha,
    candidateRelease: candidate.releaseSha,
    passRateDelta: candidate.passed / candidateTotal - baseline.passed / baselineTotal,
    p95LatencyDeltaMs: (candidate.p95LatencyMs ?? 0) - (baseline.p95LatencyMs ?? 0),
    regressed: candidate.passed / candidateTotal < baseline.passed / baselineTotal || (candidate.p95LatencyMs ?? 0) > (baseline.p95LatencyMs ?? 0) * 1.2
  };
}
