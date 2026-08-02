import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceNodeGrowth } from '../src/growth.ts';
import { GROWTH_SYSTEM_CASES } from './growth-system-cases.ts';

for (const scenario of GROWTH_SYSTEM_CASES) {
  test(`growth acceptance: ${scenario.id}`, () => {
    const result = advanceNodeGrowth({
      detectedNodeIds: scenario.detectedNodeIds,
      detectionDebug: scenario.detectionDebug,
      previousGrowth: scenario.previousGrowth,
      migrationBaseline: scenario.migrationBaseline,
    });

    assert.equal(result.totalExp, scenario.expected.totalExp, scenario.reason);
    assert.equal(result.gainedExp, scenario.expected.gainedExp, scenario.reason);
    assert.equal(result.scanCount, scenario.expected.scanCount, scenario.reason);
    assert.deepEqual(result.newNodeIds, scenario.expected.newNodeIds, scenario.reason);
    for (const [nodeId, exp] of Object.entries(scenario.expected.nodeExp)) {
      assert.equal(result.nodeProgress[nodeId]?.exp, exp, `${scenario.reason} (${nodeId})`);
    }
    for (const [nodeId, level] of Object.entries(scenario.expected.nodeLevel ?? {})) {
      assert.equal(result.nodeProgress[nodeId]?.level, level, `${scenario.reason} (${nodeId})`);
    }
    assert.deepEqual(result.leveledUpNodeIds, scenario.expected.leveledUpNodeIds ?? [], scenario.reason);
    for (const nodeId of scenario.expected.preservedNodeIds ?? []) {
      assert.ok(result.nodeProgress[nodeId], `${scenario.reason} (${nodeId})`);
    }
  });
}
