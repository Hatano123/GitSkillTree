import assert from 'node:assert/strict';
import test from 'node:test';
import { detectAcquiredNodes, detectNodesFromFacts, NODE_SIGNATURES } from './detectNodes.ts';
import type { UserMetadata } from './github.ts';
import { DETECTION_NODE_IDS } from './skillTree.ts';

test('language, exact dependency, and dedicated file each unlock nodes', () => {
  const detected = detectNodesFromFacts({
    languages: ['TypeScript'],
    dependencies: ['next'],
    files: ['services/api/Dockerfile'],
  });
  assert.ok(detected.includes('typescript'));
  assert.ok(detected.includes('nextjs'));
  assert.ok(detected.includes('docker'));
});

test('language source files unlock their language nodes even when not the primary language', () => {
  const detected = detectNodesFromFacts({
    languages: [],
    dependencies: [],
    files: [
      'public/index.html',
      'src/styles/main.css',
      'src/client.tsx',
      'scripts/report.py',
    ],
  });
  assert.ok(detected.includes('html'));
  assert.ok(detected.includes('css'));
  assert.ok(detected.includes('typescript'));
  assert.ok(detected.includes('python'));
});

test('Git is always unlocked without detection evidence', () => {
  assert.ok(detectNodesFromFacts({ languages: [], dependencies: [], files: [] }).includes('git'));
});

test('common OpenCV package variants unlock OpenCV by exact dependency match', () => {
  for (const dependency of ['opencv', 'opencv4', 'opencv-python', 'opencv-python-headless', 'opencv-contrib-python', 'opencv-contrib-python-headless']) {
    assert.ok(detectNodesFromFacts({ languages: [], dependencies: [dependency], files: [] }).includes('opencv'));
  }
  assert.ok(!detectNodesFromFacts({ languages: [], dependencies: ['opencv-helper'], files: [] }).includes('opencv'));
});

test('repository description and name never unlock a node', () => {
  const metadata: UserMetadata = {
    username: 'test', avatarUrl: '', publicReposCount: 1,
    repositories: [{ name: 'next-docker-ai', description: 'Next.js Docker TensorFlow', language: '', stars: 0, updatedAt: '', defaultBranch: 'main', fork: false }],
    aggregatedLanguages: {}, dependencies: [], files: [],
    scanCoverage: { selectedRepositories: 0, inspectedRepositories: 0, failedRepositories: 0, rateLimited: false, remainingRequests: null, resetAt: null },
    scanWarnings: [], recentEvents: [],
  };
  assert.deepEqual(detectAcquiredNodes(metadata), ['git']);
});

test('React alone does not unlock Next.js and matching is deterministic', () => {
  const facts = { languages: [], dependencies: ['react'], files: [] };
  const first = detectNodesFromFacts(facts);
  assert.ok(first.includes('react'));
  assert.ok(!first.includes('nextjs'));
  assert.deepEqual(first, detectNodesFromFacts(facts));
});

test('every tree detection node uses the common signature matcher', () => {
  const signatureIds = new Set(NODE_SIGNATURES.map((signature) => signature.nodeId));
  assert.deepEqual(DETECTION_NODE_IDS.filter((nodeId) => !signatureIds.has(nodeId)), []);
});
