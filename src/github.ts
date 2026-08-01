export interface UserMetadata {
  username: string;
  avatarUrl: string;
  publicReposCount: number;
  repositories: {
    name: string;
    description: string;
    language: string;
    stars: number;
    updatedAt: string;
    defaultBranch: string;
    fork: boolean;
  }[];
  aggregatedLanguages: Record<string, number>;
  dependencies: string[];
  files: string[];
  scanCoverage: {
    selectedRepositories: number;
    inspectedRepositories: number;
    failedRepositories: number;
    rateLimited: boolean;
    remainingRequests: number | null;
    resetAt: string | null;
  };
  scanWarnings: string[];
  detailedRepositoryFacts: {
    name: string;
    status: 'read' | 'partial' | 'failed';
    dependencies: string[];
    files: string[];
  }[];
  recentEvents: {
    type: string;
    repoName: string;
    createdAt: string;
    commits: string[];
  }[];
}

interface GitHubTreeItem {
  path?: string;
  type?: string;
}

export const DETAILED_REPOSITORY_LIMIT = 10;
export const MAX_GITHUB_REQUESTS = 2 + DETAILED_REPOSITORY_LIMIT * 2;
const RATE_LIMIT_RESERVE = 4;

const DEFAULT_MANIFEST_NAMES = ['package.json', 'requirements.txt', 'pyproject.toml'] as const;
const PYTHON_MANIFEST_NAMES = ['requirements.txt', 'pyproject.toml', 'package.json'] as const;
const CPLUSPLUS_MANIFEST_NAMES = ['vcpkg.json', 'conanfile.txt', 'CMakeLists.txt', ...DEFAULT_MANIFEST_NAMES] as const;

function decodeBase64Utf8(content: string): string {
  const binary = atob(content.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizePythonDependency(value: string): string {
  return value.trim().toLowerCase().split(/[<>=!~;[\s]/, 1)[0].replaceAll('_', '-');
}

interface RateLimitState {
  remaining: number | null;
  resetAt: string | null;
  exhausted: boolean;
}

function updateRateLimitState(response: Response, state: RateLimitState): void {
  const remainingHeader = response.headers.get('x-ratelimit-remaining');
  const remaining = remainingHeader === null ? Number.NaN : Number(remainingHeader);
  if (Number.isFinite(remaining)) state.remaining = remaining;
  const resetHeader = response.headers.get('x-ratelimit-reset');
  const reset = resetHeader === null ? Number.NaN : Number(resetHeader);
  if (Number.isFinite(reset) && reset > 0) state.resetAt = new Date(reset * 1000).toISOString();
  const retryAfterHeader = response.headers.get('retry-after');
  const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
  if (!state.resetAt && Number.isFinite(retryAfter) && retryAfter >= 0) {
    state.resetAt = new Date(Date.now() + retryAfter * 1000).toISOString();
  }
  state.exhausted = response.status === 429
    || (response.status === 403 && (state.remaining === 0 || retryAfterHeader !== null));
}

function rateLimitMessage(state: RateLimitState): string {
  const resetText = state.resetAt
    ? `${new Date(state.resetAt).toLocaleString('ja-JP')}以降に`
    : 'しばらく時間をおいてから';
  return `GitHub APIの利用上限に達しました。${resetText}再度お試しください。`;
}

async function githubFetch(url: string, state: RateLimitState): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
  });
  updateRateLimitState(response, state);
  return response;
}

