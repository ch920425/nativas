import assert from "node:assert/strict";
import test from "node:test";
import { createArtifactCapability, createCaptureSignature, createEvidencePlane, isPublicAddress } from "../../cloudflare/evidence-plane.mjs";

const NOW = Date.parse("2026-07-11T12:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW / 1000);
const CAPTURE_SECRET = "capture-secret-that-is-distinct-from-edge-auth";
const ARTIFACT_SECRET = "artifact-delivery-secret-that-never-leaves-worker";
const PNG_BYTES = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
const PNG_BASE64 = Buffer.from(PNG_BYTES).toString("base64");

class R2Fixture {
  constructor() { this.objects = new Map(); this.failKind = undefined; }
  async put(key, value, options = {}) {
    if (this.failKind && key.includes(this.failKind)) throw new Error("simulated R2 outage");
    if (options.onlyIf?.etagDoesNotMatch === "*" && this.objects.has(key)) return null;
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
    const object = { key, bytes, size: bytes.byteLength, httpMetadata: options.httpMetadata, customMetadata: options.customMetadata };
    this.objects.set(key, object);
    return { key, size: bytes.byteLength };
  }
  async get(key) {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      key, size: object.size, customMetadata: object.customMetadata, httpMetadata: object.httpMetadata,
      body: new Blob([object.bytes]).stream(),
      text: async () => new TextDecoder().decode(object.bytes),
      json: async () => JSON.parse(new TextDecoder().decode(object.bytes)),
      arrayBuffer: async () => object.bytes.buffer.slice(object.bytes.byteOffset, object.bytes.byteOffset + object.bytes.byteLength),
    };
  }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key); }
}

function snapshotPayload(overrides = {}) {
  return {
    result: {
      content: "<!doctype html><html><body><h1>Localized product</h1></body></html>",
      screenshot: PNG_BASE64,
      markdown: "# Localized product",
      accessibilityTree: { role: "RootWebArea", children: [{ role: "heading", name: "Localized product" }] },
      ...overrides,
    },
  };
}

function browserFixture(sequence = [new Response(JSON.stringify(snapshotPayload()), { status: 200, headers: { "content-type": "application/json", "x-browser-ms-used": "321" } })]) {
  const calls = [];
  return {
    calls,
    async quickAction(action, options) {
      calls.push({ action, options });
      const next = sequence.shift();
      if (next instanceof Error) throw next;
      return next ?? new Response(JSON.stringify(snapshotPayload()), { status: 200, headers: { "content-type": "application/json" } });
    },
  };
}

function makeHarness(options = {}) {
  const bucket = options.bucket ?? new R2Fixture();
  const browser = options.browser ?? browserFixture();
  const preflights = [];
  const route = createEvidencePlane({
    now: () => NOW,
    sleep: async () => {},
    resolvePublic: options.resolvePublic ?? (async () => ["93.184.216.34"]),
    fetch: options.fetch ?? (async (url) => { preflights.push(String(url)); return new Response("x", { status: 200 }); }),
  });
  const env = { AUDIT_ARTIFACTS: bucket, BROWSER: browser, CAPTURE_ORIGIN_SECRET: CAPTURE_SECRET, ARTIFACT_DELIVERY_SECRET: ARTIFACT_SECRET };
  return { route, env, bucket, browser, preflights };
}

async function captureRequest(payload, requestId = `req_${crypto.randomUUID().replaceAll("-", "")}`, overrides = {}) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signature = await createCaptureSignature(CAPTURE_SECRET, NOW_SECONDS, requestId, body);
  return new Request("https://nativas.ai/internal/captures", {
    method: "POST", body,
    headers: {
      "content-type": "application/json",
      "x-nativas-capture-request-id": requestId,
      "x-nativas-capture-timestamp": String(overrides.timestamp ?? NOW_SECONDS),
      "x-nativas-capture-signature": overrides.signature ?? signature,
    },
  });
}

function twoPairPayload() {
  return {
    auditId: "paid_audit_01", siteBoundary: "example.com",
    pages: [
      { pairId: "pricing", side: "source", url: "https://ko.example.com/pricing" },
      { pairId: "pricing", side: "target", url: "https://en.example.com/pricing" },
      { pairId: "product", side: "source", url: "https://ko.example.com/product" },
      { pairId: "product", side: "target", url: "https://en.example.com/product" },
    ],
  };
}

