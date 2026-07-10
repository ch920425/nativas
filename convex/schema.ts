/** Convex schema implementation handoff. Runtime semantics live in apps/runtime until credentials are configured. */
export const tables = ["audits", "agentEvents", "pages", "artifactRefs", "evidencePacks", "reports", "payments", "paymentEvents"] as const;
export const requiredAuditIndexes = ["by_public_id", "by_status_created_at", "by_parent_audit", "by_hermes_run_id"] as const;
