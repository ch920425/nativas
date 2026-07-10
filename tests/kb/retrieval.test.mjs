import assert from "node:assert/strict";
import { readFile, mkdtemp, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { corpusDigest, getPage, loadCorpus, retrieve, validateCorpus } from "../../apps/kb-mcp/src/retrieval.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const cases = JSON.parse(await readFile(path.join(root, "fixtures/kb/retrieval-cases.json"), "utf8"));

test("golden corpus is valid, immutable-shaped, and direction-balanced", async () => {
  const records = await loadCorpus();
  assert.equal(validateCorpus(records), true);
  assert.equal(records.length, 6);
  assert.match(corpusDigest(records), /^[a-f0-9]{64}$/);
});

for (const expected of cases) test(`keyword fallback retrieves ${expected.name} in top three`, async () => {
  const records = await loadCorpus();
  const response = retrieve(records, { direction: expected.direction, componentType: expected.componentType, query: expected.query, limit: 3 });
  assert.equal(response.mode, "KEYWORD_DETERMINISTIC");
  assert.ok(response.results.length <= 3);
  assert.ok(response.results.some((record) => record.id === expected.expectedId));
  assert.ok(response.results.every((record) => record.direction === expected.direction));
});

test("get_page is read-only and unknown IDs fail closed", async () => {
  const records = await loadCorpus();
  assert.equal(getPage(records, "DEMO_SEED_US_KR_03").id, "DEMO_SEED_US_KR_03");
  assert.throws(() => getPage(records, "not-a-record"), /unknown record/);
});

test("import preparation is reproducible and yields six markdown pages plus a manifest", async () => {
  const first = await mkdtemp(path.join(os.tmpdir(), "navitas-kb-a-"));
  const second = await mkdtemp(path.join(os.tmpdir(), "navitas-kb-b-"));
  for (const out of [first, second]) {
    const result = spawnSync(process.execPath, ["scripts/kb/build-import.mjs", "--out", out], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  const read = async (directory) => Object.fromEntries(await Promise.all((await readdir(directory)).sort().map(async (file) => [file, await readFile(path.join(directory, file), "utf8")])));
  assert.deepEqual(await read(first), await read(second));
  assert.equal((await readdir(first)).filter((name) => name.endsWith(".md")).length, 6);
});
