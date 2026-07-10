import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { LocalAuditService } from "./service.ts";
import { captureHomepagePair, retrieveGoldenReferences, searchMarketEvidence } from "./dependencies.ts";
import { startManagedHermes } from "./hermes-native.ts";

export async function startLocalApi(port = Number(process.env.NATIVAS_API_PORT ?? 8787)) {
  const runtimeRoot = resolve(".runtime/nativas-local");
  const managed = await startManagedHermes(resolve(runtimeRoot, "hermes.log"), Number(process.env.NATIVAS_HERMES_PORT ?? 8642));
  const service = new LocalAuditService({ statePath: resolve(runtimeRoot, "audits.json"), capture: captureHomepagePair, searchMarket: searchMarketEvidence, retrieveGolden: retrieveGoldenReferences, hermes: managed.client });
  const server = createServer(async (request, response) => route(service, request, response));
  await new Promise<void>((resolveReady, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolveReady); });
  return {
    port,
    service,
    async close() {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
      await managed.close();
    },
  };
}

async function route(service: LocalAuditService, request: IncomingMessage, response: ServerResponse) {
  const edgeToken = process.env.NATIVAS_EDGE_TOKEN;
  if (edgeToken && request.headers["x-nativas-edge-token"] !== edgeToken) {
    return send(response, 401, { error: "edge authorization required" });
  }
  response.setHeader("access-control-allow-origin", "http://127.0.0.1:5173");
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  if (request.method === "OPTIONS") return send(response, 204, null);
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  try {
    if (request.method === "GET" && url.pathname === "/health") return send(response, 200, { ok: true, runtime: "local", hermes: "native-runs" });
    if (request.method === "POST" && url.pathname === "/api/audits") return send(response, 201, await service.submit(await body(request)));
    const match = url.pathname.match(/^\/api\/audits\/([^/]+)(?:\/(cancel|checkout))?$/);
    if (!match) return send(response, 404, { error: "not found" });
    const auditId = decodeURIComponent(match[1]);
    if (request.method === "GET" && !match[2]) {
      const view = await service.get(auditId);
      return send(response, view ? 200 : 404, view ?? { error: "Audit not found" });
    }
    if (request.method === "POST" && match[2] === "cancel") return send(response, 200, await service.cancel(auditId));
    if (request.method === "POST" && match[2] === "checkout") return send(response, 200, await service.createCheckout(auditId));
    return send(response, 405, { error: "method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    return send(response, message === "Audit not found" ? 404 : 400, { error: message });
  }
}

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > 64_000) throw new Error("request too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  if (payload === null) return response.end();
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await startLocalApi();
  console.log(`nativas local API ready at http://127.0.0.1:${app.port}`);
  const stop = async () => { await app.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
