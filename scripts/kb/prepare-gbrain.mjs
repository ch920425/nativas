#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { describeGbrainEngine, resolveGbrainEngine } from "../../apps/kb-mcp/src/gbrain-env.mjs";

const home = option("--home") ?? process.env.GBRAIN_HOME;
const imported = option("--import");
const engineChoice = option("--engine") ?? "pglite";
if (!home || !imported) throw new Error("Usage: prepare-gbrain.mjs --home <isolated GBRAIN_HOME> --import <prepared Markdown directory> [--engine pglite|supabase] [--try-embeddings]");
if (!["pglite", "supabase"].includes(engineChoice)) throw new Error("--engine must be pglite or supabase");
await access(imported);
if (path.resolve(home) === path.join(process.env.HOME ?? "", ".gbrain")) throw new Error("refusing to use the personal default GBRAIN_HOME");

let environment = { ...process.env, GBRAIN_HOME: home };
if (engineChoice === "supabase") {
  const resolved = resolveGbrainEngine(environment);
  if (resolved.engine !== "postgres") {
    throw new Error("Supabase engine requested but no Postgres URL was found. Set NATIVAS_GBRAIN_DATABASE_URL or store the session-pooler URL in Keychain service nativas-supabase-db-url.");
  }
  process.stdout.write(`${JSON.stringify(describeGbrainEngine(resolved))}\n`);
  environment = resolved.env;
  run(["init", "--non-interactive", "--no-embedding"], environment);
} else {
  delete environment.GBRAIN_DATABASE_URL;
  run(["init", "--pglite", "--no-embedding"], environment);
}
run(["import", imported, "--no-embed"], environment);
if (process.argv.includes("--try-embeddings")) {
  const result = spawnSync("gbrain", ["embed", "--all"], { env: environment, stdio: "inherit", timeout: 300_000 });
  if (result.status !== 0 || result.signal) process.stdout.write("Embedding unavailable or timed out; deterministic keyword fallback remains active.\n");
}
process.stdout.write(engineChoice === "supabase"
  ? `Initialized isolated nativas gbrain at ${home} on the Supabase Postgres engine.\n`
  : `Initialized isolated nativas gbrain at ${home} on the PGLite engine; deterministic keyword fallback is active.\n`);

function option(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function run(args, env) { const result = spawnSync("gbrain", args, { env, stdio: "inherit" }); if (result.status !== 0) throw new Error(`gbrain ${args.join(" ")} failed`); }
