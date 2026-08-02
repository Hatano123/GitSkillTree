import { GoogleGenerativeAI } from '@google/generative-ai';
import type { UserMetadata } from './github';
import type { DeterministicEvaluation } from './evaluation';
import type { DetectionDebugInfo, GrowthSnapshot } from './types';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface AnalysisResult extends DeterministicEvaluation {
  customLogs: string[];
  detectionDebug?: DetectionDebugInfo;
  growth?: GrowthSnapshot;
}

function validateExplanation(value: unknown): string[] {
  if (!value || typeof value !== 'object') throw new Error('Gemini response is not an object.');
  const logs = (value as Record<string, unknown>).customLogs;
  if (!Array.isArray(logs) || logs.length !== 3 || !logs.every((log) => typeof log === 'string' && log.trim().length > 0)) {
    throw new Error('Gemini response has invalid feedback.');
  }
  return logs;
}

/** Gemini is intentionally limited to wording; it never returns evaluation fields. */
export async function generateExplanationWithGemini(metadata: UserMetadata, evaluation: DeterministicEvaluation): Promise<string[]> {
  if (!API_KEY) throw new Error('Gemini API Key が設定されていません。');

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite', generationConfig: { responseMimeType: 'application/json' } });
  const prompt = `あなたは確定済みのGitHub技術検出結果を説明するアシスタントです。ノード開放、カテゴリ分類、相対値の計算、検出結果の追加・削除・変更をしないでください。能力、習熟度、適性を評価せず、日本語の自然な説明を3件だけ JSON で返してください。\n\nユーザー: ${metadata.username}\n確定済みノード: ${evaluation.acquiredNodeIds.join(', ') || 'なし'}\n今回新規ノード: ${evaluation.unlockedNodeIds.join(', ') || 'なし'}\n分野別の検出技術数と相対値: ${evaluation.scores.map((item) => `${item.subject}: ${item.detectedCount}件 (${item.A})`).join(', ')}\n\n{"customLogs":["...","...","..."]}`;

  const result = await model.generateContent(prompt);
  try {
    return validateExplanation(JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()));
  } catch (error) {
    console.error('Failed to parse Gemini explanation:', error);
    throw new Error('Gemini の説明文を読み取れませんでした。');
  }
}
