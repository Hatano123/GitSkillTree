import type { DetectionDebugInfo, GrowthSnapshot, NodeExpProgress } from './types.ts';

export const GROWTH_VERSION = 'node-exp-v2' as const;
export const NODE_UNLOCK_EXP = 40;
export const REPOSITORY_EXP = 10;
export const NODE_LEVEL_THRESHOLDS = [0, NODE_UNLOCK_EXP, 70, 100] as const;

export type AdvanceNodeGrowthInput = {
  detectedNodeIds: readonly string[];
  detectionDebug: DetectionDebugInfo;
  previousGrowth: GrowthSnapshot | null;
  migrationBaseline?: boolean;
};

export function nodeLevelForExp(exp: number): 1 | 2 | 3 {
  if (exp >= NODE_LEVEL_THRESHOLDS[3]) return 3;
  if (exp >= NODE_LEVEL_THRESHOLDS[2]) return 2;
  return 1;
}

export function nextNodeLevelExp(level: NodeExpProgress['level']): number | null {
  return level >= 3 ? null : NODE_LEVEL_THRESHOLDS[level + 1];
}

export function nodeExpProgressPercent(progress: NodeExpProgress): number {
  return Math.min(100, Math.round(progress.exp / NODE_LEVEL_THRESHOLDS[3] * 100));
}

function repositoryKey(match: DetectionDebugInfo['nodeEvidence'][number]['matches'][number]): string | null {
  return match.repository ? `repository:${match.repository.toLocaleLowerCase('en-US')}` : null;
}

function cloneProgress(progress: NodeExpProgress): NodeExpProgress {
  return { ...progress, repositoryKeys: [...progress.repositoryKeys], lastGainedExp: 0 };
}

/**
 * Auditable node EXP: first detection grants 40 EXP and every repository with
 * strong detection evidence grants 10 EXP. Repeating a repository grants nothing.
 */
export function advanceNodeGrowth({
  detectedNodeIds,
  detectionDebug,
  previousGrowth,
  migrationBaseline = false,
}: AdvanceNodeGrowthInput): GrowthSnapshot {
  const nodeProgress = Object.fromEntries(
    Object.entries(previousGrowth?.nodeProgress ?? {}).map(([nodeId, progress]) => [nodeId, cloneProgress(progress)]),
  );
  const repositoriesByNode = new Map(detectionDebug.nodeEvidence.map((item) => [
    item.nodeId,
    [...new Set(item.matches.map(repositoryKey).filter((key): key is string => key !== null))],
  ]));
  const newNodeIds: string[] = [];
  const leveledUpNodeIds: string[] = [];
  let gainedExp = 0;

  for (const nodeId of detectedNodeIds) {
    const currentRepositoryKeys = repositoriesByNode.get(nodeId) ?? [];
    const previous = nodeProgress[nodeId];
    if (!previous) {
      const exp = NODE_UNLOCK_EXP + currentRepositoryKeys.length * REPOSITORY_EXP;
      const awardedExp = migrationBaseline ? 0 : exp;
      nodeProgress[nodeId] = {
        exp,
        level: nodeLevelForExp(exp),
        repositoryKeys: currentRepositoryKeys,
        lastGainedExp: awardedExp,
      };
      if (!migrationBaseline) {
        newNodeIds.push(nodeId);
        gainedExp += awardedExp;
      }
      continue;
    }

    const knownRepositories = new Set(previous.repositoryKeys);
    const addedRepositories = currentRepositoryKeys.filter((key) => !knownRepositories.has(key));
    const nodeGainedExp = addedRepositories.length * REPOSITORY_EXP;
    const exp = previous.exp + nodeGainedExp;
    const level = nodeLevelForExp(exp);
    nodeProgress[nodeId] = {
      exp,
      level,
      repositoryKeys: [...new Set([...previous.repositoryKeys, ...currentRepositoryKeys])],
      lastGainedExp: nodeGainedExp,
    };
    gainedExp += nodeGainedExp;
    if (level > previous.level) leveledUpNodeIds.push(nodeId);
  }

  return {
    version: GROWTH_VERSION,
    totalExp: Object.values(nodeProgress).reduce((sum, progress) => sum + progress.exp, 0),
    gainedExp,
    scanCount: (previousGrowth?.scanCount ?? 0) + 1,
    nodeProgress,
    newNodeIds,
    leveledUpNodeIds,
  };
}
