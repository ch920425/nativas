import { createHash } from "node:crypto";
import type { AgentEvent } from "../../../packages/contracts/src/index.ts";
import { MemoryAuditStore } from "./store.ts";

export class HermesCreateError extends Error {
  readonly dispatch: "NOT_DISPATCHED" | "MAYBE_DISPATCHED";
  constructor(dispatch: "NOT_DISPATCHED" | "MAYBE_DISPATCHED", message: string) { super(message); this.dispatch = dispatch; }
}

type HermesClient = { createRun(input: unknown): Promise<{ run_id: string }>; getRun(runId: string): Promise<{ status: string }> };

export class HermesRelay {
  private readonly store: MemoryAuditStore;
  private readonly client: HermesClient;
  constructor(store: MemoryAuditStore, client: HermesClient) { this.store = store; this.client = client; }

  async start(auditId: string, attemptId: string, packet: unknown): Promise<string> {
    this.store.reserveHermesStart(auditId, attemptId);
    let created: { run_id: string };
    try {
      created = await this.client.createRun({ input: packet, session_id: auditId });
    } catch (error) {
      if (error instanceof HermesCreateError && error.dispatch === "NOT_DISPATCHED") {
        this.store.markDispatch(auditId, attemptId, "NOT_DISPATCHED");
        this.store.releaseNotDispatched(auditId, attemptId);
      } else {
        this.store.markStartUncertain(auditId, attemptId);
      }
      throw error;
    }
    if (!created.run_id) {
      this.store.markStartUncertain(auditId, attemptId);
      throw new HermesCreateError("MAYBE_DISPATCHED", "Hermes response omitted run_id");
    }
    this.store.bindHermesRun(auditId, attemptId, created.run_id);
    this.store.append(relayEvent(auditId, created.run_id, "RUN_CREATED", "QUEUED"));
    const status = await this.client.getRun(created.run_id);
    if (!['queued', 'running'].includes(status.status)) throw new Error("HERMES_RUN_FAILED");
    this.store.append(relayEvent(auditId, created.run_id, "RUN_STARTED", "RUNNING"));
    return created.run_id;
  }
}

function relayEvent(auditId: string, runId: string, type: string, status: AgentEvent['status']): AgentEvent {
  return { schemaVersion: "1.0", eventId: `relay:${type}:${runId}`, auditId, type, actor: "RUNTIME", status, safeLabel: type === 'RUN_CREATED' ? 'Hermes run created' : 'Hermes run started', hermesRunId: runId, occurredAt: new Date().toISOString() };
}

export function normalizeHermesEvent(auditId: string, runId: string, raw: Record<string, unknown>): AgentEvent | null {
  const type = typeof raw.type === 'string' ? raw.type : '';
  if (!type || type.startsWith('reasoning.')) return null;
  const toolName = typeof raw.tool_name === 'string' ? raw.tool_name : undefined;
  const canonical = JSON.stringify({ type, toolName, id: raw.id ?? null, status: raw.status ?? null, runId });
  const status: AgentEvent['status'] = type.endsWith('.failed') ? 'FAILED' : type.endsWith('.completed') ? 'SUCCEEDED' : 'RUNNING';
  return { schemaVersion: '1.0', eventId: `hermes:${createHash('sha256').update(canonical).digest('hex')}`, auditId, type: type.toUpperCase().replaceAll('.', '_'), actor: toolName === 'delegate_task' ? 'HERMES_PARENT' : 'HERMES_PARENT', status, safeLabel: toolName ? `Hermes tool: ${toolName}` : 'Hermes activity', hermesRunId: runId, toolName, occurredAt: typeof raw.occurred_at === 'string' ? raw.occurred_at : new Date().toISOString() };
}
