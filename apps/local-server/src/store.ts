import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ArtifactRef, PagePair, PaidAudit, PaidReport } from "@nativas/contracts";
import type { AuditView } from "../../web/src/lib/contracts.ts";

export type CheckoutRecord = { auditId: string; checkoutUrl: string; checkoutPaymentId: string; succeededPaymentId?: string };
export type PersistedState = {
  version: 2;
  freeAudits: Record<string, AuditView>;
  paidAudits: Record<string, PaidAudit>;
  pairs: Record<string, PagePair>;
  artifacts: Record<string, ArtifactRef>;
  paidReports: Record<string, PaidReport>;
  checkouts: Record<string, CheckoutRecord>;
  paymentChildren: Record<string, string>;
  processedWebhookHashes: Record<string, string>;
};

const emptyState = (): PersistedState => ({ version: 2, freeAudits: {}, paidAudits: {}, pairs: {}, artifacts: {}, paidReports: {}, checkouts: {}, paymentChildren: {}, processedWebhookHashes: {} });

export class LocalStore {
  private state: PersistedState;
  private readonly path: string | null;
  constructor(path: string | null) {
    this.path = path;
    if (!path || !existsSync(path)) this.state = emptyState();
    else this.state = parseState(readFileSync(path, "utf8"));
  }
  snapshot(): PersistedState { return structuredClone(this.state); }
  transaction<T>(change: (draft: PersistedState) => T): T {
    const draft = structuredClone(this.state);
    const result = change(draft);
    this.persist(draft);
    this.state = draft;
    return structuredClone(result);
  }
  private persist(state: PersistedState) {
    if (!this.path) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
    renameSync(temp, this.path);
  }
}

function parseState(raw: string): PersistedState {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("PERSISTENCE_CORRUPT"); }
  if (!parsed || typeof parsed !== "object") throw new Error("PERSISTENCE_CORRUPT");
  const candidate = parsed as Partial<PersistedState>;
  if (candidate.version === 2 && candidate.freeAudits && candidate.paidAudits && candidate.pairs && candidate.artifacts && candidate.paidReports && candidate.checkouts && candidate.paymentChildren && candidate.processedWebhookHashes) return candidate as PersistedState;
  // One-time compatibility with the original parent-only audit map.
  if (!Object.values(candidate).every((value) => value && typeof value === "object" && "auditId" in value)) throw new Error("PERSISTENCE_CORRUPT");
  return { ...emptyState(), freeAudits: candidate as Record<string, AuditView> };
}
