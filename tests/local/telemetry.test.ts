import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { estimateCostUsd, Telemetry } from "../../apps/local-server/src/telemetry.ts";

test("spans measure duration, close once, and persist privacy-safe JSONL", () => {
  const path = join(mkdtempSync(join(tmpdir(), "nativas-telemetry-")), "telemetry.jsonl");
  let clock = 1_000;
  const telemetry = new Telemetry(path, () => clock);
  const handle = telemetry.begin("aud_1", "TOOL", "linkup_search\nwith\tnoise", { paymentId: "pay_1" });
  clock = 1_450;
  const ended = handle.end({ ok: true });
  assert.equal(ended.durationMs, 450);
  assert.equal(ended.outcome, "SUCCEEDED");
  assert.equal(ended.name, "linkup_search with noise");
  assert.equal(handle.end({ ok: false }).outcome, "SUCCEEDED", "a terminal span cannot be reopened");

  telemetry.record("aud_1", "HERMES_RUN", "free_manager_run", { errorCode: "HERMES_RUN_FAILED", correlation: { hermesRunId: "run_9" } });
  const lines = readFileSync(path, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(lines.length, 2);
  assert.equal(lines[1].outcome, "FAILED");
  assert.equal(lines[1].errorCode, "HERMES_RUN_FAILED");
  assert.equal(lines[1].correlation.hermesRunId, "run_9");
  const allKeys = new Set(lines.flatMap((line) => Object.keys(line)));
  for (const forbidden of ["prompt", "input", "output", "query", "html", "apiKey", "secret"]) assert.ok(!allKeys.has(forbidden), `${forbidden} must never persist`);
});

test("trace listing is per-audit, cloned, and bounded", () => {
  const telemetry = new Telemetry(null);
  telemetry.record("aud_a", "STAGE", "FREE_AUDIT");
  telemetry.record("aud_b", "STAGE", "PAID_QUEUED");
  const listed = telemetry.list("aud_a");
  assert.equal(listed.length, 1);
  listed[0].name = "mutated";
  assert.equal(telemetry.list("aud_a")[0].name, "FREE_AUDIT");
  for (let index = 0; index < 350; index += 1) telemetry.record("aud_a", "TOOL", `tool_${index}`);
  assert.ok(telemetry.list("aud_a").length <= 300);
});

test("cost appears only when explicit USD rates are configured", () => {
  const usage = { inputTokens: 2_000_000, outputTokens: 500_000, totalTokens: 2_500_000 };
  assert.equal(estimateCostUsd(usage, {}), undefined);
  assert.equal(estimateCostUsd(usage, { NATIVAS_COST_USD_PER_MTOK_INPUT: "0.60", NATIVAS_COST_USD_PER_MTOK_OUTPUT: "1.20" }), 1.8);
  assert.equal(estimateCostUsd(usage, { NATIVAS_COST_USD_PER_MTOK_INPUT: "abc", NATIVAS_COST_USD_PER_MTOK_OUTPUT: "1.20" }), undefined);
});
