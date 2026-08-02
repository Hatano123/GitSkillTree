export type SkillNodeState = 'acquired' | 'recommended' | 'locked' | 'unlocked';
export type SkillNodeStatus = 'locked' | 'unlocked' | 'new';

export type SkillCategory = 'network' | 'infra' | 'backend' | 'frontend' | 'ai';

export interface DetectionEvidenceMatch {
  type: 'always' | 'language' | 'dependency' | 'file';
  value: string;
  repository?: string;
}

export interface DetectionDebugInfo {
  listedRepositoryCount: number;
  detailedRepositories: { name: string; status: 'read' | 'partial' | 'failed' }[];
  nodeEvidence: { nodeId: string; matches: DetectionEvidenceMatch[] }[];
}

export interface NodeExpProgress {
  exp: number;
  level: 1 | 2 | 3;
  repositoryKeys: string[];
  lastGainedExp: number;
}

export interface GrowthSnapshot {
  version: 'node-exp-v2';
  totalExp: number;
  gainedExp: number;
  scanCount: number;
  nodeProgress: Record<string, NodeExpProgress>;
  newNodeIds: string[];
  leveledUpNodeIds: string[];
}

export interface SkillNodeData {
  [key: string]: unknown;
  label: string;
  state: SkillNodeState;
  category: SkillCategory;
  description: string;
  iconName: string;
  status?: SkillNodeStatus;
  layer?: number;
  recommended?: boolean;
  kind?: 'skill' | 'category' | 'hub';
  detectedCount?: number;
  exp?: number;
  level?: 1 | 2 | 3;
  expProgress?: number;
  gainedExp?: number;
  onClick?: () => void;
  detectionNodeIds?: string[];
}

export interface SkillTreeNode {
  id: string;
  label: string;
  category: SkillCategory;
  layer: number;
  detectionNodeIds: string[];
  relatedNodeIds: string[];
  description: string;
  iconName: string;
  position: { x: number; y: number };
}

export interface RadarDataPoint {
  subject: string;
  A: number;
  fullMark: number;
  detectedCount?: number;
  B?: number;
  previousDetectedCount?: number;
}

export interface ArchetypeInfo {
  name: string;
  description: string;
  themeColor: string; // Tailwind class like text-purple-400
  accentColor: string; // hex color for charts
  scores: RadarDataPoint[];
  nextSteps: string[];
  acquiredNodeIds: string[];
  recommendedNodeIds: string[];
}

export interface ScanRecord {
  id?: string;
  username: string;
  avatarUrl: string;
  timestamp: string;
  archetypeKey: string;
  scores: RadarDataPoint[];
  detectedCounts?: Record<SkillCategory, number>;
  evaluationVersion?: string;
  dataStatus?: 'insufficient' | 'limited' | 'available';
  detectionDebug?: DetectionDebugInfo;
  growth?: GrowthSnapshot;
  acquiredNodeIds: string[];
  recommendedNodeIds: string[];
  unlockedNodeIds: string[];
  previousScanId: string | null;
  customLogs: string[];
}