test("PCAP-01: two localized pairs persist sixteen immutable, byte-accurate Browser Run artifacts and a manifest", async () => {
  const harness = makeHarness();
  const response = await harness.route(await captureRequest(twoPairPayload()), harness.env);
  assert.equal(response.status, 201);
  const manifest = await response.json();
  assert.equal(manifest.captureId, "capture_paid_audit_01_v1");
  assert.equal(manifest.artifacts.length, 16);
  assert.equal(new Set(manifest.artifacts.map((artifact) => artifact.artifactId)).size, 16);
  assert.deepEqual(new Set(manifest.artifacts.map((artifact) => artifact.kind)), new Set(["SCREENSHOT", "HTML", "MARKDOWN", "ACCESSIBILITY_TREE"]));
  assert.equal(harness.browser.calls.length, 4);
  assert.deepEqual(harness.browser.calls[0], {
    action: "snapshot",
    options: {
      url: "https://ko.example.com/pricing", formats: ["content", "screenshot", "markdown", "accessibilityTree"],
      viewport: { width: 1440, height: 900 }, screenshotOptions: { fullPage: true, type: "png" },
      gotoOptions: { waitUntil: "domcontentloaded", timeout: 30_000 },
    },
  });
  const screenshot = manifest.artifacts.find((artifact) => artifact.kind === "SCREENSHOT");
  assert.equal(screenshot.mimeType, "image/png");
  assert.equal(screenshot.sizeBytes, PNG_BYTES.byteLength);
  assert.match(screenshot.sha256, /^[a-f0-9]{64}$/);
  assert.equal(screenshot.r2Key, `audits/${manifest.auditId}/pairs/${screenshot.pairId}/${screenshot.side.toLowerCase()}/screenshot-${screenshot.sha256}.png`);
  const storedScreenshot = harness.bucket.objects.get(screenshot.r2Key);
  assert.deepEqual(storedScreenshot.bytes, PNG_BYTES);
  assert.equal(storedScreenshot.httpMetadata.contentType, "image/png");
  assert.equal(storedScreenshot.customMetadata.auditId, manifest.auditId);
  assert.equal(storedScreenshot.customMetadata.browserMsUsed, "321");
  assert.ok(harness.bucket.objects.has("audits/paid_audit_01/captures/v1.json"), "manifest is committed after page artifacts");
});

test("PCAP-01: idempotent capture retry returns the persisted manifest while a changed request conflicts", async () => {
  const harness = makeHarness();
  const payload = twoPairPayload();
  const first = await harness.route(await captureRequest(payload, "req_first"), harness.env);
  assert.equal(first.status, 201);
  const retry = await harness.route(await captureRequest(payload, "req_retry"), harness.env);
  assert.equal(retry.status, 200);
  assert.equal(harness.browser.calls.length, 4, "retry does not render again");
  payload.pages[0].url = "https://ko.example.com/different";
  const conflict = await harness.route(await captureRequest(payload, "req_conflict"), harness.env);
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error, "CAPTURE_CONFLICT");
});

test("PSEC-01: capture authentication fails closed for missing, invalid, stale, and replayed credentials", async () => {
  const harness = makeHarness();
  const missing = await harness.route(new Request("https://nativas.ai/internal/captures", { method: "POST", body: JSON.stringify(twoPairPayload()) }), harness.env);
  assert.equal(missing.status, 401);
  assert.equal((await missing.json()).error, "CAPTURE_AUTH_FAILED");
  const invalid = await harness.route(await captureRequest(twoPairPayload(), "req_invalid", { signature: "x".repeat(43) }), harness.env);
  assert.equal(invalid.status, 401);
  const staleBody = JSON.stringify(twoPairPayload());
  const staleTimestamp = NOW_SECONDS - 301;
  const staleSignature = await createCaptureSignature(CAPTURE_SECRET, staleTimestamp, "req_stale", staleBody);
  const stale = await harness.route(new Request("https://nativas.ai/internal/captures", { method: "POST", body: staleBody, headers: {
    "x-nativas-capture-request-id": "req_stale", "x-nativas-capture-timestamp": String(staleTimestamp), "x-nativas-capture-signature": staleSignature,
  } }), harness.env);
  assert.equal(stale.status, 401);
  const request = await captureRequest(twoPairPayload(), "req_replay");
  assert.equal((await harness.route(request.clone(), harness.env)).status, 201);
  const replay = await harness.route(request.clone(), harness.env);
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).error, "CAPTURE_REPLAYED");
});

