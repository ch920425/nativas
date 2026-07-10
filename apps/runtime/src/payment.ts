import { verifyDodoWebhook } from "./adapters.ts";
import { MemoryAuditStore } from "./store.ts";

type DodoEvent = { id: string; type: string; data: { metadata?: { auditId?: string } } };

export function processDodoWebhook(store: MemoryAuditStore, client: { unwrap(body: string, options: { headers: Record<string, string> }): DodoEvent }, rawBody: string, headers: Record<string, string | undefined>) {
  const event = verifyDodoWebhook(client, rawBody, headers);
  if (event.type !== 'payment.succeeded') throw new Error("WEBHOOK_INVALID");
  const parentAuditId = event.data.metadata?.auditId;
  if (!parentAuditId) throw new Error("WEBHOOK_INVALID");
  return store.createPaidOnce(parentAuditId, headers['webhook-id']!);
}
