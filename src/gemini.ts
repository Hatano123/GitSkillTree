import { GoogleGenerativeAI } from '@google/generative-ai';
import type { UserMetadata } from './github';
import type { ScanRecord } from './types';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface AnalysisResult {
  archetypeKey: 'frontend' | 'ai' | 'devops' | 'fullstack';
  scores: { subject: string; A: number; fullMark: number }[];
  acquiredNodeIds: string[];
  recommendedNodeIds: string[];
  unlockedNodeIds: string[];
  customLogs: string[];
}

// All possible node IDs for recommendation candidates
const ALL_NODE_IDS = [
  'git', 'html_css', 'javascript', 'typescript', 'react', 'nextjs', 'tailwind',
  'nodejs', 'express', 'postgresql', 'docker', 'aws', 'github_actions',
  'python', 'pytorch', 'openai', 'langchain'
];

export async function analyzeRepoWithGemini(
  metadata: UserMetadata,
  detectedNodeIds: string[],
  previousScan: ScanRecord | null = null
): Promise<AnalysisResult> {
  if (!API_KEY) {
    throw new Error('Gemini API Key が設定されていません。.envにキーを登録してください。');
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-3.1-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  // Determine unlocked nodes (new since last scan)
  const unlockedNodeIds = previousScan
    ? detectedNodeIds.filter(id => !previousScan.acquiredNodeIds.includes(id))
    : [];

  // Candidate nodes for recommendation (not yet acquired)
  const candidateNodes = ALL_NODE_IDS.filter(id => !detectedNodeIds.includes(id));

  // Compact previous scores (only the numbers)
  const prevScoresCompact = previousScan
    ? previousScan.scores.map(s => `${s.subject}:${s.A}`).join(', ')
    : null;

  // Build ultra-slim prompt
  const prompt = `
開発者スキル評価AI。以下のデータからスコアリングと助言を行ってください。

ユーザー: ${metadata.username} (公開リポ${metadata.publicReposCount}件)
検出済み技術: [${detectedNodeIds.join(', ')}]
言語分布: ${JSON.stringify(metadata.aggregatedLanguages)}
主要パッケージ: [${metadata.packageJsonDeps.slice(0, 15).join(', ')}]
${prevScoresCompact ? `前回スコア: ${prevScoresCompact}` : '初回スキャン'}
${unlockedNodeIds.length > 0 ? `今回新規解放: [${unlockedNodeIds.join(', ')}]` : ''}

回答:
1. scores: 5カテゴリ(ネットワーク,インフラ,バックエンド,フロントエンド,AI)を0-100で${prevScoresCompact ? '前回以上の値で' : ''}算出
2. recommendedNodeIds: 未習得[${candidateNodes.join(', ')}]から次におすすめ最大3つ
3. archetypeKey: frontend/ai/devops/fullstackから1つ
4. customLogs: ${unlockedNodeIds.length > 0 ? `新規解放ノード(${unlockedNodeIds.join(',')})を祝う` : '現状の'}成長コメント3つ(日本語、${metadata.username}さん宛て)

JSON形式:
{
  "archetypeKey": string,
  "scores": [
    { "subject": "ネットワーク", "A": number, "fullMark": 100 },
    { "subject": "インフラ", "A": number, "fullMark": 100 },
    { "subject": "バックエンド", "A": number, "fullMark": 100 },
    { "subject": "フロントエンド", "A": number, "fullMark": 100 },
    { "subject": "AI", "A": number, "fullMark": 100 }
  ],
  "recommendedNodeIds": string[],
  "customLogs": string[]
}
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Merge client-side detection with AI scoring
    return {
      archetypeKey: parsed.archetypeKey,
      scores: parsed.scores,
      acquiredNodeIds: detectedNodeIds,      // From client-side detection (deterministic)
      recommendedNodeIds: parsed.recommendedNodeIds,
      unlockedNodeIds: unlockedNodeIds,       // Computed client-side (deterministic)
      customLogs: parsed.customLogs
    } as AnalysisResult;
  } catch (e) {
    console.error('Failed to parse Gemini JSON output:', responseText, e);
    throw new Error('解析データのJSON変換に失敗しました。');
  }
}

