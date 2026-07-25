import { GoogleGenerativeAI } from '@google/generative-ai';
import type { UserMetadata } from './github';
import type { DeterministicEvaluation } from './evaluation';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface AnalysisResult extends DeterministicEvaluation {
  customLogs: string[];
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
  const prompt = `あなたは開発学習の応援コメントを書くアシスタントです。以下の評価結果はすでに確定済みです。スコア、ノード、実績、クエスト達成を判定・変更・提案しないでください。日本語の自然な励ましを3件だけ JSON で返してください。\n\nユーザー: ${metadata.username}\n確定済みノード: ${evaluation.acquiredNodeIds.join(', ')}\n今回新規ノード: ${evaluation.unlockedNodeIds.join(', ') || 'なし'}\n確定済みスコア: ${evaluation.scores.map((score) => `${score.subject}:${score.A}`).join(', ')}\n\n{"customLogs":["...","...","..."]}`;

  const result = await model.generateContent(prompt);
  try {
    return validateExplanation(JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()));
  } catch (error) {
    console.error('Failed to parse Gemini explanation:', error);
    throw new Error('Gemini の説明文を読み取れませんでした。');
  }
}