/** Parse one selected dependency manifest without changing detection results. */
export function parseManifestDependencies(path: string, content: string): string[] {
  const fileName = path.split('/').at(-1)?.toLowerCase();
  if (fileName === 'package.json') {
    const parsed = JSON.parse(content) as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> };
    return Object.keys({ ...parsed.dependencies, ...parsed.devDependencies }).map((dependency) => dependency.toLowerCase());
  }
  if (fileName === 'requirements.txt') {
    return content.split(/\r?\n/)
      .map((line) => line.split('#', 1)[0])
      .map(normalizePythonDependency)
      .filter(Boolean);
  }
  if (fileName === 'pyproject.toml') {
    const dependencies = new Set<string>();
    const addQuotedDependencies = (block: string) => {
      for (const match of block.matchAll(/["']([^"']+)["']/g)) {
        const dependency = normalizePythonDependency(match[1]);
        if (dependency) dependencies.add(dependency);
      }
    };

    // PEP 621 project dependencies and common dependency-group arrays.
    for (const match of content.matchAll(/(?:^|\n)\s*[A-Za-z0-9_-]*dependencies\s*=\s*\[([\s\S]*?)\]/g)) {
      addQuotedDependencies(match[1]);
    }

    // Poetry dependency tables use package names as TOML keys.
    for (const section of content.matchAll(/\[tool\.poetry(?:\.group\.[^.]+)?\.dependencies\]([\s\S]*?)(?=\n\s*\[|$)/g)) {
      for (const line of section[1].split(/\r?\n/)) {
        const key = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=/)?.[1];
        if (key && key.toLowerCase() !== 'python') dependencies.add(normalizePythonDependency(key));
      }
    }
    return [...dependencies];
  }
  if (fileName === 'vcpkg.json') {
    const parsed = JSON.parse(content) as { dependencies?: Array<string | { name?: string }> };
    return (parsed.dependencies ?? [])
      .map((dependency) => typeof dependency === 'string' ? dependency : dependency.name ?? '')
      .map((dependency) => dependency.toLowerCase())
      .filter(Boolean);
  }
  if (fileName === 'conanfile.txt') {
    const requires = content.match(/\[requires\]([\s\S]*?)(?=\n\s*\[|$)/)?.[1] ?? '';
    return requires.split(/\r?\n/)
      .map((line) => line.trim().split('/', 1)[0].toLowerCase())
      .filter((dependency) => dependency && !dependency.startsWith('#'));
  }
  if (fileName === 'cmakelists.txt') {
    return [...content.matchAll(/find_package\s*\(\s*([A-Za-z0-9_.+-]+)/gi)]
      .map((match) => match[1].toLowerCase());
  }
  return [];
}

/** Keep recent activity while using spare slots to cover different languages. */
export function selectDetailedRepositories(repositories: UserMetadata['repositories']): UserMetadata['repositories'] {
  const sorted = repositories
    .filter((repository) => !repository.fork)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name));
  const selected = sorted.slice(0, Math.min(3, DETAILED_REPOSITORY_LIMIT));
  const selectedNames = new Set(selected.map((repository) => repository.name));
  const selectedLanguages = new Set(selected.map((repository) => repository.language.toLowerCase()).filter(Boolean));

  for (const repository of sorted) {
    const language = repository.language.toLowerCase();
    if (selected.length >= DETAILED_REPOSITORY_LIMIT) break;
    if (!selectedNames.has(repository.name) && language && !selectedLanguages.has(language)) {
      selected.push(repository);
      selectedNames.add(repository.name);
      selectedLanguages.add(language);
    }
  }
  for (const repository of sorted) {
    if (selected.length >= DETAILED_REPOSITORY_LIMIT) break;
    if (!selectedNames.has(repository.name)) selected.push(repository);
  }
  return selected;
}

async function inspectRepository(username: string, repository: UserMetadata['repositories'][number], rateLimit: RateLimitState) {
  const files: string[] = [];
  const dependencies: string[] = [];
  try {
    const treeResponse = await githubFetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}/git/trees/${encodeURIComponent(repository.defaultBranch)}?recursive=1`, rateLimit);
    if (!treeResponse.ok) return { files, dependencies, failed: true, rateLimited: rateLimit.exhausted };
    const treeData = await treeResponse.json() as { tree?: GitHubTreeItem[] };
    files.push(...(treeData.tree ?? []).filter((item) => item.type === 'blob' && item.path).map((item) => item.path!));

    // At most one dependency file per repository. Prefer the manifest with the
    // broadest MVP support, based solely on the file list already fetched.
    const language = repository.language.toLowerCase();
    const manifestNames = language === 'python'
      ? PYTHON_MANIFEST_NAMES
      : language === 'c++' || language === 'c'
        ? CPLUSPLUS_MANIFEST_NAMES
        : DEFAULT_MANIFEST_NAMES;
    const manifest = manifestNames
      .map((name) => files.find((path) => path.toLowerCase() === name || path.toLowerCase().endsWith(`/${name}`)))
      .find(Boolean);
    if (!manifest) return { files, dependencies, failed: false, rateLimited: false };

    const manifestResponse = await githubFetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}/contents/${manifest.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(repository.defaultBranch)}`, rateLimit);
    if (!manifestResponse.ok) return { files, dependencies, failed: true, rateLimited: rateLimit.exhausted };
    const manifestData = await manifestResponse.json() as { content?: string };
    if (manifestData.content) dependencies.push(...parseManifestDependencies(manifest, decodeBase64Utf8(manifestData.content)));
  } catch (error) {
    console.warn(`Failed to inspect ${repository.name}; continuing scan.`, error);
    return { files, dependencies, failed: true, rateLimited: false };
  }
  return { files, dependencies, failed: false, rateLimited: false };
}