test("PSEC-02: URL admission and redirect validation reject credentials, ports, IP literals, cross-site hops, and private DNS", async (t) => {
  const unsafe = [
    "https://user:pass@ko.example.com/product", "https://ko.example.com:8443/product", "http://127.0.0.1/product", "https://evil.example.net/product",
  ];
  for (const [index, url] of unsafe.entries()) {
    await t.test(url, async () => {
      const harness = makeHarness();
      const payload = twoPairPayload(); payload.pages = [{ pairId: "product", side: "source", url }];
      const response = await harness.route(await captureRequest(payload, `req_unsafe_${index}`), harness.env);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, "UNSAFE_CAPTURE_URL");
      assert.equal(harness.browser.calls.length, 0);
    });
  }
  await t.test("private DNS answer", async () => {
    const harness = makeHarness({ resolvePublic: async () => { throw Object.assign(new Error("UNSAFE_CAPTURE_RESOLUTION"), { code: "UNSAFE_CAPTURE_RESOLUTION", status: 400 }); } });
    const response = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, "req_private_dns"), harness.env);
    assert.equal((await response.json()).error, "UNSAFE_CAPTURE_RESOLUTION");
    assert.equal(harness.browser.calls.length, 0);
  });
  await t.test("cross-site redirect", async () => {
    const harness = makeHarness({ fetch: async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }) });
    const response = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, "req_redirect"), harness.env);
    assert.equal((await response.json()).error, "UNSAFE_CAPTURE_URL");
    assert.equal(harness.browser.calls.length, 0);
  });
});

test("PSEC-02: public address classifier blocks local, private, metadata, documentation, and mapped-private addresses", () => {
  for (const address of ["0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.1.2", "192.168.1.1", "198.18.0.1", "198.19.0.1", "198.51.100.1", "203.0.113.4", "not-an-address", "::1", "fd00::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("93.184.216.34"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("PCAP-02: Browser Run 429 retries with bounded backoff, then publishes a complete capture", async () => {
  const browser = browserFixture([
    new Response("rate limited", { status: 429 }),
    new Response(JSON.stringify(snapshotPayload()), { status: 200, headers: { "content-type": "application/json" } }),
  ]);
  const harness = makeHarness({ browser });
  const payload = { ...twoPairPayload(), pages: [twoPairPayload().pages[0]] };
  const response = await harness.route(await captureRequest(payload, "req_retry_browser"), harness.env);
  assert.equal(response.status, 201);
  assert.equal(browser.calls.length, 2);
});

test("PCAP-02: missing formats and R2 failures publish no manifest and remove partial page artifacts", async (t) => {
  await t.test("missing accessibility tree", async () => {
    const browser = browserFixture([new Response(JSON.stringify(snapshotPayload({ accessibilityTree: undefined })), { status: 200, headers: { "content-type": "application/json" } })]);
    const harness = makeHarness({ browser });
    const response = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, "req_incomplete"), harness.env);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, "CAPTURE_INCOMPLETE");
    assert.equal([...harness.bucket.objects.keys()].some((key) => key.endsWith("/captures/v1.json")), false);
    assert.equal([...harness.bucket.objects.keys()].some((key) => key.includes("/pairs/")), false);
  });
  await t.test("R2 write failure", async () => {
    const bucket = new R2Fixture(); bucket.failKind = "markdown-";
    const harness = makeHarness({ bucket });
    const response = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, "req_r2_failure"), harness.env);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, "ARTIFACT_STORAGE_FAILED");
    assert.equal([...bucket.objects.keys()].some((key) => key.includes("/pairs/")), false);
    assert.equal([...bucket.objects.keys()].some((key) => key.endsWith("/captures/v1.json")), false);
  });
});

