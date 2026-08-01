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

const MANIFEST_NAMES = ['package.json', 'requirements.txt'] as const;

function decodeBase64Utf8(content: string): string {
  const binary = atob(content.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizePythonDependency(value: string): string {
  return value.trim().toLowerCase().split(/[<>=!~;[\s]/, 1)[0].replaceAll('_', '-');
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
  return [];
}

async function inspectRepository(username: string, repository: UserMetadata['repositories'][number]) {
  const files: string[] = [];
  const dependencies: string[] = [];
  try {
    const treeResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}/git/trees/${encodeURIComponent(repository.defaultBranch)}?recursive=1`);
    if (!treeResponse.ok) return { files, dependencies };
    const treeData = await treeResponse.json() as { tree?: GitHubTreeItem[] };
    files.push(...(treeData.tree ?? []).filter((item) => item.type === 'blob' && item.path).map((item) => item.path!));

    // At most one dependency file per repository. Prefer the manifest with the
    // broadest MVP support, based solely on the file list already fetched.
    const manifest = MANIFEST_NAMES
      .map((name) => files.find((path) => path.toLowerCase() === name || path.toLowerCase().endsWith(`/${name}`)))
      .find(Boolean);
    if (!manifest) return { files, dependencies };

    const manifestResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}/contents/${manifest.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(repository.defaultBranch)}`);
    if (!manifestResponse.ok) return { files, dependencies };
    const manifestData = await manifestResponse.json() as { content?: string };
    if (manifestData.content) dependencies.push(...parseManifestDependencies(manifest, decodeBase64Utf8(manifestData.content)));
  } catch (error) {
    console.warn(`Failed to inspect ${repository.name}; continuing scan.`, error);
  }
  return { files, dependencies };
}

/**
 * Uses 2 list/profile requests plus up to 3 trees and 3 manifests: at most 8
 * GitHub requests per scan. Individual repository failures remain partial.
 */
export async function fetchUserMetadata(username: string, _sinceTimestamp?: string): Promise<UserMetadata> {
  const cleanUsername = username.trim();
  if (!cleanUsername) throw new Error('GitHubユーザー名を入力してください。');

  const userResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`);
  if (!userResponse.ok) {
    if (userResponse.status === 404) throw new Error(`GitHubユーザー「${cleanUsername}」が見つかりませんでした。`);
    throw new Error(`ユーザー情報の取得に失敗しました: ${userResponse.statusText}`);
  }
  const userData = await userResponse.json();

  const repositoriesResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?per_page=100&sort=updated`);
  if (!repositoriesResponse.ok) {
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

  const recentRepositories = [...repositories]
    .filter((repository) => !repository.fork)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name))
    .slice(0, 3);
  const inspections = await Promise.allSettled(recentRepositories.map((repository) => inspectRepository(cleanUsername, repository)));
  const files = new Set<string>();
  const dependencies = new Set<string>();
  for (const inspection of inspections) {
    if (inspection.status === 'rejected') {
      console.warn('A repository inspection failed; continuing scan.', inspection.reason);
      continue;
    }
    inspection.value.files.forEach((file) => files.add(file));
    inspection.value.dependencies.forEach((dependency) => dependencies.add(dependency));
  }

  return {
    username: userData.login,
    avatarUrl: userData.avatar_url || '',
    publicReposCount: userData.public_repos || repositoriesData.length,
    repositories,
    aggregatedLanguages,
    dependencies: [...dependencies].sort(),
    files: [...files].sort(),
    recentEvents: [],
  };
}
