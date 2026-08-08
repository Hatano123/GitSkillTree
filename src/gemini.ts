import { getFunctions, httpsCallable } from 'firebase/functions';
import type { DeterministicEvaluation } from './evaluation';
import { app } from './firebase';
import type { UserMetadata } from './github';
import type { DetectionDebugInfo, GrowthSnapshot } from './types';

export interface AnalysisResult extends DeterministicEvaluation {
  customLogs: string[];
  detectionDebug?: DetectionDebugInfo;
  growth?: GrowthSnapshot;
}

interface ExplanationResponse {
  customLogs: string[];
}

const functions = getFunctions(app, 'asia-northeast1');
const generateExplanation = httpsCallable<
  {
    username: string;
    acquiredNodeIds: string[];
    unlockedNodeIds: string[];
    scores: DeterministicEvaluation['scores'];
  },
  ExplanationResponse
>(functions, 'generateExplanation');

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
  const result = await generateExplanation({
    username: metadata.username,
    acquiredNodeIds: evaluation.acquiredNodeIds,
    unlockedNodeIds: evaluation.unlockedNodeIds,
    scores: evaluation.scores,
  });
  return validateExplanation(result.data);
}