test("PSEC-03: audit-scoped capability delivers only its screenshot with private no-store headers", async () => {
  const harness = makeHarness();
  const capture = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, "req_delivery"), harness.env);
  const manifest = await capture.json();
  const screenshot = manifest.artifacts.find((artifact) => artifact.kind === "SCREENSHOT");
  const html = manifest.artifacts.find((artifact) => artifact.kind === "HTML");
  const capability = await createArtifactCapability(ARTIFACT_SECRET, manifest.auditId, screenshot.artifactId, NOW_SECONDS + 60);
  const response = await harness.route(new Request(`https://nativas.ai/api/audits/${manifest.auditId}/artifacts/${screenshot.artifactId}`, { headers: { authorization: `Bearer ${capability}` } }), harness.env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), PNG_BYTES);

  const wrongAudit = await createArtifactCapability(ARTIFACT_SECRET, "paid_other", screenshot.artifactId, NOW_SECONDS + 60);
  const denied = await harness.route(new Request(`https://nativas.ai/api/audits/${manifest.auditId}/artifacts/${screenshot.artifactId}`, { headers: { authorization: `Bearer ${wrongAudit}` } }), harness.env);
  assert.equal(denied.status, 403);
  const htmlCapability = await createArtifactCapability(ARTIFACT_SECRET, manifest.auditId, html.artifactId, NOW_SECONDS + 60);
  const rawHtml = await harness.route(new Request(`https://nativas.ai/api/audits/${manifest.auditId}/artifacts/${html.artifactId}`, { headers: { authorization: `Bearer ${htmlCapability}` } }), harness.env);
  assert.equal(rawHtml.status, 403, "raw HTML is never browser-readable");
});

test("PSEC-03: an ephemeral capability minted by the authenticated laptop origin delivers a screenshot", async () => {
  const harness = makeHarness();
  const capture = await harness.route(await captureRequest(
    { ...twoPairPayload(), pages: [twoPairPayload().pages[0]] },
    "req_origin_delivery",
  ), harness.env);
  const manifest = await capture.json();
  const screenshot = manifest.artifacts.find((artifact) => artifact.kind === "SCREENSHOT");
  const capability = await createArtifactCapability(CAPTURE_SECRET, manifest.auditId, screenshot.artifactId, NOW_SECONDS + 60);
  const response = await harness.route(new Request(
    `https://nativas.ai/api/audits/${manifest.auditId}/artifacts/${screenshot.artifactId}`,
    { headers: { authorization: `Bearer ${capability}` } },
  ), harness.env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("PINFRA-01: missing Browser, R2, or capture secrets fail closed instead of proxying internal routes", async () => {
  for (const missing of ["BROWSER", "AUDIT_ARTIFACTS", "CAPTURE_ORIGIN_SECRET"]) {
    const harness = makeHarness(); delete harness.env[missing];
    const response = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, `req_missing_${missing}`), harness.env);
    assert.equal(response.status, 503, missing);
    assert.equal((await response.json()).error, "CAPTURE_NOT_CONFIGURED");
  }
});

test("PINFRA-01: Wrangler declares production Browser Run and private R2 bindings", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(source.replace(/^\s*\/\/.*$/gm, ""));
  assert.deepEqual(config.browser, { binding: "BROWSER", remote: true });
  assert.deepEqual(config.r2_buckets, [{ binding: "AUDIT_ARTIFACTS", bucket_name: "nativas-audit-artifacts" }]);
  assert.equal(source.includes("CAPTURE_ORIGIN_SECRET"), false, "secrets never enter Wrangler source");
  assert.equal(source.includes("ARTIFACT_DELIVERY_SECRET"), false, "secrets never enter Wrangler source");
});

