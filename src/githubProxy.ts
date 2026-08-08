import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

interface GithubProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

const functions = getFunctions(app, 'asia-northeast1');
const githubApi = httpsCallable<{ path: string }, GithubProxyResponse>(functions, 'githubApi');

export async function githubApiFetch(url: string): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://api.github.com') throw new Error('Unsupported GitHub API origin.');
  const result = await githubApi({ path: `${parsed.pathname}${parsed.search}` });
  return new Response(JSON.stringify(result.data.body), {
    status: result.data.status,
    headers: result.data.headers,
  });
}
