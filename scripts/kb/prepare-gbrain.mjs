#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";

const home = option("--home") ?? process.env.GBRAIN_HOME;
const imported = option("--import");
if (!home || !imported) throw new Error("Usage: prepare-gbrain.mjs --home <isolated GBRAIN_HOME> --import <prepared Markdown directory>");
await access(imported);
const environment = { ...process.env, GBRAIN_HOME: home };
run(["init", "--pglite", "--no-embedding"], environment);
run(["import", imported, "--no-embed"], environment);
process.stdout.write(`Initialized isolated navitas gbrain at ${home}; no embeddings were created.\n`);

function option(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function run(args, env) { const result = spawnSync("gbrain", args, { env, stdio: "inherit" }); if (result.status !== 0) throw new Error(`gbrain ${args.join(" ")} failed`); }