test("PSEC-01: bounded parser and schema reject malformed or amplified capture requests before rendering", async (t) => {
  const cases = [
    ["invalid JSON", "{", "INVALID_CAPTURE_REQUEST"],
    ["non-object JSON", "[]", "INVALID_CAPTURE_REQUEST"],
    ["invalid audit ID", { ...twoPairPayload(), auditId: "../audit" }, "INVALID_AUDIT_ID"],
    ["invalid boundary", { ...twoPairPayload(), siteBoundary: "localhost" }, "INVALID_SITE_BOUNDARY"],
    ["non-string boundary", { ...twoPairPayload(), siteBoundary: null }, "INVALID_SITE_BOUNDARY"],
    ["zero pages", { ...twoPairPayload(), pages: [] }, "INVALID_CAPTURE_PAGES"],
    ["five pages", { ...twoPairPayload(), pages: [...twoPairPayload().pages, { pairId: "extra", side: "source", url: "https://example.com/extra" }] }, "INVALID_CAPTURE_PAGES"],
    ["non-object page", { ...twoPairPayload(), pages: [null] }, "INVALID_CAPTURE_PAGE"],
    ["bad pair ID", { ...twoPairPayload(), pages: [{ pairId: "../pair", side: "source", url: "https://example.com/a" }] }, "INVALID_PAIR_ID"],
    ["bad side", { ...twoPairPayload(), pages: [{ pairId: "pair", side: "middle", url: "https://example.com/a" }] }, "INVALID_CAPTURE_SIDE"],
    ["duplicate side", { ...twoPairPayload(), pages: [twoPairPayload().pages[0], twoPairPayload().pages[0]] }, "DUPLICATE_CAPTURE_PAGE"],
    ["fragment", { ...twoPairPayload(), pages: [{ pairId: "pair", side: "source", url: "https://example.com/a#secret" }] }, "UNSAFE_CAPTURE_URL"],
    ["non-web scheme", { ...twoPairPayload(), pages: [{ pairId: "pair", side: "source", url: "file:///etc/passwd" }] }, "UNSAFE_CAPTURE_URL"],
    ["malformed URL", { ...twoPairPayload(), pages: [{ pairId: "pair", side: "source", url: "not a url" }] }, "UNSAFE_CAPTURE_URL"],
    ["oversize URL", { ...twoPairPayload(), pages: [{ pairId: "pair", side: "source", url: `https://example.com/${"x".repeat(600)}` }] }, "UNSAFE_CAPTURE_URL"],
  ];
  for (const [index, [name, payload, expected]] of cases.entries()) {
    await t.test(name, async () => {
      const harness = makeHarness();
      const response = await harness.route(await captureRequest(payload, `req_schema_${index}`), harness.env);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, expected);
      assert.equal(harness.browser.calls.length, 0);
    });
  }
  const harness = makeHarness();
  const oversized = "x".repeat(16_385);
  const response = await harness.route(new Request("https://nativas.ai/internal/captures", { method: "POST", body: oversized, headers: { "content-length": String(oversized.length) } }), harness.env);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, "CAPTURE_REQUEST_TOO_LARGE");
  const empty = await harness.route(new Request("https://nativas.ai/internal/captures", { method: "POST", body: "" }), harness.env);
  assert.equal(empty.status, 413);
});

