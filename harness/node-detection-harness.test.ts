import assert from 'node:assert/strict';
import test from 'node:test';
import { detectNodesFromFacts } from '../src/detectNodes.ts';
import { parseManifestDependencies } from '../src/github.ts';
import { NODE_DETECTION_CASES } from './node-detection-cases.ts';

for (const detectionCase of NODE_DETECTION_CASES) {
  test(`user acceptance: ${detectionCase.id}`, () => {
    const dependencies = [
      ...detectionCase.facts.dependencies,
      ...(detectionCase.manifests ?? []).flatMap((manifest) => parseManifestDependencies(manifest.path, manifest.content)),
    ];
    const facts = { ...detectionCase.facts, dependencies };
    const first = detectNodesFromFacts(facts);
    const second = detectNodesFromFacts(facts);

    assert.deepEqual(second, first, `${detectionCase.reason} Detection must be deterministic.`);
    for (const nodeId of detectionCase.expected) {
      assert.ok(first.includes(nodeId), `${detectionCase.reason} Missing expected node: ${nodeId}. Actual: ${first.join(', ')}`);
    }
    for (const nodeId of detectionCase.forbidden) {
      assert.ok(!first.includes(nodeId), `${detectionCase.reason} Unexpected node: ${nodeId}. Actual: ${first.join(', ')}`);
    }
  });
}

test('acceptance case identifiers are unique', () => {
  const ids = NODE_DETECTION_CASES.map((detectionCase) => detectionCase.id);
  assert.equal(new Set(ids).size, ids.length);
});
