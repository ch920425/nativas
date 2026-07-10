import { capabilityMatches } from "./adapters.ts";

export const NATIVAS_OPS_TOOLS = ["capture_site", "search_market_evidence", "submit_report"] as const;
export type NativasOpsTool = typeof NATIVAS_OPS_TOOLS[number];

type CapabilityRecord = { auditId: string; runId: string; hash: string; expiresAt: number };

export class ParentCapabilityAuthorizer {
  private readonly records: ReadonlyMap<string, CapabilityRecord>;
  private readonly now: () => number;
  constructor(records: ReadonlyMap<string, CapabilityRecord>, now = () => Date.now()) { this.records = records; this.now = now; }
  authorize(auditId: string, runId: string, capability: string): void {
    const record = this.records.get(auditId);
    if (!record || record.runId !== runId || record.expiresAt <= this.now() || !capabilityMatches(record.hash, capability)) throw new Error("PARENT_CAPABILITY_DENIED");
  }
}

export class NativasOps {
  private readonly authorize: ParentCapabilityAuthorizer;
  private readonly handlers: Record<NativasOpsTool, (input: Record<string, unknown>) => unknown | Promise<unknown>>;
  constructor(authorize: ParentCapabilityAuthorizer, handlers: Record<NativasOpsTool, (input: Record<string, unknown>) => unknown | Promise<unknown>>) { this.authorize = authorize; this.handlers = handlers; }
  async call(tool: string, input: Record<string, unknown>): Promise<unknown> {
    if (!NATIVAS_OPS_TOOLS.includes(tool as NativasOpsTool)) throw new Error("TOOL_NOT_ALLOWED");
    const { auditId, runId, parentCapability } = input;
    if (typeof auditId !== 'string' || typeof runId !== 'string' || typeof parentCapability !== 'string') throw new Error("PARENT_CAPABILITY_DENIED");
    this.authorize.authorize(auditId, runId, parentCapability);
    const safeInput = { ...input };
    delete safeInput.parentCapability;
    return this.handlers[tool as NativasOpsTool](safeInput);
  }
}