/**
 * Uses 2 list/profile requests plus up to 10 trees and 10 manifests: at most 22
 * GitHub requests per scan. Individual repository failures remain partial.
 */
export async function fetchUserMetadata(username: string, _sinceTimestamp?: string): Promise<UserMetadata> {
  const cleanUsername = username.trim();
  if (!cleanUsername) throw new Error('GitHubユーザー名を入力してください。');
  const rateLimit: RateLimitState = { remaining: null, resetAt: null, exhausted: false };

  let userResponse: Response;
  try {
    userResponse = await githubFetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, rateLimit);
  } catch {
    throw new Error('GitHub APIに接続できませんでした。通信状態を確認して再度お試しください。');
  }
  if (!userResponse.ok) {
    if (userResponse.status === 404) throw new Error(`GitHubユーザー「${cleanUsername}」が見つかりませんでした。`);
    if (rateLimit.exhausted) throw new Error(rateLimitMessage(rateLimit));
    throw new Error(`ユーザー情報の取得に失敗しました: ${userResponse.statusText}`);
  }
  const userData = await userResponse.json();

  let repositoriesResponse: Response;
  try {
    repositoriesResponse = await githubFetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?per_page=100&sort=updated`, rateLimit);
  } catch {
    throw new Error('GitHubのリポジトリ一覧に接続できませんでした。通信状態を確認して再度お試しください。');
  }
  if (!repositoriesResponse.ok) {
    if (rateLimit.exhausted) throw new Error(rateLimitMessage(rateLimit));
    throw new Error(`リポジトリ一覧の取得に失敗しました: ${repositoriesResponse.statusText}`);
  }
  const repositoriesData = await repositoriesResponse.json();
  const repositories: UserMetadata['repositories'] = repositoriesData
    .map((repository: any) => ({
      name: repository.name,
      description: repository.description || '',
      language: repository.language || '',
      stars: repository.stargazers_count || 0,
      updatedAt: repository.updated_at || '',
      defaultBranch: repository.default_branch || 'main',
      fork: Boolean(repository.fork),
    }));

  const aggregatedLanguages: Record<string, number> = {};
  for (const repository of repositories) {
    if (repository.language) aggregatedLanguages[repository.language] = (aggregatedLanguages[repository.language] || 0) + 1;
  }

  const detailedRepositories = selectDetailedRepositories(repositories);
  const files = new Set<string>();
  const dependencies = new Set<string>();
  let inspectedRepositories = 0;
  let failedRepositories = 0;
  let rateLimited = false;
  const detailedRepositoryFacts: UserMetadata['detailedRepositoryFacts'] = [];
  for (const repository of detailedRepositories) {
    if (rateLimit.remaining !== null && rateLimit.remaining <= RATE_LIMIT_RESERVE) {
      rateLimited = true;
      break;
    }
    const inspection = await inspectRepository(cleanUsername, repository, rateLimit);
    inspectedRepositories += 1;
    if (inspection.failed) failedRepositories += 1;
    detailedRepositoryFacts.push({
      name: repository.name,
      status: inspection.failed
        ? inspection.files.length > 0 ? 'partial' : 'failed'
        : 'read',
      dependencies: [...inspection.dependencies],
      files: [...inspection.files],
    });
    inspection.files.forEach((file) => files.add(file));
    inspection.dependencies.forEach((dependency) => dependencies.add(dependency));
    if (inspection.rateLimited) {
      rateLimited = true;
      break;
    }
  }

  const scanWarnings: string[] = [];
  if (rateLimited) scanWarnings.push(`GitHub APIの残量を考慮し、${inspectedRepositories}/${detailedRepositories.length}件まで詳細調査しました。取得済み情報で結果を表示しています。`);
  if (failedRepositories > 0) scanWarnings.push(`${failedRepositories}件のリポジトリ詳細を取得できませんでしたが、他の取得結果で解析を継続しました。`);

  return {
    username: userData.login,
    avatarUrl: userData.avatar_url || '',
    publicReposCount: userData.public_repos || repositoriesData.length,
    repositories,
    aggregatedLanguages,
    dependencies: [...dependencies].sort(),
    files: [...files].sort(),
    scanCoverage: {
      selectedRepositories: detailedRepositories.length,
      inspectedRepositories,
      failedRepositories,
      rateLimited,
      remainingRequests: rateLimit.remaining,
      resetAt: rateLimit.resetAt,
    },
    scanWarnings,
    detailedRepositoryFacts,
    recentEvents: [],
  };
}
