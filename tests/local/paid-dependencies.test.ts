import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { capturePaidPagePairs, createBrowserArtifactCapability } from "../../apps/local-server/src/dependencies.ts";
import type { PaidAudit, PagePair } from "../../packages/contracts/src/index.ts";

test("PCAP-01 local runtime signs the exact Cloudflare capture body and accepts canonical descriptors", { concurrency: false }, async () => {
  const original = globalThis.fetch; const priorSecret = process.env.CAPTURE_ORIGIN_SECRET; process.env.CAPTURE_ORIGIN_SECRET = "capture-secret"; let observed: { body: string; headers: Headers } | undefined;
  const artifact = { artifactId: "art_1", auditId: "paid_1", pairId: "pair_1", side: "TARGET", kind: "SCREENSHOT", r2Key: "audits/paid_1/shot.png", mimeType: "image/png", sha256: "abc", sizeBytes: 10, sourceUrl: "https://example.com/en/pricing", finalUrl: "https://example.com/en/pricing", capturedAt: "2026-01-01T00:00:00Z" };
  globalThis.fetch = async (_input, init) => { observed = { body: String(init?.body), headers: new Headers(init?.headers) }; return Response.json({ artifacts: [artifact] }, { status: 201 }); };
  try {
    const audit = { auditId: "paid_1", input: { homepageUrl: "https://example.com", direction: "KR_TO_US" } } as PaidAudit;
    const pair = { pairId: "pair_1", sourceUrl: "https://example.com/ko/pricing", targetUrl: "https://example.com/en/pricing" } as PagePair;
    const result = await capturePaidPagePairs(audit, [pair]);
    assert.deepEqual(result, [artifact]);
    assert.ok(observed);
    const timestamp = observed!.headers.get("x-nativas-capture-timestamp")!;
    const requestId = observed!.headers.get("x-nativas-capture-request-id")!;
    const expected = createHmac("sha256", "capture-secret").update(`${timestamp}.${requestId}.${observed!.body}`).digest("base64url");
    assert.equal(observed!.headers.get("x-nativas-capture-signature"), expected);
    assert.deepEqual(JSON.parse(observed!.body), { auditId: "paid_1", siteBoundary: "example.com", pages: [{ pairId: "pair_1", side: "source", url: pair.sourceUrl }, { pairId: "pair_1", side: "target", url: pair.targetUrl }] });
  } finally { globalThis.fetch = original; if (priorSecret === undefined) delete process.env.CAPTURE_ORIGIN_SECRET; else process.env.CAPTURE_ORIGIN_SECRET = priorSecret; }
});

test("PCAP-02 capture transport fails closed on noncanonical manifests", { concurrency: false }, async () => {
  const original = globalThis.fetch; const priorSecret = process.env.CAPTURE_ORIGIN_SECRET; process.env.CAPTURE_ORIGIN_SECRET = "capture-secret";
  globalThis.fetch = async () => Response.json({ artifacts: "not-an-array" }, { status: 201 });
  try {
    await assert.rejects(capturePaidPagePairs({ auditId: "paid_1", input: { homepageUrl: "https://example.com" } } as PaidAudit, [{ pairId: "pair_1", sourceUrl: "https://example.com/ko/pricing", targetUrl: "https://example.com/en/pricing" } as PagePair]), /CAPTURE_INCOMPLETE/);
  } finally { globalThis.fetch = original; if (priorSecret === undefined) delete process.env.CAPTURE_ORIGIN_SECRET; else process.env.CAPTURE_ORIGIN_SECRET = priorSecret; }
});

test("PSEC-03 origin mints a five-minute audit-and-artifact-scoped bearer capability", () => {
  const expiresAt = 1_800_000_000;
  const token = createBrowserArtifactCapability("paid_1", "art_1", expiresAt, "capture-secret");
  const expected = createHmac("sha256", "capture-secret").update(`paid_1.art_1.${expiresAt}`).digest("base64url");
  assert.equal(token, `${expiresAt}.${expected}`);
  assert.throws(() => createBrowserArtifactCapability("../other", "art_1", expiresAt, "capture-secret"), /ARTIFACT_CAPABILITY_INVALID/);
});
