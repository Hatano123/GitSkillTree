import { sign } from 'node:crypto';

const GITHUB_API_ORIGIN = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const MAX_RESPONSE_BYTES = 8_000_000;
const NAME_PATTERN = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})';
const REPOSITORY_PATTERN = '[A-Za-z0-9_.-]{1,100}';

interface CachedInstallationToken {
  token: string;
  expiresAt: number;
}

export interface GithubProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

let cachedInstallationToken: CachedInstallationToken | null = null;

function hasOnlyQuery(url: URL, expected: Record<string, string>): boolean {
  const entries = [...url.searchParams.entries()];
  return entries.length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value);
}

function isSafeEncodedPath(value: string): boolean {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length >= 1
      && decoded.length <= 1000
      && !decoded.includes('\0')
      && !decoded.split('/').some((segment) => segment === '.' || segment === '..');
  } catch {
    return false;
  }
}

/** Restrict the proxy to the five read-only endpoint shapes used by src/github.ts. */
export function parseGithubApiPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value, GITHUB_API_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== GITHUB_API_ORIGIN || url.hash) return null;

  if (new RegExp(`^/users/${NAME_PATTERN}$`).test(url.pathname) && !url.search) {
    return url.pathname;
  }
  if (new RegExp(`^/users/${NAME_PATTERN}/repos$`).test(url.pathname) && hasOnlyQuery(url, { per_page: '100', sort: 'updated' })) {
    return `${url.pathname}?${url.searchParams.toString()}`;
  }
  if (new RegExp(`^/users/${NAME_PATTERN}/events$`).test(url.pathname) && hasOnlyQuery(url, { per_page: '30' })) {
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  const treeMatch = url.pathname.match(new RegExp(`^/repos/(${NAME_PATTERN})/(${REPOSITORY_PATTERN})/git/trees/(.+)$`));
  if (treeMatch && isSafeEncodedPath(treeMatch[3]) && hasOnlyQuery(url, { recursive: '1' })) {
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  const contentsMatch = url.pathname.match(new RegExp(`^/repos/(${NAME_PATTERN})/(${REPOSITORY_PATTERN})/contents/(.+)$`));
  if (contentsMatch && isSafeEncodedPath(contentsMatch[3]) && url.searchParams.size === 1) {
    const ref = url.searchParams.get('ref');
    if (ref && ref.length <= 255 && isSafeEncodedPath(ref)) return `${url.pathname}?${url.searchParams.toString()}`;
  }
  return null;
}

function createAppJwt(appId: string, privateKey: string): string {
  const encode = (input: object) => Buffer.from(JSON.stringify(input)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: appId })}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

async function getInstallationToken(appId: string, installationId: string, privateKey: string): Promise<string> {
  if (cachedInstallationToken && cachedInstallationToken.expiresAt > Date.now() + 5 * 60_000) {
    return cachedInstallationToken.token;
  }
  const response = await fetch(`${GITHUB_API_ORIGIN}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${createAppJwt(appId, privateKey)}`,
      'User-Agent': 'gitskilltree-scanner',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  });
  if (!response.ok) throw new Error(`GitHub installation authentication failed with HTTP ${response.status}.`);
  const data = await response.json() as { token?: string; expires_at?: string };
  if (!data.token || !data.expires_at) throw new Error('GitHub installation authentication returned an invalid response.');
  cachedInstallationToken = { token: data.token, expiresAt: new Date(data.expires_at).getTime() };
  return data.token;
}

export async function fetchGithubApi(
  path: string,
  appId: string,
  installationId: string,
  privateKey: string,
): Promise<GithubProxyResponse> {
  const token = await getInstallationToken(appId, installationId, privateKey);
  const response = await fetch(`${GITHUB_API_ORIGIN}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'gitskilltree-scanner',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  });
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('GitHub response exceeded the proxy size limit.');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { message: text };
  }
  const headers: Record<string, string> = {};
  for (const name of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after']) {
    const header = response.headers.get(name);
    if (header !== null) headers[name] = header;
  }
  return { status: response.status, headers, body };
}
