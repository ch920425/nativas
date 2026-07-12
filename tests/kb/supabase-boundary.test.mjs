import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { resolveGbrainEngine } from "../../apps/kb-mcp/src/gbrain-env.mjs";

const gbrainHome = fileURLToPath(new URL("../../.runtime/gbrain", import.meta.url));

// Real-engine boundary proof: when a Supabase Postgres URL is configured (env or
// Keychain), the isolated nativas brain must answer through gbrain's own retrieval
// surface. Without a configured URL this skips rather than mocking the engine.
test("configured Supabase Postgres engine serves the isolated nativas corpus through gbrain", (t) => {
  const resolved = resolveGbrainEngine({ ...process.env, GBRAIN_HOME: gbrainHome });
  if (resolved.engine !== "postgres") {
    t.skip("no Supabase Postgres URL configured; PGLite fallback remains the active engine");
    return;
  }
  const result = spawnSync("gbrain", ["list", "-n", "6"], { env: { ...resolved.env, GBRAIN_HOME: gbrainHome }, encoding: "utf8", timeout: 60_000 });
  assert.equal(result.status, 0, `gbrain list failed: ${result.stderr}`);
  assert.match(result.stdout, /DEMO_SEED|demo-seed/i, "expected the six seeded golden records to be listed from the Postgres engine");
});
