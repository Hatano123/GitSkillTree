import type { RepositoryFactRecord, RepositoryFacts } from './repositoryFacts';

export type DetectionEvidence = {
  repository: string;
  path: string;
  reason: string;
};

export type EvidenceDetectionRule = {
  detectionNodeId: 'react' | 'fastapi' | 'docker' | 'pytorch' | 'http';
  displayConditions: string[];
  evaluate: (facts: RepositoryFacts) => DetectionEvidence[];
};

const evidenceFromRecords = (
  facts: RepositoryFacts,
  predicate: (record: RepositoryFactRecord) => boolean,
  reason: (record: RepositoryFactRecord) => string,
): DetectionEvidence[] => {
  const seen = new Set<string>();
  return facts.records.flatMap((record) => {
    if (!predicate(record)) return [];
    const key = `${record.repository}:${record.path}:${record.value}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      repository: record.repository,
      path: record.path,
      reason: reason(record),
    }];
  }).slice(0, 5);
};

const dependencyRule = (
  dependencies: string[],
  label: string,
): Pick<EvidenceDetectionRule, 'displayConditions' | 'evaluate'> => {
  const accepted = new Set(dependencies);
  return {
    displayConditions: [
      `解析対象リポジトリの依存定義に ${dependencies.join(' / ')} のいずれかが含まれる`,
    ],
    evaluate: (facts) => evidenceFromRecords(
      facts,
      (record) => record.kind === 'dependency' && accepted.has(record.value),
      (record) => `${record.value} 依存を検出（${label}）`,
    ),
  };
};

export const EVIDENCE_DETECTION_RULES: Record<string, EvidenceDetectionRule> = {
  react: {
    detectionNodeId: 'react',
    ...dependencyRule(['react', 'react-dom', 'react-native'], 'React'),
  },
  fastapi: {
    detectionNodeId: 'fastapi',
    ...dependencyRule(['fastapi'], 'FastAPI'),
  },
  docker: {
    detectionNodeId: 'docker',
    displayConditions: [
      '解析対象リポジトリに Dockerfile または Dockerfile.* が含まれる',
    ],
    evaluate: (facts) => evidenceFromRecords(
      facts,
      (record) => record.kind === 'config' && /^dockerfile(?:\..+)?$/i.test(record.path.split('/').at(-1) ?? ''),
      () => 'Dockerfileを検出',
    ),
  },
  pytorch: {
    detectionNodeId: 'pytorch',
    ...dependencyRule(['torch', 'pytorch', 'torchvision'], 'PyTorch'),
  },
  http: {
    detectionNodeId: 'http',
    ...dependencyRule(['axios', 'got', 'undici', 'node-fetch', 'requests', 'httpx', 'aiohttp'], 'HTTPクライアント'),
  },
};

export function evaluateEvidenceDetectionRules(
  facts: RepositoryFacts,
): Record<string, DetectionEvidence[]> {
  return Object.fromEntries(
    Object.values(EVIDENCE_DETECTION_RULES)
      .map((rule) => [rule.detectionNodeId, rule.evaluate(facts)] as const)
      .filter(([, evidence]) => evidence.length > 0),
  );
}

export function getDetectionDisplayConditions(detectionNodeId: string): string[] {
  return EVIDENCE_DETECTION_RULES[detectionNodeId]?.displayConditions ?? [];
}
