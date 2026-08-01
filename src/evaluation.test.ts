import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTechnologyTrend, EVALUATION_VERSION, evaluateNodes } from './evaluation.ts';

test('maximum category is 100 and tied categories are both 100', () => {
  const result = calculateTechnologyTrend(['react', 'nextjs', 'express', 'python']);
  assert.equal(result.values.frontend, 100);
  assert.equal(result.values.backend, 100);
  assert.equal(result.counts.frontend, 2);
  assert.equal(result.counts.backend, 2);
});

test('zero detections produce zero on every axis', () => {
  const result = calculateTechnologyTrend([]);
  assert.deepEqual(Object.values(result.values), [0, 0, 0, 0, 0]);
  assert.equal(evaluateNodes([]).dataStatus, 'insufficient');
});

test('same detected facts always produce the same evaluation', () => {
  const detected = ['react', 'typescript', 'docker', 'express', 'nodejs'];
  assert.deepEqual(evaluateNodes(detected), evaluateNodes([...detected].reverse()));
});

test('evaluation stores detected counts, version, and new nodes', () => {
  const previous = { acquiredNodeIds: ['typescript', 'react'] };
  const result = evaluateNodes(['react', 'typescript', 'docker', 'express'], previous);
  assert.deepEqual(result.unlockedNodeIds, ['express', 'docker']);
  assert.equal(result.detectedCounts.frontend, 2);
  assert.equal(result.detectedCounts.backend, 1);
  assert.equal(result.evaluationVersion, EVALUATION_VERSION);
  assert.equal(result.dataStatus, 'limited');
});

test('data status follows 0-2, 3-7, and 8+ detection boundaries', () => {
  assert.equal(evaluateNodes(['react', 'typescript']).dataStatus, 'insufficient');
  assert.equal(evaluateNodes(['react', 'typescript', 'vite']).dataStatus, 'limited');
  assert.equal(evaluateNodes(['react', 'typescript', 'vite', 'nextjs', 'tailwind', 'express', 'docker']).dataStatus, 'limited');
  assert.equal(evaluateNodes(['react', 'typescript', 'vite', 'nextjs', 'tailwind', 'express', 'docker', 'pandas']).dataStatus, 'available');
});