test("PSEC-02: DNS-over-HTTPS resolver rejects outages, empty answers, and private answers", async (t) => {
  async function run(dnsResponse, requestId) {
    const bucket = new R2Fixture();
    const browser = browserFixture();
    const route = createEvidencePlane({ now: () => NOW, sleep: async () => {}, fetch: async (url) => {
      if (new URL(url).hostname === "cloudflare-dns.com") return dnsResponse;
      return new Response("x", { status: 200 });
    } });
    const response = await route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, requestId), {
      AUDIT_ARTIFACTS: bucket, BROWSER: browser, CAPTURE_ORIGIN_SECRET: CAPTURE_SECRET, ARTIFACT_DELIVERY_SECRET: ARTIFACT_SECRET,
    });
    return { response, browser };
  }
  await t.test("resolver outage", async () => {
    const { response, browser } = await run(new Response("no", { status: 503 }), "req_dns_outage");
    assert.equal(response.status, 502); assert.equal((await response.json()).error, "DNS_VALIDATION_FAILED"); assert.equal(browser.calls.length, 0);
  });
  await t.test("no address records", async () => {
    const { response, browser } = await run(Response.json({ Answer: [{ data: "not-an-address" }] }), "req_dns_empty");
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "UNSAFE_CAPTURE_RESOLUTION"); assert.equal(browser.calls.length, 0);
  });
  await t.test("missing Answer collection", async () => {
    const { response } = await run(Response.json({ Status: 0 }), "req_dns_missing_answers");
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "UNSAFE_CAPTURE_RESOLUTION");
  });
  await t.test("private address", async () => {
    const { response, browser } = await run(Response.json({ Answer: [{ data: "10.0.0.4" }] }), "req_dns_private");
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "UNSAFE_CAPTURE_RESOLUTION"); assert.equal(browser.calls.length, 0);
  });
  await t.test("public answer is rechecked before Browser Run", async () => {
    let dnsCalls = 0;
    const bucket = new R2Fixture(); const browser = browserFixture();
    const route = createEvidencePlane({ now: () => NOW, sleep: async () => {}, fetch: async (url) => {
      if (new URL(url).hostname === "cloudflare-dns.com") { dnsCalls += 1; return Response.json({ Answer: [{ data: "93.184.216.34" }] }); }
      return new Response("x", { status: 416 });
    } });
    const response = await route(await captureRequest({ ...twoPairPayload(), pages: [{ pairId: "product", side: "source", url: "http://example.com:80/product" }] }, "req_dns_public"), {
      AUDIT_ARTIFACTS: bucket, BROWSER: browser, CAPTURE_ORIGIN_SECRET: CAPTURE_SECRET, ARTIFACT_DELIVERY_SECRET: ARTIFACT_SECRET,
    });
    assert.equal(response.status, 201); assert.equal(dnsCalls, 2); assert.equal(browser.calls.length, 1);
  });
});

test("PCAP-02: redirect and preflight policy handles same-site relocation but fails closed on broken or exhausted chains", async (t) => {
  await t.test("same-site redirect", async () => {
    let requests = 0;
    const harness = makeHarness({ fetch: async () => ++requests === 1
      ? new Response(null, { status: 302, headers: { location: "/new-product" } })
      : new Response(null, { status: 206 }) });
    const response = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, "req_same_redirect"), harness.env);
    assert.equal(response.status, 201);
    assert.equal(harness.browser.calls[0].options.url, "https://ko.example.com/new-product");
  });
  await t.test("redirect without location", async () => {
    const harness = makeHarness({ fetch: async () => new Response(null, { status: 302 }) });
    const response = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, "req_no_location"), harness.env);
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "UNSAFE_CAPTURE_REDIRECT");
  });
  await t.test("redirect exhaustion", async () => {
    const harness = makeHarness({ fetch: async (url) => new Response(null, { status: 302, headers: { location: `${new URL(url).pathname}x` } }) });
    const response = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, "req_redirect_loop"), harness.env);
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "UNSAFE_CAPTURE_REDIRECT"); assert.equal(harness.browser.calls.length, 0);
  });
  await t.test("origin failure", async () => {
    const harness = makeHarness({ fetch: async () => new Response("failed", { status: 500 }) });
    const response = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, "req_origin_failure"), harness.env);
    assert.equal(response.status, 502); assert.equal((await response.json()).error, "CAPTURE_PREFLIGHT_FAILED");
  });
});

