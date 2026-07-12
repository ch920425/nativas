import { execFileSync } from "node:child_process";

export const SUPABASE_URL_KEYCHAIN_SERVICE = "nativas-supabase-db-url";

/**
 * Resolve which gbrain engine the isolated nativas brain uses.
 *
 * Selection order:
 * 1. `GBRAIN_DATABASE_URL` / `NATIVAS_GBRAIN_DATABASE_URL` environment value.
 * 2. macOS Keychain service `nativas-supabase-db-url` (Supabase Postgres).
 * 3. PGLite file engine configured under `GBRAIN_HOME` (deterministic fallback).
 *
 * `NATIVAS_GBRAIN_ENGINE=pglite` pins PGLite even when a Postgres URL exists.
 * The returned env is what `gbrain` subprocesses must receive; the connection
 * string never appears in the safe descriptor and must never be logged.
 */
export function resolveGbrainEngine(baseEnv = process.env, readSecret = readKeychainSecret) {
  const pinned = baseEnv.NATIVAS_GBRAIN_ENGINE === "pglite";
  const configured = firstText(baseEnv.GBRAIN_DATABASE_URL, baseEnv.NATIVAS_GBRAIN_DATABASE_URL);
  const url = pinned ? "" : configured || readSecret(SUPABASE_URL_KEYCHAIN_SERVICE);
  if (!url) {
    const env = { ...baseEnv };
    delete env.GBRAIN_DATABASE_URL;
    return { engine: "pglite", env };
  }
  assertPostgresUrl(url);
  return {
    engine: "postgres",
    env: { ...baseEnv, GBRAIN_DATABASE_URL: url },
    directSupabaseConnection: /db\.[a-z]+\.supabase\.co|\.supabase\.co:5432/.test(url),
  };
}

/** Log-safe engine descriptor: never includes the connection string. */
export function describeGbrainEngine(resolved) {
  return { engine: resolved.engine, ...(resolved.directSupabaseConnection ? { warning: "direct Supabase connection is IPv6-only; prefer the session pooler URL" } : {}) };
}

function assertPostgresUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("GBRAIN_DATABASE_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) throw new Error("GBRAIN_DATABASE_URL_INVALID");
}

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
}

export function readKeychainSecret(service) {
  if (process.platform !== "darwin") return "";
  try {
    return execFileSync("security", ["find-generic-password", "-a", process.env.USER ?? "", "-s", service, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
