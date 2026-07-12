import assert from 'node:assert/strict';
import test from 'node:test';
import { ALLOWED_GBRAIN_TOOLS, sanitizeGbrainToolCall } from '../../apps/kb-mcp/src/gbrain-policy.mjs';

test('PEVID-04 gbrain proxy exposes only four read-safe lifecycle tools', () => {
  assert.deepEqual(ALLOWED_GBRAIN_TOOLS, ['search', 'query', 'get_page', 'think']);
  for (const name of ['put_page', 'delete_page', 'submit_job', 'sync_brain']) assert.throws(() => sanitizeGbrainToolCall(name, {}), /not allowed/);
});

test('PEVID-04 gbrain proxy enforces result caps and disables think writes', () => {
  assert.deepEqual(sanitizeGbrainToolCall('search', { query: 'CTA', limit: 99, offset: 20 }), { query: 'CTA', limit: 3, offset: 0 });
  assert.deepEqual(sanitizeGbrainToolCall('query', { query: 'pricing context', limit: 50, detail: 'full' }), { query: 'pricing context', limit: 3, offset: 0, expand: true, detail: 'summary' });
  assert.deepEqual(sanitizeGbrainToolCall('think', { question: 'Reconcile citations', rounds: 9, save: true, take: true }), { question: 'Reconcile citations', rounds: 1, save: false, take: false });
  assert.deepEqual(sanitizeGbrainToolCall('get_page', { id: 'kb_1', fuzzy: true, include_deleted: true }), { slug: 'kb_1', fuzzy: false, include_deleted: false });
});
