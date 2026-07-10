#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { corpusDigest, validateCorpus } from "../../apps/kb-mcp/src/retrieval.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outIndex = process.argv.indexOf("--out");
const out = outIndex >= 0 ? path.resolve(process.argv[outIndex + 1]) : path.join(root, ".runtime", "gbrain-import");
if (!out || out === root) throw new Error("provide --out <directory>");
const fixture = path.join(root, "fixtures/contracts/golden-record.v1.json");
const records = JSON.parse(await readFile(fixture, "utf8"));
validateCorpus(records);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const record of records) await writeFile(path.join(out, `${record.id}.md`), markdown(record), "utf8");
await writeFile(path.join(out, "manifest.json"), `${JSON.stringify({ schemaVersion: "1.0", corpusVersion: "golden-six-v1", recordCount: records.length, sha256: corpusDigest(records), source: "fixtures/contracts/golden-record.v1.json", generatedBy: "scripts/kb/build-import.mjs" }, null, 2)}\n`, "utf8");
process.stdout.write(`Prepared ${records.length} records at ${out}\n`);

function markdown(record) {
  const frontmatter = { id: record.id, version: record.version, direction: record.direction, sourceLocale: record.sourceLocale, targetLocale: record.targetLocale, componentType: record.componentType, patternType: record.patternType, reviewerStatus: record.reviewerStatus, keywords: record.keywords };
  return `---\n${Object.entries(frontmatter).map(([key, value]) => `${key}: ${Array.isArray(value) ? JSON.stringify(value) : value}`).join("\n")}\n---\n\n# ${record.id}\n\n## Context\n${record.industry}; ${record.audience}; ${record.category}\n\n## Source copy\n${record.sourceCopy}\n\n## Current target copy\n${record.currentTargetCopy}\n\n## Recommended target copy\n${record.recommendedTargetCopy}\n\n## Intent\n${record.intent}\n\n## Rationale\n${record.rationale}\n\n## Visual constraints\n${record.visualConstraints.map((item) => `- ${item}`).join("\n")}\n\n## Evidence\n- Sources: ${record.sourceUrls.join(", ")}\n- Screenshot: ${record.screenshotArtifactRef}\n- Captured: ${record.capturedAt}\n- Reviewed: ${record.reviewedAt}\n`;
}
