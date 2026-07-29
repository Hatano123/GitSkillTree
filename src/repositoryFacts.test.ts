import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractManifestDependencies,
  factsFromLegacyMetadata,
  type RepositoryFactRecord,
  type RepositoryFacts,
} from './repositoryFacts.ts';
import {
  EVIDENCE_DETECTION_RULES,
  evaluateEvidenceDetectionRules,
} from './evidenceDetectionRules.ts';

test('dependency manifests are normalized into one dependency list', () => {
  assert.deepEqual(
    extractManifestDependencies('package.json', JSON.stringify({
      dependencies: { react: '^19.0.0' },
      devDependencies: { vite: '^8.0.0' },
    })),
    ['react', 'vite'],
  );
  assert.deepEqual(
    extractManifestDependencies('requirements.txt', 'fastapi==0.115.0\ntorch>=2.0\n# comment'),
    ['fastapi', 'torch'],
  );
  assert.ok(extractManifestDependencies('pyproject.toml', 'dependencies = ["torch>=2.0", "httpx"]\n').includes('torch'));
});

test('the five MVP nodes are detected from the same facts shown as evidence', () => {
  const records: RepositoryFactRecord[] = [
    { repository: 'web', path: 'package.json', kind: 'dependency', value: 'react' },
    { repository: 'api', path: 'requirements.txt', kind: 'dependency', value: 'fastapi' },
    { repository: 'infra', path: 'Dockerfile', kind: 'config', value: 'Dockerfile' },
    { repository: 'ml', path: 'pyproject.toml', kind: 'dependency', value: 'torch' },
    { repository: 'client', path: 'package.json', kind: 'dependency', value: 'axios' },
  ];
  const facts: RepositoryFacts = {
    ...factsFromLegacyMetadata([], []),
    dependencies: records.filter((record) => record.kind === 'dependency').map((record) => record.value),
    detectedConfigFiles: ['infra:Dockerfile'],
    records,
  };
  const evidence = evaluateEvidenceDetectionRules(facts);

  assert.deepEqual(Object.keys(evidence).sort(), ['docker', 'fastapi', 'http', 'pytorch', 'react']);
  assert.ok(Object.values(evidence).every((items) => items.length > 0));
  assert.equal(Object.keys(EVIDENCE_DETECTION_RULES).length, 5);
});
