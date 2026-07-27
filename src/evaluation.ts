import type { ScanRecord } from './types';
import { DETECTION_NODE_IDS, getRecommendedDetectionNodeIds } from './skillTree.ts';

export interface DeterministicEvaluation {
  archetypeKey: 'frontend' | 'ai' | 'devops' | 'fullstack';
  scores: { subject: string; A: number; fullMark: number }[];
  acquiredNodeIds: string[];
  recommendedNodeIds: string[];
  unlockedNodeIds: string[];
}

export interface ScoreBreakdown {
  subject: string;
  score: number;
  fullMark: number;
  contributions: { nodeId: string; points: number; acquired: boolean }[];
}

const LEGACY_NODE_IDS = ['git', 'html_css', 'javascript', 'typescript', 'react', 'nextjs', 'tailwind', 'nodejs', 'express', 'postgresql', 'docker', 'aws', 'github_actions', 'python', 'pytorch', 'openai', 'langchain'];
const NODE_IDS = [...new Set([...LEGACY_NODE_IDS, ...DETECTION_NODE_IDS])];
const SCORE_RULES = [
  { subject: 'ネットワーク', nodes: { git: 30, github_actions: 40, aws: 30 } },
  { subject: 'インフラ', nodes: { docker: 45, aws: 35, github_actions: 20 } },
  { subject: 'バックエンド', nodes: { nodejs: 25, express: 25, postgresql: 30, typescript: 20 } },
  { subject: 'フロントエンド', nodes: { html_css: 15, javascript: 20, typescript: 15, react: 20, nextjs: 20, tailwind: 10 } },
  { subject: 'AI', nodes: { python: 20, pytorch: 35, openai: 25, langchain: 20 } },
] as const;

function scoreFor(nodes: Record<string, number>, acquired: Set<string>): number {
  return Math.min(100, Object.entries(nodes).reduce((total, [nodeId, points]) => total + (acquired.has(nodeId) ? points : 0), 0));
}

function chooseArchetype(scores: number[]): DeterministicEvaluation['archetypeKey'] {
  const [, infra, backend, frontend, ai] = scores;
  if (ai > Math.max(infra, backend, frontend)) return 'ai';
  if (infra > Math.max(backend, frontend)) return 'devops';
  if (frontend > backend) return 'frontend';
  return 'fullstack';
}

/** Pure, ordered evaluation: identical detected GitHub facts always produce identical output. */
export function evaluateNodes(detectedNodeIds: readonly string[], previousScan: Pick<ScanRecord, 'acquiredNodeIds'> | null = null): DeterministicEvaluation {
  const detected = new Set(detectedNodeIds);
  const acquiredNodeIds = NODE_IDS.filter((id) => detected.has(id));
  const acquired = new Set<string>(acquiredNodeIds);
  const previous = new Set(previousScan?.acquiredNodeIds ?? []);
  const scoreValues = SCORE_RULES.map((rule) => scoreFor(rule.nodes, acquired));

  return {
    archetypeKey: chooseArchetype(scoreValues),
    scores: SCORE_RULES.map((rule, index) => ({ subject: rule.subject, A: scoreValues[index], fullMark: 100 })),
    acquiredNodeIds,
    recommendedNodeIds: getRecommendedDetectionNodeIds(acquiredNodeIds, 3),
    unlockedNodeIds: previousScan ? acquiredNodeIds.filter((id) => !previous.has(id)) : [],
  };
}

/** Returns the same fixed point rules used for the radar chart, for UI disclosure. */
export function getScoreBreakdown(acquiredNodeIds: readonly string[]): ScoreBreakdown[] {
  const acquired = new Set(acquiredNodeIds);
  return SCORE_RULES.map((rule) => {
    const contributions = Object.entries(rule.nodes).map(([nodeId, points]) => ({
      nodeId,
      points,
      acquired: acquired.has(nodeId),
    }));
    return {
      subject: rule.subject,
      score: scoreFor(rule.nodes, acquired),
      fullMark: 100,
      contributions,
    };
  });
}

export function fallbackExplanation(username: string, unlockedNodeIds: readonly string[]): string[] {
  if (unlockedNodeIds.length > 0) return [`${username}さん、新しいスキルノードを解放しました。`, `今回解放: ${unlockedNodeIds.join(', ')}`, '次のクエストも、リポジトリでの実践を重ねて進めましょう。'];
  return [`${username}さんのスキルツリーをルールベースで更新しました。`, '新しいノードの解放はありませんでした。', '次のクエストに取り組むと、スキルツリーが成長します。'];
}
