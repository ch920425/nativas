#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { corpusDigest, validateCorpus } from "../../apps/kb-mcp/src/retrieval.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outIndex = process.argv.indexOf("--out");
const out = outIndex >= 0 ? path.resolve(process.argv[outIndex + 1]) : (process.env.NATIVAS_KB_IMPORT_OUT ? path.resolve(process.env.NATIVAS_KB_IMPORT_OUT) : path.join(root, ".runtime", "gbrain-import"));
if (!out || out === root) throw new Error("provide --out <directory>");
const fixture = path.join(root, "fixtures/kb/golden-six.v1.json");
const records = JSON.parse(await readFile(fixture, "utf8"));
validateCorpus(records);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const pages = [];
for (const record of [...records].sort((a, b) => a.id.localeCompare(b.id))) {
  const body = markdown(record);
  await writeFile(path.join(out, `${record.id}.md`), body, "utf8");
  pages.push({ id: record.id, sha256: digest(body) });
}
const manifest = { schemaVersion: "1.0", corpusVersion: "golden-six-v1", recordCount: records.length, corpusSha256: corpusDigest(records), source: "fixtures/kb/golden-six.v1.json", generatedBy: "scripts/kb/build-import.mjs", pages };
await writeFile(path.join(out, "manifest.json"), `${JSON.stringify({ ...manifest, manifestSha256: digest(JSON.stringify(manifest)) }, null, 2)}\n`, "utf8");
process.stdout.write(`Prepared ${records.length} records at ${out}\n`);

function markdown(record) {
  const frontmatter = { id: record.id, version: record.version, direction: record.direction, sourceLocale: record.sourceLocale, targetLocale: record.targetLocale, componentType: record.componentType, patternType: record.patternType, reviewerStatus: record.reviewerStatus, keywords: record.keywords };
  return `---\n${Object.entries(frontmatter).map(([key, value]) => `${key}: ${Array.isArray(value) ? JSON.stringify(value) : value}`).join("\n")}\n---\n\n# ${record.id}\n\n## Context\n${record.industry}; ${record.audience}; ${record.category}\n\n## Source copy\n${record.sourceCopy}\n\n## Current target copy\n${record.currentTargetCopy}\n\n## Recommended target copy\n${record.recommendedTargetCopy}\n\n## Intent\n${record.intent}\n\n## Rationale\n${record.rationale}\n\n## Visual constraints\n${record.visualConstraints.map((item) => `- ${item}`).join("\n")}\n\n## Evidence\n- Sources: ${record.sourceUrls.join(", ")}\n- Screenshot: ${record.screenshotArtifactRef}\n- Captured: ${record.capturedAt}\n- Reviewed: ${record.reviewedAt}\n`;
}

function digest(value) { return createHash("sha256").update(value).digest("hex"); }
