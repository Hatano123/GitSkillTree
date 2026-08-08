import type { DetectionDebugInfo, GrowthSnapshot } from '../src/types.ts';

export interface GrowthSystemCase {
  id: string;
  reason: string;
  detectedNodeIds: string[];
  detectionDebug: DetectionDebugInfo;
  previousGrowth: GrowthSnapshot | null;
  migrationBaseline?: boolean;
  expected: {
    totalExp: number;
    gainedExp: number;
    scanCount: number;
    nodeExp: Record<string, number>;
    nodeLevel?: Record<string, 1 | 2 | 3>;
    newNodeIds: string[];
    leveledUpNodeIds?: string[];
    preservedNodeIds?: string[];
  };
}

const baseline: GrowthSnapshot = {
  version: 'node-exp-v2',
  totalExp: 90,
  gainedExp: 90,
  scanCount: 1,
  nodeProgress: {
    git: { exp: 40, level: 1, repositoryKeys: [], lastGainedExp: 40 },
    react: { exp: 50, level: 1, repositoryKeys: ['repository:demo'], lastGainedExp: 50 },
  },
  newNodeIds: ['git', 'react'],
  leveledUpNodeIds: [],
};

export const GROWTH_SYSTEM_CASES: readonly GrowthSystemCase[] = [
  {
    id: 'first-scan-creates-node-exp',
    reason: 'The first strong signal creates visible progress for each detected node.',
    detectedNodeIds: ['git', 'react'],
    detectionDebug: {
      listedRepositoryCount: 1,
      detailedRepositories: [],
      nodeEvidence: [
        { nodeId: 'git', matches: [{ type: 'always', value: '常時開放' }] },
        { nodeId: 'react', matches: [{ type: 'dependency', value: 'react', repository: 'demo' }] },
      ],
    },
    previousGrowth: null,
    expected: { totalExp: 90, gainedExp: 90, scanCount: 1, nodeExp: { git: 40, react: 50 }, newNodeIds: ['git', 'react'] },
  },
  {
    id: 'repeat-scan-cannot-farm-exp',
    reason: 'Scanning identical evidence again must not award EXP.',
    detectedNodeIds: ['git', 'react'],
    detectionDebug: {
      listedRepositoryCount: 1,
      detailedRepositories: [],
      nodeEvidence: [
        { nodeId: 'git', matches: [{ type: 'always', value: '常時開放' }] },
        { nodeId: 'react', matches: [{ type: 'dependency', value: 'react', repository: 'demo' }] },
      ],
    },
    previousGrowth: baseline,
    expected: { totalExp: 90, gainedExp: 0, scanCount: 2, nodeExp: { git: 40, react: 50 }, newNodeIds: [] },
  },
  {
    id: 'new-evidence-grows-one-node',
    reason: 'A new auditable repository signal adds EXP only to its matching node.',
    detectedNodeIds: ['git', 'react'],
    detectionDebug: {
      listedRepositoryCount: 2,
      detailedRepositories: [],
      nodeEvidence: [
        { nodeId: 'git', matches: [{ type: 'always', value: '常時開放' }] },
        { nodeId: 'react', matches: [
          { type: 'dependency', value: 'react', repository: 'demo' },
          { type: 'dependency', value: 'react', repository: 'second-app' },
        ] },
      ],
    },
    previousGrowth: baseline,
    expected: { totalExp: 100, gainedExp: 10, scanCount: 2, nodeExp: { git: 40, react: 60 }, newNodeIds: [] },
  },
  {
    id: 'enough-evidence-levels-up-node',
    reason: 'Accumulated unique evidence changes the node appearance at a stable threshold.',
    detectedNodeIds: ['git', 'react'],
    detectionDebug: {
      listedRepositoryCount: 4,
      detailedRepositories: [],
      nodeEvidence: [
        { nodeId: 'git', matches: [{ type: 'always', value: '常時開放' }] },
        { nodeId: 'react', matches: [
          { type: 'dependency', value: 'react', repository: 'demo' },
          { type: 'dependency', value: 'react', repository: 'second-app' },
          { type: 'dependency', value: 'react', repository: 'third-app' },
          { type: 'dependency', value: 'react', repository: 'fourth-app' },
        ] },
      ],
    },
    previousGrowth: baseline,
    expected: {
      totalExp: 120,
      gainedExp: 30,
      scanCount: 2,
      nodeExp: { git: 40, react: 80 },
      nodeLevel: { react: 2 },
      newNodeIds: [],
      leveledUpNodeIds: ['react'],
    },
  },
  {
    id: 'partial-scan-never-removes-progress',
    reason: 'A temporarily missing node remains in the growth record instead of losing EXP.',
    detectedNodeIds: ['git'],
    detectionDebug: {
      listedRepositoryCount: 1,
      detailedRepositories: [],
      nodeEvidence: [{ nodeId: 'git', matches: [{ type: 'always', value: '常時開放' }] }],
    },
    previousGrowth: baseline,
    expected: { totalExp: 90, gainedExp: 0, scanCount: 2, nodeExp: { git: 40, react: 50 }, newNodeIds: [], preservedNodeIds: ['react'] },
  },
  {
    id: 'migration-establishes-baseline-without-fake-reward',
    reason: 'Existing users get node progress without presenting migration as newly earned EXP.',
    detectedNodeIds: ['git', 'react'],
    detectionDebug: {
      listedRepositoryCount: 1,
      detailedRepositories: [],
      nodeEvidence: [
        { nodeId: 'git', matches: [{ type: 'always', value: '常時開放' }] },
        { nodeId: 'react', matches: [{ type: 'dependency', value: 'react', repository: 'demo' }] },
      ],
    },
    previousGrowth: null,
    migrationBaseline: true,
    expected: { totalExp: 90, gainedExp: 0, scanCount: 1, nodeExp: { git: 40, react: 50 }, newNodeIds: [] },
  },
  {
    id: 'first-scan-awards-each-detected-repository',
    reason: 'A technology found in many repositories should make meaningful progress on the first scan.',
    detectedNodeIds: ['react'],
    detectionDebug: {
      listedRepositoryCount: 5,
      detailedRepositories: [],
      nodeEvidence: [{
        nodeId: 'react',
        matches: ['one', 'two', 'three', 'four', 'five'].map((repository) => ({
          type: 'dependency' as const,
          value: 'react',
          repository,
        })),
      }],
    },
    previousGrowth: null,
    expected: { totalExp: 90, gainedExp: 90, scanCount: 1, nodeExp: { react: 90 }, newNodeIds: ['react'] },
  },
  {
    id: 'multiple-signals-in-one-repository-count-once',
    reason: 'Several strong signals in the same repository must not inflate repository EXP.',
    detectedNodeIds: ['typescript'],
    detectionDebug: {
      listedRepositoryCount: 1,
      detailedRepositories: [],
      nodeEvidence: [{
        nodeId: 'typescript',
        matches: [
          { type: 'language', value: 'TypeScript', repository: 'demo' },
          { type: 'dependency', value: 'typescript', repository: 'demo' },
          { type: 'file', value: 'tsconfig.json', repository: 'demo' },
        ],
      }],
    },
    previousGrowth: null,
    expected: { totalExp: 50, gainedExp: 50, scanCount: 1, nodeExp: { typescript: 50 }, newNodeIds: ['typescript'] },
  },
] as const;