test("PCAP-02: Browser Run terminal errors, invalid JSON, invalid base64, oversize text, and manifest races never publish", async (t) => {
  const page = { ...twoPairPayload(), pages: [twoPairPayload().pages[0]] };
  const failures = [
    ["terminal exception", [new Error("connection reset")], "BROWSER_CAPTURE_FAILED"],
    ["timeout on every bounded attempt", [new Error("timeout"), new Error("timeout"), new Error("timeout"), new Error("timeout")], "BROWSER_CAPTURE_FAILED"],
    ["server error on every bounded attempt", [new Response("no", { status: 500 }), new Response("no", { status: 503 }), new Response("no", { status: 500 }), new Response("no", { status: 503 })], "BROWSER_CAPTURE_FAILED"],
    ["client error", [new Response("bad", { status: 400 })], "BROWSER_CAPTURE_FAILED"],
    ["invalid JSON", [new Response("not-json", { status: 200 })], "CAPTURE_INCOMPLETE"],
    ["invalid screenshot", [new Response(JSON.stringify(snapshotPayload({ screenshot: "%%%" })), { status: 200 })], "CAPTURE_INCOMPLETE"],
    ["non-PNG screenshot", [new Response(JSON.stringify(snapshotPayload({ screenshot: Buffer.from("plain text").toString("base64") })), { status: 200 })], "CAPTURE_INCOMPLETE"],
    ["empty screenshot", [new Response(JSON.stringify(snapshotPayload({ screenshot: "" })), { status: 200 })], "CAPTURE_INCOMPLETE"],
    ["empty HTML", [new Response(JSON.stringify(snapshotPayload({ content: "" })), { status: 200 })], "CAPTURE_INCOMPLETE"],
    ["oversize markdown", [new Response(JSON.stringify(snapshotPayload({ markdown: "x".repeat(2 * 1024 * 1024 + 1) })), { status: 200 })], "CAPTURE_INCOMPLETE"],
  ];
  for (const [index, [name, sequence, expected]] of failures.entries()) {
    await t.test(name, async () => {
      const harness = makeHarness({ browser: browserFixture(sequence) });
      const response = await harness.route(await captureRequest(page, `req_browser_failure_${index}`), harness.env);
      assert.equal(response.status, 502); assert.equal((await response.json()).error, expected);
      assert.equal([...harness.bucket.objects.keys()].some((key) => key.endsWith("/captures/v1.json")), false);
    });
  }
  await t.test("manifest conditional race", async () => {
    const bucket = new R2Fixture();
    const originalPut = bucket.put.bind(bucket);
    bucket.put = async (key, value, options) => key.endsWith("/captures/v1.json") ? null : originalPut(key, value, options);
    const harness = makeHarness({ bucket });
    const response = await harness.route(await captureRequest(page, "req_manifest_race"), harness.env);
    assert.equal(response.status, 409); assert.equal((await response.json()).error, "CAPTURE_CONFLICT");
    assert.equal([...bucket.objects.keys()].some((key) => key.includes("/pairs/")), false);
  });
  await t.test("artifact conditional write rejection", async () => {
    const bucket = new R2Fixture();
    const originalPut = bucket.put.bind(bucket);
    bucket.put = async (key, value, options) => key.includes("/screenshot-") ? null : originalPut(key, value, options);
    const harness = makeHarness({ bucket });
    const response = await harness.route(await captureRequest(page, "req_artifact_reject"), harness.env);
    assert.equal(response.status, 502); assert.equal((await response.json()).error, "ARTIFACT_STORAGE_FAILED");
    assert.equal([...bucket.objects.keys()].some((key) => key.includes("/pairs/")), false);
  });
  await t.test("binding raw result and meta duration are accepted", async () => {
    const raw = snapshotPayload().result;
    const browser = browserFixture([new Response(JSON.stringify(raw), { status: 200, headers: { "content-type": "application/json" } })]);
    const harness = makeHarness({ browser });
    const response = await harness.route(await captureRequest(page, "req_raw_binding_result"), harness.env);
    assert.equal(response.status, 201);
  });
  await t.test("meta browser duration fallback is persisted", async () => {
    const payload = { ...snapshotPayload(), meta: { browserMsUsed: 987 } };
    const browser = browserFixture([new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } })]);
    const harness = makeHarness({ browser });
    const response = await harness.route(await captureRequest(page, "req_meta_duration"), harness.env);
    assert.equal(response.status, 201);
    const manifest = await response.json();
    assert.equal(harness.bucket.objects.get(manifest.artifacts[0].r2Key).customMetadata.browserMsUsed, "987");
  });
  await t.test("unexpected preflight transport exception is typed and publishes nothing", async () => {
    const harness = makeHarness({ fetch: async () => { throw new Error("socket closed"); } });
    const response = await harness.route(await captureRequest(page, "req_transport_exception"), harness.env);
    assert.equal(response.status, 500); assert.equal((await response.json()).error, "EVIDENCE_PLANE_FAILED");
  });
});

