export type SkillNodeState = 'acquired' | 'recommended' | 'locked';

export type SkillCategory = 'network' | 'infra' | 'backend' | 'frontend' | 'ai';

export interface SkillNodeData {
  label: string;
  state: SkillNodeState;
  category: SkillCategory;
  description: string;
  iconName: string;
}

export interface RadarDataPoint {
  subject: string;
  A: number;
  fullMark: number;
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
  url: string;
  timestamp: string;
  archetypeName: string;
  scores: RadarDataPoint[];
}
