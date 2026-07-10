import assert from "node:assert/strict";
import { chmod, mkdir, readFile, mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { corpusDigest, getPage, loadCorpus, retrieve, validateCorpus, validateRetrievalRequest } from "../../apps/kb-mcp/src/retrieval.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const cases = JSON.parse(await readFile(path.join(root, "fixtures/kb/retrieval-cases.json"), "utf8"));

test("golden corpus is valid, immutable-shaped, and direction-balanced", async () => {
  const records = await loadCorpus();
  assert.equal(validateCorpus(records), true);
  assert.equal(records.length, 6);
  assert.match(corpusDigest(records), /^[a-f0-9]{64}$/);
  for (const direction of ["KR_TO_US", "US_TO_KR"]) {
    const components = new Set(records.filter((record) => record.direction === direction).map((record) => record.componentType));
    assert.ok(["HERO_HEADLINE", "VALUE_PROPOSITION"].some((type) => components.has(type)));
    assert.ok(components.has("PRIMARY_CTA"));
    assert.ok(components.has("TRUST_COPY"));
  }
  assert.ok(records.every((record) => record.keywords.includes("DEMO_SEED")), "unresearched fixture must stay visibly demo-labeled");
});

for (const expected of cases) test(`keyword fallback retrieves ${expected.name} in top three`, async () => {
  const records = await loadCorpus();
  const response = retrieve(records, { direction: expected.direction, componentType: expected.componentType, query: expected.query, limit: 3 });
  assert.equal(response.mode, "KEYWORD_DETERMINISTIC");
  assert.ok(response.results.length <= 3);
  assert.ok(response.results.some((record) => record.id === expected.expectedId));
  assert.ok(response.results.every((record) => record.direction === expected.direction));
});

test("retrieval validates adversarial filters and never crosses locale direction", async () => {
  const records = await loadCorpus();
  for (const request of [null, {}, { direction: "KR_TO_US", componentType: "BODY_COPY" }, { direction: "KR_TO_US", limit: 0 }, { direction: "KR_TO_US", query: 3 }, { direction: "KR_TO_US", sourceLocale: "en-US" }, { direction: "US_TO_KR", targetLocale: "en-US" }]) {
    assert.throws(() => validateRetrievalRequest(request));
  }
  const result = retrieve(records, { direction: "KR_TO_US", sourceLocale: "ko-KR", targetLocale: "en-US", limit: 999 });
  assert.equal(result.results.length, 3);
  assert.ok(result.results.every((record) => record.direction === "KR_TO_US" && record.sourceLocale === "ko-KR" && record.targetLocale === "en-US"));
});

test("corpus rejects duplicate IDs, locale mismatches, and missing mandatory coverage", async () => {
  const records = await loadCorpus();
  const duplicate = structuredClone(records);
  duplicate[1].id = duplicate[0].id;
  assert.throws(() => validateCorpus(duplicate), /duplicate/);
  const mismatch = structuredClone(records);
  mismatch[0].targetLocale = "ko-KR";
  assert.throws(() => validateCorpus(mismatch), /direction\/locales/);
  const missingTrust = structuredClone(records);
  missingTrust[5].componentType = "HERO_HEADLINE";
  assert.throws(() => validateCorpus(missingTrust), /trust language/);
  const invalidEvidence = structuredClone(records);
  invalidEvidence[0].sourceUrls = ["not a public URL"];
  assert.throws(() => validateCorpus(invalidEvidence), /source URLs/);
  const invalidScreenshot = structuredClone(records);
  invalidScreenshot[0].screenshotArtifactRef = "file:///private-evidence.png";
  assert.throws(() => validateCorpus(invalidScreenshot), /screenshot reference/);
  const invalidTimestamp = structuredClone(records);
  invalidTimestamp[0].capturedAt = "not-a-date";
  assert.throws(() => validateCorpus(invalidTimestamp), /UTC timestamps/);
});

test("get_page is read-only, returns bounded evidence, and unknown IDs fail closed", async () => {
  const records = await loadCorpus();
  const before = JSON.stringify(records);
  const page = getPage(records, "DEMO_SEED_US_KR_CTA");
  assert.equal(page.id, "DEMO_SEED_US_KR_CTA");
  assert.equal(page.supportLabel, "DEMO_REFERENCE_MATERIAL");
  assert.match(page.screenshotArtifactRef, /^https:/);
  assert.equal(JSON.stringify(records), before);
  assert.throws(() => getPage(records, "not-a-record"), /unknown record/);
});

test("import preparation is reproducible and yields six markdown pages plus a manifest", async () => {
  const first = await mkdtemp(path.join(os.tmpdir(), "nativas-kb-a-"));
  const second = await mkdtemp(path.join(os.tmpdir(), "nativas-kb-b-"));
  for (const out of [first, second]) {
    const result = spawnSync(process.execPath, ["scripts/kb/build-import.mjs", "--out", out], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  const read = async (directory) => Object.fromEntries(await Promise.all((await readdir(directory)).sort().map(async (file) => [file, await readFile(path.join(directory, file), "utf8")])));
  assert.deepEqual(await read(first), await read(second));
  assert.equal((await readdir(first)).filter((name) => name.endsWith(".md")).length, 6);
  const manifest = JSON.parse(await readFile(path.join(first, "manifest.json"), "utf8"));
  assert.equal(manifest.recordCount, 6);
  assert.equal(manifest.pages.length, 6);
  assert.match(manifest.corpusSha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.manifestSha256, /^[a-f0-9]{64}$/);
  const expected = JSON.parse(await readFile(path.join(root, "fixtures/kb/expected-manifest.v1.json"), "utf8"));
  assert.deepEqual(manifest, expected);
});

test("import preparation supports a deterministic isolated output override", async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), "nativas-kb-import-default-"));
  const result = spawnSync(process.execPath, ["scripts/kb/build-import.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NATIVAS_KB_IMPORT_OUT: out }
  });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(path.join(out, "manifest.json"), "utf8"));
  assert.equal(manifest.recordCount, 6);
});

