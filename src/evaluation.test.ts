import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateNodes } from './evaluation.ts';

const detected = ['react', 'git', 'typescript', 'javascript', 'docker', 'express', 'nodejs'];

test('same detected GitHub facts always produce the same evaluation', () => {
  assert.deepEqual(evaluateNodes(detected), evaluateNodes([...detected].reverse()));
});

test('scores come from nodes and new nodes are calculated from the previous scan', () => {
  const previous = { acquiredNodeIds: ['git', 'javascript', 'typescript', 'react'] };
  const result = evaluateNodes(detected, previous);
  assert.deepEqual(result.unlockedNodeIds, ['nodejs', 'express', 'docker']);
  assert.equal(result.scores.find((score) => score.subject === 'インフラ')?.A, 45);
  const unchanged = evaluateNodes(previous.acquiredNodeIds, previous);
  assert.deepEqual(unchanged.unlockedNodeIds, []);
  assert.deepEqual(unchanged.scores, evaluateNodes(previous.acquiredNodeIds).scores);
});
