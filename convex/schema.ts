import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** Canonical Convex table/index contract, retained for deterministic architecture tests. */
export const schemaContract = {
  audits: { indexes: ["by_public_id", "by_status_created_at", "by_parent_audit", "by_hermes_run_id", "by_run_start_attempt"] },
  agentEvents: { indexes: ["by_audit_seq", "by_audit_event_id"] },
  pages: { indexes: ["by_audit_page_id"] },
  artifactRefs: { indexes: ["by_audit_artifact_id"] },
  evidencePacks: { indexes: ["by_audit_pack_id"] },
  reports: { indexes: ["by_audit_report_id", "by_idempotency_key"] },
  payments: { indexes: ["by_audit", "by_provider_payment_id"] },
  paymentEvents: { indexes: ["by_webhook_id"] },
  retrievalSpans: { indexes: ["by_span_id", "by_audit_started_at", "by_run_started_at", "by_stage_outcome", "by_tool_started_at"] },
  agentToolCalls: { indexes: ["by_audit_started_at", "by_run_started_at", "by_span"] },
  evalRuns: { indexes: ["by_suite_started_at", "by_release_sha", "by_status_started_at"] },
  evalCases: { indexes: ["by_eval_run", "by_risk_id_status"] },
  performanceComparisons: { indexes: ["by_metric_created_at", "by_candidate_release"] }
} as const;

export const tables = Object.keys(schemaContract) as Array<keyof typeof schemaContract>;
export const requiredAuditIndexes = schemaContract.audits.indexes;

const stage = v.union(
  v.literal("FREE_EVIDENCE_RETRIEVAL"),
  v.literal("PAID_DISCOVERY_RETRIEVAL"),
  v.literal("SPECIALIST_REFERENCE_RESOLUTION"),
  v.literal("PARENT_RECONCILIATION"),
);
const tool = v.union(v.literal("search"), v.literal("query"), v.literal("get_page"), v.literal("think"));
const outcome = v.union(v.literal("RUNNING"), v.literal("SUCCEEDED"), v.literal("FAILED"));

export default defineSchema({
  retrievalSpans: defineTable({
    schemaVersion: v.literal("1.0"), spanId: v.string(), auditId: v.string(), hermesRunId: v.string(),
    stage, toolName: tool, kbVersion: v.string(), queryFingerprint: v.string(), startedAt: v.string(),
    endedAt: v.optional(v.string()), latencyMs: v.optional(v.number()), outcome,
    resultCount: v.optional(v.number()), recordIds: v.optional(v.array(v.string())), errorCode: v.optional(v.string()),
  }).index("by_span_id", ["spanId"])
    .index("by_audit_started_at", ["auditId", "startedAt"])
    .index("by_run_started_at", ["hermesRunId", "startedAt"])
    .index("by_stage_outcome", ["stage", "outcome"])
    .index("by_tool_started_at", ["toolName", "startedAt"]),
  agentToolCalls: defineTable({
    callId: v.string(), auditId: v.string(), hermesRunId: v.string(), spanId: v.optional(v.string()),
    toolName: v.string(), startedAt: v.string(), endedAt: v.optional(v.string()), latencyMs: v.optional(v.number()),
    outcome, errorCode: v.optional(v.string()),
  }).index("by_audit_started_at", ["auditId", "startedAt"])
    .index("by_run_started_at", ["hermesRunId", "startedAt"])
    .index("by_span", ["spanId"]),
  evalRuns: defineTable({
    schemaVersion: v.literal("1.0"), evalRunId: v.string(), suite: v.union(v.literal("KB_RETRIEVAL_V1"), v.literal("AUDIT_LIFECYCLE_V1")),
    releaseSha: v.string(), kbVersion: v.string(), startedAt: v.string(), endedAt: v.optional(v.string()),
    status: v.union(v.literal("RUNNING"), v.literal("PASSED"), v.literal("FAILED")), passed: v.number(), failed: v.number(),
    p50LatencyMs: v.optional(v.number()), p95LatencyMs: v.optional(v.number()),
  }).index("by_suite_started_at", ["suite", "startedAt"])
    .index("by_release_sha", ["releaseSha"])
    .index("by_status_started_at", ["status", "startedAt"]),
  evalCases: defineTable({
    evalRunId: v.string(), caseId: v.string(), riskId: v.string(), status: v.union(v.literal("PASSED"), v.literal("FAILED")),
    latencyMs: v.number(), observedRecordIds: v.array(v.string()), errorCode: v.optional(v.string()),
  }).index("by_eval_run", ["evalRunId"])
    .index("by_risk_id_status", ["riskId", "status"]),
  performanceComparisons: defineTable({
    comparisonId: v.string(), metric: v.literal("KB_RETRIEVAL_PASS_RATE_AND_P95"), baselineRelease: v.string(), candidateRelease: v.string(),
    passRateDelta: v.number(), p95LatencyDeltaMs: v.number(), regressed: v.boolean(), createdAt: v.string(),
  }).index("by_metric_created_at", ["metric", "createdAt"])
    .index("by_candidate_release", ["candidateRelease"]),
});
