export type SkillNodeState = 'acquired' | 'recommended' | 'locked' | 'unlocked';

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
  // We can include a previous score B dynamically during rendering
  B?: number; 
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
  acquiredNodeIds: string[];
  recommendedNodeIds: string[];
  unlockedNodeIds: string[];
  previousScanId: string | null;
  customLogs: string[];
}

