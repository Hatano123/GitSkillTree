import { GoogleGenAI } from '@google/genai';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { buildExplanationPrompt, parseExplanationInput, parseExplanationResponse } from './explanation.js';
import { fetchGithubApi, parseGithubApiPath } from './githubProxy.js';

setGlobalOptions({ region: 'asia-northeast1', maxInstances: 10 });

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const githubAppPrivateKey = defineSecret('GITHUB_APP_PRIVATE_KEY');
const GITHUB_APP_ID = '4453258';
const GITHUB_INSTALLATION_ID = '150470619';

export const githubApi = onCall(
  {
    secrets: [githubAppPrivateKey],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    const path = parseGithubApiPath(request.data?.path);
    if (!path) throw new HttpsError('invalid-argument', '許可されていないGitHub APIリクエストです。');
    try {
      return await fetchGithubApi(path, GITHUB_APP_ID, GITHUB_INSTALLATION_ID, githubAppPrivateKey.value());
    } catch (error) {
      console.error('Authenticated GitHub request failed.', error);
      throw new HttpsError('unavailable', 'GitHub APIに接続できませんでした。');
    }
  },
);

export const generateExplanation = onCall(
  {
    secrets: [geminiApiKey],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    const input = parseExplanationInput(request.data);
    if (!input) throw new HttpsError('invalid-argument', '説明生成の入力が不正です。');

    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: buildExplanationPrompt(input),
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object',
            properties: {
              customLogs: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'string' },
              },
            },
            required: ['customLogs'],
            additionalProperties: false,
          },
          maxOutputTokens: 400,
          temperature: 0.3,
        },
      });
      const customLogs = parseExplanationResponse(response.text ?? '');
      if (!customLogs) throw new Error('Gemini returned an invalid response.');
      return { customLogs };
    } catch (error) {
      console.error('Gemini explanation failed.', error);
      throw new HttpsError('internal', '説明文を生成できませんでした。');
    }
  },
);
