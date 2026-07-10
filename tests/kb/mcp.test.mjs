import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

test("MCP exposes only read-only bounded tools", async () => {
  const child = spawn(process.execPath, ["apps/kb-mcp/src/server.mjs"], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
  const messages = [];
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => messages.push(...chunk.trim().split("\n").filter(Boolean).map(JSON.parse)));
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { direction: "KR_TO_US", componentType: "PRIMARY_CTA", query: "finance CTA", limit: 99 } } })}\n`);
  await waitFor(() => messages.length === 2);
  child.kill();
  assert.deepEqual(messages[0].result.tools.map((tool) => tool.name), ["search", "query", "get_page"]);
  const result = messages[1].result.structuredContent;
  assert.equal(result.mode, "KEYWORD_DETERMINISTIC");
  assert.ok(result.results.length <= 3);
  assert.equal(result.results[0].id, "DEMO_SEED_KR_US_02");
});

function waitFor(predicate, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) { clearInterval(timer); resolve(); }
      else if (Date.now() - started > timeout) { clearInterval(timer); reject(new Error("timed out waiting for MCP response")); }
    }, 10);
  });
}
