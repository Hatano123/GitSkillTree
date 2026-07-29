import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILL_NODE_DETAILS, getSkillNodeDetail } from './skillNodeDetails.ts';
import { EVIDENCE_DETECTION_RULES } from './evidenceDetectionRules.ts';

test('MVP exposes details for exactly five skill nodes', () => {
  assert.deepEqual(
    Object.keys(SKILL_NODE_DETAILS).sort(),
    ['ai-pytorch', 'backend-fastapi', 'frontend-react', 'infra-docker', 'network-http'],
  );
});

test('each MVP detail has three project ideas and related nodes', () => {
  for (const detail of Object.values(SKILL_NODE_DETAILS)) {
    assert.equal(detail.projectIdeas.length, 3);
    assert.ok(detail.detectionConditions.length > 0);
    assert.ok(detail.relatedNodeIds.length > 0);
    assert.equal(getSkillNodeDetail(detail.nodeId), detail);
  }
});

test('detail conditions come from the executable detection rules', () => {
  const mapping = {
    'frontend-react': 'react',
    'backend-fastapi': 'fastapi',
    'infra-docker': 'docker',
    'ai-pytorch': 'pytorch',
    'network-http': 'http',
  } as const;

  for (const [nodeId, detectionNodeId] of Object.entries(mapping)) {
    assert.equal(
      SKILL_NODE_DETAILS[nodeId].detectionConditions,
      EVIDENCE_DETECTION_RULES[detectionNodeId].displayConditions,
    );
  }
});
