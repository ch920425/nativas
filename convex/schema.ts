/** Canonical Convex table/index contract. `convex dev` materializes this after deployment linking. */
export const schemaContract = {
  audits: { indexes: ["by_public_id", "by_status_created_at", "by_parent_audit", "by_hermes_run_id", "by_run_start_attempt"] },
  agentEvents: { indexes: ["by_audit_seq", "by_audit_event_id"] },
  pages: { indexes: ["by_audit_page_id"] },
  artifactRefs: { indexes: ["by_audit_artifact_id"] },
  evidencePacks: { indexes: ["by_audit_pack_id"] },
  reports: { indexes: ["by_audit_report_id", "by_idempotency_key"] },
  payments: { indexes: ["by_audit", "by_provider_payment_id"] },
  paymentEvents: { indexes: ["by_webhook_id"] }
} as const;

export const tables = Object.keys(schemaContract) as Array<keyof typeof schemaContract>;
export const requiredAuditIndexes = schemaContract.audits.indexes;