test("PSEC-03: screenshot capabilities reject absent, expired, overlong, missing, and wrong-object access", async (t) => {
  const harness = makeHarness();
  const capture = await harness.route(await captureRequest({ ...twoPairPayload(), pages: [twoPairPayload().pages[0]] }, "req_capability_matrix"), harness.env);
  const manifest = await capture.json();
  const screenshot = manifest.artifacts.find((artifact) => artifact.kind === "SCREENSHOT");
  const url = `https://nativas.ai/api/audits/${manifest.auditId}/artifacts/${screenshot.artifactId}`;
  for (const [name, token] of [
    ["absent", ""],
    ["expired", await createArtifactCapability(ARTIFACT_SECRET, manifest.auditId, screenshot.artifactId, NOW_SECONDS - 1)],
    ["overlong", await createArtifactCapability(ARTIFACT_SECRET, manifest.auditId, screenshot.artifactId, NOW_SECONDS + 901)],
    ["invalid signature", `${NOW_SECONDS + 60}.${"x".repeat(43)}`],
  ]) {
    await t.test(name, async () => {
      const response = await harness.route(new Request(url, { headers: token ? { authorization: `Bearer ${token}` } : {} }), harness.env);
      assert.equal(response.status, 403); assert.equal((await response.json()).error, "ARTIFACT_FORBIDDEN");
    });
  }
  await t.test("missing index", async () => {
    const missingId = "art_missing";
    const token = await createArtifactCapability(ARTIFACT_SECRET, manifest.auditId, missingId, NOW_SECONDS + 60);
    const response = await harness.route(new Request(`https://nativas.ai/api/audits/${manifest.auditId}/artifacts/${missingId}`, { headers: { authorization: `Bearer ${token}` } }), harness.env);
    assert.equal(response.status, 404); assert.equal((await response.json()).error, "ARTIFACT_NOT_FOUND");
  });
  await t.test("missing screenshot object", async () => {
    harness.bucket.objects.delete(screenshot.r2Key);
    const token = await createArtifactCapability(ARTIFACT_SECRET, manifest.auditId, screenshot.artifactId, NOW_SECONDS + 60);
    const response = await harness.route(new Request(url, { headers: { authorization: `Bearer ${token}` } }), harness.env);
    assert.equal(response.status, 404); assert.equal((await response.json()).error, "ARTIFACT_NOT_FOUND");
  });
  await t.test("missing capability verification secrets", async () => {
    const token = await createArtifactCapability(ARTIFACT_SECRET, manifest.auditId, screenshot.artifactId, NOW_SECONDS + 60);
    const env = { ...harness.env };
    delete env.ARTIFACT_DELIVERY_SECRET;
    delete env.CAPTURE_ORIGIN_SECRET;
    const response = await harness.route(new Request(url, { headers: { authorization: `Bearer ${token}` } }), env);
    assert.equal(response.status, 503); assert.equal((await response.json()).error, "CAPTURE_NOT_CONFIGURED");
  });
});

test("PINFRA-01: evidence routes reject wrong methods and unrelated routes fall through", async () => {
  const harness = makeHarness();
  assert.equal((await harness.route(new Request("https://nativas.ai/internal/captures"), harness.env)).status, 405);
  assert.equal((await harness.route(new Request("https://nativas.ai/api/audits/a/artifacts/b", { method: "POST" }), harness.env)).status, 405);
  assert.equal(await harness.route(new Request("https://nativas.ai/not-evidence"), harness.env), undefined);
  assert.equal(typeof createEvidencePlane(), "function", "default Worker dependencies construct without external state");
});

test("PSEC-01: capability and signature constructors reject malformed caller input", async () => {
  await assert.rejects(() => createArtifactCapability(ARTIFACT_SECRET, "bad/audit", "artifact", NOW_SECONDS), /INVALID_AUDIT_ID/);
  await assert.rejects(() => createArtifactCapability(ARTIFACT_SECRET, "audit", "bad/artifact", NOW_SECONDS), /INVALID_ARTIFACT_ID/);
  await assert.rejects(() => createArtifactCapability(ARTIFACT_SECRET, "audit", "artifact", 1.5), /INVALID_ARTIFACT_CAPABILITY/);
  await assert.rejects(() => createCaptureSignature(CAPTURE_SECRET, 1.5, "request", "{}"), /INVALID_CAPTURE_SIGNATURE_INPUT/);
});
