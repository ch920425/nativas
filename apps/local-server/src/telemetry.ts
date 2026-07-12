import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export type TraceCorrelation = { parentAuditId?: string; paymentId?: string; captureId?: string; hermesRunId?: string; reportId?: string };
export type TraceUsage = { inputTokens: number; outputTokens: number; totalTokens: number };
export type TraceSpan = {
  spanId: string;
  auditId: string;
  seq: number;
  kind: "STAGE" | "TOOL" | "HERMES_RUN" | "PAYMENT" | "REPORT";
  name: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  outcome: "RUNNING" | "SUCCEEDED" | "FAILED";
  errorCode?: string;
  correlation: TraceCorrelation;
  usage?: TraceUsage;
  costUsd?: number;
};

export type SpanHandle = {
  span: TraceSpan;
  end(input?: { ok?: boolean; errorCode?: string; correlation?: TraceCorrelation; usage?: TraceUsage }): TraceSpan;
};

const MAX_SPANS_PER_AUDIT = 300;
const MAX_NAME_LENGTH = 160;
const CORRELATION_KEYS = ["parentAuditId", "paymentId", "captureId", "hermesRunId", "reportId"] as const;

/**
 * Privacy-safe run tracing along the correlation chain
 * paymentId -> paidAuditId -> captureId -> hermesRunId -> reportId.
 * Only the enumerated fields are ever persisted; prompts, page content,
 * queries, credentials, and customer details cannot enter a span.
 */
export class Telemetry {
  private readonly spans = new Map<string, TraceSpan[]>();
  private readonly path: string | null;
  private readonly now: () => number;

  constructor(path: string | null, now: () => number = Date.now) {
    this.path = path;
    this.now = now;
  }

  begin(auditId: string, kind: TraceSpan["kind"], name: string, correlation: TraceCorrelation = {}): SpanHandle {
    const list = this.list(auditId, false);
    const span: TraceSpan = {
      spanId: `span_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
      auditId,
      seq: list.length + 1,
      kind,
      name: safeName(name),
      startedAt: new Date(this.now()).toISOString(),
      outcome: "RUNNING",
      correlation: safeCorrelation(correlation),
    };
    this.push(auditId, span);
    return {
      span,
      end: (input = {}) => {
        if (span.outcome !== "RUNNING") return span;
        const endedAt = this.now();
        span.endedAt = new Date(endedAt).toISOString();
        span.durationMs = Math.max(0, endedAt - Date.parse(span.startedAt));
        span.outcome = input.ok === false ? "FAILED" : "SUCCEEDED";
        if (input.errorCode) {
          span.outcome = "FAILED";
          span.errorCode = safeName(input.errorCode);
        }
        if (input.correlation) span.correlation = { ...span.correlation, ...safeCorrelation(input.correlation) };
        if (input.usage) {
          span.usage = { inputTokens: input.usage.inputTokens, outputTokens: input.usage.outputTokens, totalTokens: input.usage.totalTokens };
          const cost = estimateCostUsd(span.usage);
          if (cost !== undefined) span.costUsd = cost;
        }
        this.persist(span);
        return span;
      },
    };
  }

  record(auditId: string, kind: TraceSpan["kind"], name: string, input: { ok?: boolean; errorCode?: string; correlation?: TraceCorrelation; usage?: TraceUsage } = {}): TraceSpan {
    return this.begin(auditId, kind, name, input.correlation ?? {}).end(input);
  }

  list(auditId: string, clone = true): TraceSpan[] {
    const spans = this.spans.get(auditId) ?? [];
    return clone ? structuredClone(spans) : spans;
  }

  private push(auditId: string, span: TraceSpan) {
    const list = this.spans.get(auditId) ?? [];
    list.push(span);
    if (list.length > MAX_SPANS_PER_AUDIT) list.splice(0, list.length - MAX_SPANS_PER_AUDIT);
    this.spans.set(auditId, list);
  }

  private persist(span: TraceSpan) {
    if (!this.path) return;
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      appendFileSync(this.path, `${JSON.stringify(span)}\n`, { mode: 0o600 });
    } catch {
      // Telemetry must never break the audit path.
    }
  }
}

/** Cost is reported only when explicit per-million-token USD rates are configured. */
export function estimateCostUsd(usage: TraceUsage, env: NodeJS.ProcessEnv = process.env): number | undefined {
  const input = Number(env.NATIVAS_COST_USD_PER_MTOK_INPUT);
  const output = Number(env.NATIVAS_COST_USD_PER_MTOK_OUTPUT);
  if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) return undefined;
  return Math.round(((usage.inputTokens * input + usage.outputTokens * output) / 1_000_000) * 1e6) / 1e6;
}

function safeName(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").slice(0, MAX_NAME_LENGTH);
}

function safeCorrelation(correlation: TraceCorrelation): TraceCorrelation {
  const result: TraceCorrelation = {};
  for (const key of CORRELATION_KEYS) {
    const value = correlation[key];
    if (typeof value === "string" && value) result[key] = safeName(value);
  }
  return result;
}
