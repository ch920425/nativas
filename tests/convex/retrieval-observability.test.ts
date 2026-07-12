import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeRetrievalProjection, compareRetrievalPerformance, type EvalRunProjection } from '../../convex/retrieval_observability.ts';
import { schemaContract } from '../../convex/schema.ts';

const safe = { schemaVersion: '1.0', spanId: 'span_1', auditId: 'audit_1', hermesRunId: 'run_1', stage: 'PARENT_RECONCILIATION', toolName: 'think', kbVersion: 'golden-six-v1', queryFingerprint: 'a'.repeat(64), startedAt: '2026-07-11T00:00:00Z', endedAt: '2026-07-11T00:00:01Z', latencyMs: 1000, outcome: 'SUCCEEDED', resultCount: 2, recordIds: ['kb_1', 'kb_2'] };

test('POBS-02 Convex schema exposes retrieval, tool-call, eval, and comparison indexes', () => {
  assert.deepEqual(schemaContract.retrievalSpans.indexes, ['by_span_id', 'by_audit_started_at', 'by_run_started_at', 'by_stage_outcome', 'by_tool_started_at']);
  assert.ok(schemaContract.agentToolCalls.indexes.includes('by_span'));
  assert.ok(schemaContract.evalCases.indexes.includes('by_risk_id_status'));
  assert.ok(schemaContract.performanceComparisons.indexes.includes('by_candidate_release'));
});

test('POBS-02 safe projection validates bounded privacy-preserving telemetry', () => {
  assert.doesNotThrow(() => assertSafeRetrievalProjection(safe));
  for (const invalid of [
    { ...safe, query: 'raw query' },
    { ...safe, prompt: 'hidden prompt' },
    { ...safe, chainOfThought: 'private reasoning' },
    { ...safe, queryFingerprint: 'not-a-hash' },
    { ...safe, recordIds: Array.from({ length: 7 }, (_, i) => `kb_${i}`) },
    { ...safe, toolName: 'put_page' }
  ]) assert.throws(() => assertSafeRetrievalProjection(invalid));
});

test('POBS-03 comparison flags quality and material p95 regressions', () => {
  const baseline: EvalRunProjection = { schemaVersion: '1.0', evalRunId: 'e1', suite: 'KB_RETRIEVAL_V1', releaseSha: 'old', kbVersion: 'v1', startedAt: '2026-07-11T00:00:00Z', status: 'PASSED', passed: 19, failed: 1, p95LatencyMs: 1000 };
  const improved: EvalRunProjection = { ...baseline, evalRunId: 'e2', releaseSha: 'new', passed: 20, failed: 0, p95LatencyMs: 900 };
  assert.equal(compareRetrievalPerformance(baseline, improved).regressed, false);
  assert.equal(compareRetrievalPerformance(baseline, { ...improved, p95LatencyMs: 1300 }).regressed, true);
  assert.equal(compareRetrievalPerformance(baseline, { ...improved, passed: 18, failed: 2 }).regressed, true);
  assert.throws(() => compareRetrievalPerformance(baseline, { ...improved, status: 'RUNNING' }), /terminal/);
});