test("gbrain preparation refuses the default personal home before any import", () => {
  const result = spawnSync(process.execPath, ["scripts/kb/prepare-gbrain.mjs", "--home", path.join(process.env.HOME, ".gbrain"), "--import", root], { cwd: root, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /personal default GBRAIN_HOME/);
});

test("gbrain preparation requires explicit isolated paths and stops on an init failure", async () => {
  const missing = spawnSync(process.execPath, ["scripts/kb/prepare-gbrain.mjs"], { cwd: root, encoding: "utf8" });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Usage:/);

  const sandbox = await mkdtemp(path.join(os.tmpdir(), "nativas-kb-gbrain-init-error-"));
  const bin = path.join(sandbox, "bin");
  const imported = path.join(sandbox, "import");
  await mkdir(bin);
  await mkdir(imported);
  const fakeGbrain = path.join(bin, "gbrain");
  await writeFile(fakeGbrain, "#!/bin/sh\nif [ \"$1\" = \"init\" ]; then exit 7; fi\nexit 0\n", "utf8");
  await chmod(fakeGbrain, 0o755);
  const failed = spawnSync(process.execPath, ["scripts/kb/prepare-gbrain.mjs", "--home", path.join(sandbox, "isolated"), "--import", imported], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` }
  });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /gbrain init --pglite --no-embedding failed/);
});

test("gbrain preparation uses an isolated home and preserves keyword fallback after a bounded embedding failure", async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "nativas-kb-gbrain-"));
  const bin = path.join(sandbox, "bin");
  const imported = path.join(sandbox, "import");
  await mkdir(bin);
  await mkdir(imported);
  const fakeGbrain = path.join(bin, "gbrain");
  await writeFile(fakeGbrain, "#!/bin/sh\nif [ \"$1\" = \"embed\" ]; then exit 1; fi\nexit 0\n", "utf8");
  await chmod(fakeGbrain, 0o755);
  const result = spawnSync(process.execPath, ["scripts/kb/prepare-gbrain.mjs", "--home", path.join(sandbox, "isolated"), "--import", imported, "--try-embeddings"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, HOME: path.join(sandbox, "home"), PATH: `${bin}${path.delimiter}${process.env.PATH}` }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Embedding unavailable or timed out/);
  assert.match(result.stdout, /deterministic keyword fallback is active/);
});

test("gbrain preparation accepts an isolated environment home and a successful optional embedding pass", async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "nativas-kb-gbrain-env-"));
  const bin = path.join(sandbox, "bin");
  const imported = path.join(sandbox, "import");
  await mkdir(bin);
  await mkdir(imported);
  const fakeGbrain = path.join(bin, "gbrain");
  await writeFile(fakeGbrain, "#!/bin/sh\nexit 0\n", "utf8");
  await chmod(fakeGbrain, 0o755);
  const home = path.join(sandbox, "isolated");
  const result = spawnSync(process.execPath, ["scripts/kb/prepare-gbrain.mjs", "--import", imported, "--try-embeddings"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, HOME: path.join(sandbox, "home"), GBRAIN_HOME: home, PATH: `${bin}${path.delimiter}${process.env.PATH}` }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Embedding unavailable or timed out/);
  assert.match(result.stdout, new RegExp(`Initialized isolated nativas gbrain at ${home}`));
});

test("gbrain preparation does not attempt embeddings unless explicitly requested", async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "nativas-kb-gbrain-no-embed-"));
  const bin = path.join(sandbox, "bin");
  const imported = path.join(sandbox, "import");
  await mkdir(bin);
  await mkdir(imported);
  const fakeGbrain = path.join(bin, "gbrain");
  await writeFile(fakeGbrain, "#!/bin/sh\nif [ \"$1\" = \"embed\" ]; then exit 9; fi\nexit 0\n", "utf8");
  await chmod(fakeGbrain, 0o755);
  const result = spawnSync(process.execPath, ["scripts/kb/prepare-gbrain.mjs", "--home", path.join(sandbox, "isolated"), "--import", imported], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Embedding unavailable or timed out/);
});
