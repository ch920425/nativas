#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const home = option("--home") ?? process.env.GBRAIN_HOME;
const imported = option("--import");
if (!home || !imported) throw new Error("Usage: prepare-gbrain.mjs --home <isolated GBRAIN_HOME> --import <prepared Markdown directory>");
await access(imported);
if (path.resolve(home) === path.join(process.env.HOME ?? "", ".gbrain")) throw new Error("refusing to use the personal default GBRAIN_HOME");
const environment = { ...process.env, GBRAIN_HOME: home };
run(["init", "--pglite", "--no-embedding"], environment);
run(["import", imported, "--no-embed"], environment);
if (process.argv.includes("--try-embeddings")) {
  const result = spawnSync("gbrain", ["embed", "--all"], { env: environment, stdio: "inherit", timeout: 300_000 });
  if (result.status !== 0 || result.signal) process.stdout.write("Embedding unavailable or timed out; deterministic keyword fallback remains active.\n");
}
process.stdout.write(`Initialized isolated navitas gbrain at ${home}; deterministic keyword fallback is active.\n`);

function option(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function run(args, env) { const result = spawnSync("gbrain", args, { env, stdio: "inherit" }); if (result.status !== 0) throw new Error(`gbrain ${args.join(" ")} failed`); }
