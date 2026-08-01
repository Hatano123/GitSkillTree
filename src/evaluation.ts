import type { ScanRecord, SkillCategory } from './types';
import { NODE_SIGNATURES } from './detectNodes.ts';
import { DETECTION_NODE_IDS, getRecommendedDetectionNodeIds } from './skillTree.ts';

export const EVALUATION_VERSION = 'relative-detected-count-v1';

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  network: 'ネットワーク',
  infra: 'インフラ',
  backend: 'バックエンド',
  frontend: 'フロントエンド',
  ai: 'AI',
};

const CATEGORY_ORDER: readonly SkillCategory[] = ['network', 'infra', 'backend', 'frontend', 'ai'];

export interface DeterministicEvaluation {
  archetypeKey: 'frontend' | 'ai' | 'devops' | 'fullstack';
  scores: { subject: string; A: number; fullMark: number; detectedCount: number }[];
  detectedCounts: Record<SkillCategory, number>;
  evaluationVersion: typeof EVALUATION_VERSION;
  dataStatus: 'insufficient' | 'limited' | 'available';
  acquiredNodeIds: string[];
  recommendedNodeIds: string[];
  unlockedNodeIds: string[];
}

const LEGACY_NODE_IDS = ['git', 'html_css', 'javascript', 'typescript', 'react', 'nextjs', 'tailwind', 'nodejs', 'express', 'postgresql', 'docker', 'aws', 'github_actions', 'python', 'pytorch', 'openai', 'langchain'];
const NODE_IDS = [...new Set([...LEGACY_NODE_IDS, ...DETECTION_NODE_IDS])];
// Always-visible foundation nodes are not detected technologies and therefore
// do not affect the relative distribution.
const CATEGORY_BY_NODE = new Map(
  NODE_SIGNATURES.filter((signature) => !signature.always).map((signature) => [signature.nodeId, signature.category]),
);

function chooseArchetype(values: Record<SkillCategory, number>): DeterministicEvaluation['archetypeKey'] {
  if (values.ai > Math.max(values.infra, values.backend, values.frontend)) return 'ai';
  if (values.infra > Math.max(values.backend, values.frontend)) return 'devops';
  if (values.frontend > values.backend) return 'frontend';
  return 'fullstack';
}

export function calculateTechnologyTrend(detectedNodeIds: readonly string[]) {
  const detected = new Set(detectedNodeIds);
  const counts = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0])) as Record<SkillCategory, number>;
  for (const nodeId of detected) {
    const category = CATEGORY_BY_NODE.get(nodeId);
    if (category) counts[category] += 1;
  }
  const maximumDetectedCount = Math.max(...Object.values(counts));
  const values = Object.fromEntries(CATEGORY_ORDER.map((category) => [
    category,
    maximumDetectedCount === 0 ? 0 : Math.round(counts[category] / maximumDetectedCount * 100),
  ])) as Record<SkillCategory, number>;
  return { counts, values, maximumDetectedCount };
}

/** Pure, ordered evaluation: identical detected GitHub facts always produce identical output. */
export function evaluateNodes(detectedNodeIds: readonly string[], previousScan: Pick<ScanRecord, 'acquiredNodeIds'> | null = null): DeterministicEvaluation {
  const detected = new Set(detectedNodeIds);
  const acquiredNodeIds = NODE_IDS.filter((id) => detected.has(id));
  const previous = new Set(previousScan?.acquiredNodeIds ?? []);
  const trend = calculateTechnologyTrend(acquiredNodeIds);
  const total = Object.values(trend.counts).reduce((sum, count) => sum + count, 0);

  return {
    archetypeKey: chooseArchetype(trend.values),
    scores: CATEGORY_ORDER.map((category) => ({
      subject: CATEGORY_LABELS[category],
      A: trend.values[category],
      fullMark: 100,
      detectedCount: trend.counts[category],
    })),
    detectedCounts: trend.counts,
    evaluationVersion: EVALUATION_VERSION,
    dataStatus: total <= 2 ? 'insufficient' : total <= 7 ? 'limited' : 'available',
    acquiredNodeIds,
    recommendedNodeIds: getRecommendedDetectionNodeIds(acquiredNodeIds, 3),
    unlockedNodeIds: previousScan ? acquiredNodeIds.filter((id) => !previous.has(id)) : [],
  };
}

export function fallbackExplanation(username: string, unlockedNodeIds: readonly string[]): string[] {
  if (unlockedNodeIds.length > 0) return [`${username}さんの公開情報から新しい使用技術を確認しました。`, `今回新たに確認: ${unlockedNodeIds.join(', ')}`, '表示はGitHub上の技術傾向であり、能力や習熟度の評価ではありません。'];
  return [`${username}さんの公開情報を更新しました。`, '今回新たに確認できた技術はありませんでした。', '表示はGitHub上で確認できた範囲に限られます。'];
}
