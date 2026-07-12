import assert from 'node:assert/strict';
import test from 'node:test';
import { finishRetrievalSpan, retrievalPlan, startRetrievalSpan } from '../../apps/kb-mcp/src/lifecycle.mjs';

const base = { direction: 'KR_TO_US', sourceLocale: 'ko-KR', targetLocale: 'en-US', audience: 'US finance teams', industry: 'fintech', componentType: 'PRIMARY_CTA' };

test('PEVID-04 lifecycle chooses the least expensive sufficient gbrain tool', () => {
  assert.equal(retrievalPlan('FREE_EVIDENCE_RETRIEVAL', { ...base, launchGoal: 'demo requests' })[0].toolName, 'search');
  assert.equal(retrievalPlan('PAID_DISCOVERY_RETRIEVAL', { ...base, pageContext: 'pricing page', issueHypothesis: 'commitment too early' })[0].toolName, 'query');
  assert.deepEqual(retrievalPlan('SPECIALIST_REFERENCE_RESOLUTION', { ...base, recordId: 'kb_1' })[0], { toolName: 'get_page', arguments: { id: 'kb_1' } });
  const reconciliation = retrievalPlan('PARENT_RECONCILIATION', { ...base, question: 'Which recommendation is supported?', recordIds: ['kb_1', 'kb_2'] })[0];
  assert.equal(reconciliation.toolName, 'think');
  assert.equal(reconciliation.arguments.anchor, 'kb_1');
  assert.equal(reconciliation.arguments.save, false);
  assert.match(reconciliation.arguments.question, /kb_1, kb_2/);
});

test('PEVID-04 lifecycle rejects cross-purpose or underspecified retrieval', () => {
  assert.throws(() => retrievalPlan('UNKNOWN', base), /unsupported/);
  assert.throws(() => retrievalPlan('SPECIALIST_REFERENCE_RESOLUTION', base), /recordId/);
  assert.throws(() => retrievalPlan('FREE_EVIDENCE_RETRIEVAL', { ...base, direction: 'FR_TO_US' }), /direction/);
});

test('POBS-02 spans retain fingerprints and IDs but never raw query or result text', () => {
  let tick = 0;
  const now = () => tick++ ? '2026-07-11T00:00:00.125Z' : '2026-07-11T00:00:00.000Z';
  const running = startRetrievalSpan({ auditId: 'audit_1', hermesRunId: 'run_1', stage: 'PAID_DISCOVERY_RETRIEVAL', toolName: 'query', arguments: { query: 'sensitive customer phrase' }, kbVersion: 'golden-six-v1', now, id: () => 'span_1' });
  const done = finishRetrievalSpan(running, { results: [{ id: 'kb_1', content: 'must not persist' }, { id: 'kb_1' }, { id: 'kb_2' }] }, { now });
  assert.equal(done.latencyMs, 125);
  assert.deepEqual(done.recordIds, ['kb_1', 'kb_2']);
  assert.equal(done.resultCount, 2);
  assert.equal(JSON.stringify(done).includes('sensitive customer phrase'), false);
  assert.equal(JSON.stringify(done).includes('must not persist'), false);
  assert.match(done.queryFingerprint, /^[a-f0-9]{64}$/);
  assert.throws(() => finishRetrievalSpan(done, {}), /already terminal/);
});
