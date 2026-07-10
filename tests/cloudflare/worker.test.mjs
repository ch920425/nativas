import assert from "node:assert/strict";
import test from "node:test";

test("proxies API requests only to the configured tunnel origin and adds the edge token", async () => {
  const { default: worker } = await import("../../cloudflare/worker.mjs");
  const originalFetch = globalThis.fetch;
  let upstream;
  globalThis.fetch = async (request) => {
    upstream = request;
    return new Response('{"ok":true}', { headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(
      new Request("https://nativas.ai/api/audits?source=web", { method: "POST", body: "{}" }),
      { API_ORIGIN: "https://api.nativas.ai", EDGE_ORIGIN_TOKEN: "test-edge-token", ASSETS: { fetch: () => { throw new Error("assets must not serve API"); } } },
    );
    assert.equal(response.status, 200);
    assert.equal(upstream.url, "https://api.nativas.ai/api/audits?source=web");
    assert.equal(upstream.headers.get("x-nativas-edge-token"), "test-edge-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns a typed unavailable response until the API origin secret is configured", async () => {
  const { default: worker } = await import("../../cloudflare/worker.mjs");
  const response = await worker.fetch(new Request("https://nativas.ai/api/audits"), { ASSETS: { fetch: () => new Response("asset") } });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "API_ORIGIN_NOT_CONFIGURED" });
});

test("serves non-API requests from Cloudflare static assets", async () => {
  const { default: worker } = await import("../../cloudflare/worker.mjs");
  let assetRequest;
  const response = await worker.fetch(new Request("https://nativas.ai/"), {
    ASSETS: { fetch: (request) => { assetRequest = request; return new Response("app"); } },
  });
  assert.equal(await response.text(), "app");
  assert.equal(assetRequest.url, "https://nativas.ai/");
});
