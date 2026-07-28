import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCategoryFlow,
  getNextTreeNodes,
  SKILL_CATEGORIES,
  SKILL_TREE_NODES,
} from './skillTree.ts';

test('fixed tree contains five branched categories with 10 to 12 nodes', () => {
  assert.equal(SKILL_CATEGORIES.length, 5);
  for (const category of SKILL_CATEGORIES) {
    const nodes = SKILL_TREE_NODES.filter((node) => node.category === category.id);
    assert.ok(nodes.length >= 10 && nodes.length <= 12);
    assert.ok(nodes.some((node) => node.relatedNodeIds.length >= 2));
    assert.deepEqual([...new Set(nodes.map((node) => node.layer))], [1, 2, 3, 4]);
  }
});

test('a detected upper-layer technology unlocks without prerequisites', () => {
  const flow = createCategoryFlow('frontend', ['nextjs'], []);
  assert.equal(flow.nodes.find((node) => node.id === 'frontend-nextjs')?.data.status, 'new');
  assert.equal(flow.nodes.find((node) => node.id === 'frontend-react')?.data.status, 'locked');
});

test('next steps are undetected adjacent nodes and limited to three', () => {
  const next = getNextTreeNodes(['javascript', 'react'], 'frontend');
  assert.ok(next.length <= 3);
  assert.ok(next.every((node) => !node.detectionNodeIds.includes('javascript') && !node.detectionNodeIds.includes('react')));
  assert.ok(next.some((node) => node.id === 'frontend-typescript' || node.id === 'frontend-nextjs'));
});
