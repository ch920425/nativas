import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

const stage = v.union(
  v.literal("FREE_EVIDENCE_RETRIEVAL"),
  v.literal("PAID_DISCOVERY_RETRIEVAL"),
  v.literal("SPECIALIST_REFERENCE_RESOLUTION"),
  v.literal("PARENT_RECONCILIATION"),
);
const toolName = v.union(v.literal("search"), v.literal("query"), v.literal("get_page"), v.literal("think"));
const outcome = v.union(v.literal("RUNNING"), v.literal("SUCCEEDED"), v.literal("FAILED"));
const projection = {
  schemaVersion: v.literal("1.0"), spanId: v.string(), auditId: v.string(), hermesRunId: v.string(),
  stage, toolName, kbVersion: v.string(), queryFingerprint: v.string(), startedAt: v.string(),
  endedAt: v.optional(v.string()), latencyMs: v.optional(v.number()), outcome,
  resultCount: v.optional(v.number()), recordIds: v.optional(v.array(v.string())), errorCode: v.optional(v.string()),
};

function authorize(key: string) {
  const expected = process.env.TELEMETRY_INGEST_KEY;
  if (!expected || key !== expected) throw new Error("TELEMETRY_FORBIDDEN");
}

export const upsertSpan = mutation({
  args: { key: v.string(), projection: v.object(projection) },
  handler: async (ctx, args) => {
    authorize(args.key);
    const existing = await ctx.db.query("retrievalSpans")
      .withIndex("by_span_id", (q) => q.eq("spanId", args.projection.spanId)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args.projection);
      return existing._id;
    }
    return await ctx.db.insert("retrievalSpans", args.projection);
  },
});

export const listByAudit = query({
  args: { key: v.string(), auditId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    authorize(args.key);
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 50)));
    return await ctx.db.query("retrievalSpans")
      .withIndex("by_audit_started_at", (q) => q.eq("auditId", args.auditId))
      .order("desc").take(limit);
  },
});
