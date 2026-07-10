const API_PREFIX = "/api/";

function unavailable() {
  return Response.json({ error: "API_ORIGIN_NOT_CONFIGURED" }, { status: 503, headers: { "cache-control": "no-store" } });
}

function proxyRequest(request, env) {
  if (!env.API_ORIGIN) return unavailable();
  const origin = new URL(env.API_ORIGIN);
  const incoming = new URL(request.url);
  const upstreamUrl = new URL(`${incoming.pathname}${incoming.search}`, origin);
  const upstream = new Request(upstreamUrl, request);
  upstream.headers.delete("host");
  upstream.headers.set("x-nativas-edge-token", env.EDGE_ORIGIN_TOKEN ?? "");
  upstream.headers.set("x-nativas-edge", "cloudflare-worker");
  return fetch(upstream);
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/health" || pathname.startsWith(API_PREFIX)) return proxyRequest(request, env);
    return env.ASSETS.fetch(request);
  },
};
