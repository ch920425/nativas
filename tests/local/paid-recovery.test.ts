import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LocalStore } from "../../apps/local-server/src/store.ts";

test("PRECOVERY-01 persistence round-trips correlated paid resources atomically", () => {
  const root = mkdtempSync(join(tmpdir(), "nativas-paid-store-"));
  try {
    const path = join(root, "state.json");
    const store = new LocalStore(path);
    store.transaction((state) => {
      state.paymentChildren.pay_1 = "paid_1";
      state.paidAudits.paid_1 = { auditId: "paid_1", kind: "PAID", parentAuditId: "free_1", paymentId: "pay_1", status: "PAID_QUEUED", input: { homepageUrl: "https://acme.com", direction: "KR_TO_US", audience: "US buyers", launchGoal: "Demos" }, limits: { maxAdditionalPairs: 2, maxRenderedPages: 4, maxFindings: 6, maxChildren: 3, maxDepth: 1 }, selectedPairIds: [], revision: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
    });
    const reopened = new LocalStore(path).snapshot();
    assert.equal(reopened.paymentChildren.pay_1, "paid_1");
    assert.equal(reopened.paidAudits.paid_1.parentAuditId, "free_1");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("PRECOVERY-01 corrupt production state fails startup closed", () => {
  const root = mkdtempSync(join(tmpdir(), "nativas-paid-store-"));
  try {
    const path = join(root, "state.json");
    writeFileSync(path, "{not-json");
    assert.throws(() => new LocalStore(path), /PERSISTENCE_CORRUPT/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("PRECOVERY-01 migrates the original parent-only audit map without losing it", () => {
  const root = mkdtempSync(join(tmpdir(), "nativas-paid-store-"));
  try {
    const path = join(root, "state.json");
    writeFileSync(path, JSON.stringify({ free_1: { auditId: "free_1", status: "FREE_REPORT" } }));
    assert.equal(new LocalStore(path).snapshot().freeAudits.free_1.auditId, "free_1");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("PRECOVERY-01 rejects structurally unrelated JSON rather than silently resetting", () => {
  const root = mkdtempSync(join(tmpdir(), "nativas-paid-store-"));
  try {
    const path = join(root, "state.json");
    writeFileSync(path, JSON.stringify({ version: 2, freeAudits: {} }));
    assert.throws(() => new LocalStore(path), /PERSISTENCE_CORRUPT/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
