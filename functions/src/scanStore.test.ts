import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGithubUsername, parseScanStoreOperation } from './scanStore.ts';

test('normalizes GitHub usernames for stable per-user storage', () => {
  assert.equal(normalizeGithubUsername(' Hatano123 '), 'hatano123');
  assert.equal(normalizeGithubUsername('-invalid'), null);
});

test('accepts bounded scan save operations and rejects malformed input', () => {
  assert.deepEqual(parseScanStoreOperation({
    operation: 'save',
    scan: { username: 'Hatano123', timestamp: '2026-08-08T00:00:00.000Z' },
  }), {
    operation: 'save',
    scan: { username: 'Hatano123', timestamp: '2026-08-08T00:00:00.000Z' },
  });
  assert.equal(parseScanStoreOperation({ operation: 'save', scan: { username: 'bad name' } }), null);
  assert.equal(parseScanStoreOperation({ operation: 'save', scan: { username: 'valid-user', timestamp: 'not-a-date' } }), null);
});
