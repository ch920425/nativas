import assert from "node:assert/strict";
import test from "node:test";
import { describeGbrainEngine, resolveGbrainEngine, SUPABASE_URL_KEYCHAIN_SERVICE } from "../../apps/kb-mcp/src/gbrain-env.mjs";

const poolerUrl = "postgresql://postgres.ref:secret-password@aws-0-us-west-1.pooler.supabase.com:6543/postgres";
const base = { GBRAIN_HOME: "/tmp/nativas-gbrain", USER: "tester" };

test("explicit GBRAIN_DATABASE_URL selects the Postgres engine without touching the keychain", () => {
  let keychainReads = 0;
  const resolved = resolveGbrainEngine({ ...base, GBRAIN_DATABASE_URL: poolerUrl }, () => { keychainReads += 1; return ""; });
  assert.equal(resolved.engine, "postgres");
  assert.equal(resolved.env.GBRAIN_DATABASE_URL, poolerUrl);
  assert.equal(resolved.env.GBRAIN_HOME, base.GBRAIN_HOME);
  assert.equal(keychainReads, 0);
});

test("NATIVAS_GBRAIN_DATABASE_URL is honored as the repo-scoped alias", () => {
  const resolved = resolveGbrainEngine({ ...base, NATIVAS_GBRAIN_DATABASE_URL: poolerUrl }, () => "");
  assert.equal(resolved.engine, "postgres");
  assert.equal(resolved.env.GBRAIN_DATABASE_URL, poolerUrl);
});

test("keychain Supabase URL is the fallback when no env URL exists", () => {
  const resolved = resolveGbrainEngine(base, (service) => (service === SUPABASE_URL_KEYCHAIN_SERVICE ? poolerUrl : ""));
  assert.equal(resolved.engine, "postgres");
  assert.equal(resolved.env.GBRAIN_DATABASE_URL, poolerUrl);
});

test("no URL anywhere selects PGLite and strips stale database URLs", () => {
  const resolved = resolveGbrainEngine({ ...base, GBRAIN_DATABASE_URL: "" }, () => "");
  assert.equal(resolved.engine, "pglite");
  assert.ok(!("GBRAIN_DATABASE_URL" in resolved.env));
  assert.equal(resolved.env.GBRAIN_HOME, base.GBRAIN_HOME);
});

test("NATIVAS_GBRAIN_ENGINE=pglite pins PGLite even when a Supabase URL is stored", () => {
  const resolved = resolveGbrainEngine({ ...base, NATIVAS_GBRAIN_ENGINE: "pglite" }, () => poolerUrl);
  assert.equal(resolved.engine, "pglite");
  assert.ok(!("GBRAIN_DATABASE_URL" in resolved.env));
});

test("non-Postgres or malformed URLs fail closed", () => {
  assert.throws(() => resolveGbrainEngine({ ...base, GBRAIN_DATABASE_URL: "mysql://host/db" }, () => ""), /GBRAIN_DATABASE_URL_INVALID/);
  assert.throws(() => resolveGbrainEngine({ ...base, GBRAIN_DATABASE_URL: "not a url" }, () => ""), /GBRAIN_DATABASE_URL_INVALID/);
});

test("direct Supabase connections are flagged and the descriptor never leaks the URL", () => {
  const direct = "postgresql://postgres:secret-password@db.abcdefgh.supabase.co:5432/postgres";
  const resolved = resolveGbrainEngine({ ...base, GBRAIN_DATABASE_URL: direct }, () => "");
  assert.equal(resolved.directSupabaseConnection, true);
  const description = JSON.stringify(describeGbrainEngine(resolved));
  assert.ok(!description.includes("secret-password"));
  assert.ok(!description.includes("supabase.co"));
  const pooled = resolveGbrainEngine({ ...base, GBRAIN_DATABASE_URL: poolerUrl }, () => "");
  assert.ok(!JSON.stringify(describeGbrainEngine(pooled)).includes("secret-password"));
  assert.notEqual(pooled.directSupabaseConnection, true);
});
