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
  version: 'node-exp-v1',
  totalExp: 80,
  gainedExp: 80,
  scanCount: 1,
  nodeProgress: {
    git: { exp: 40, level: 1, evidenceKeys: ['always:常時開放'], lastGainedExp: 40 },
    react: { exp: 40, level: 1, evidenceKeys: ['dependency:demo:react'], lastGainedExp: 40 },
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
    expected: { totalExp: 80, gainedExp: 80, scanCount: 1, nodeExp: { git: 40, react: 40 }, newNodeIds: ['git', 'react'] },
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
    expected: { totalExp: 80, gainedExp: 0, scanCount: 2, nodeExp: { git: 40, react: 40 }, newNodeIds: [] },
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
    expected: { totalExp: 90, gainedExp: 10, scanCount: 2, nodeExp: { git: 40, react: 50 }, newNodeIds: [] },
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
      totalExp: 110,
      gainedExp: 30,
      scanCount: 2,
      nodeExp: { git: 40, react: 70 },
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
    expected: { totalExp: 80, gainedExp: 0, scanCount: 2, nodeExp: { git: 40, react: 40 }, newNodeIds: [], preservedNodeIds: ['react'] },
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
    expected: { totalExp: 80, gainedExp: 0, scanCount: 1, nodeExp: { git: 40, react: 40 }, newNodeIds: [] },
  },
] as const;
