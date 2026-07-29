export type RepositoryFactKind = 'dependency' | 'file' | 'workflow' | 'config' | 'import';

export type RepositoryFactRecord = {
  repository: string;
  path: string;
  kind: RepositoryFactKind;
  value: string;
};

export type RepositoryFacts = {
  languages: string[];
  dependencies: string[];
  filePaths: string[];
  imports: string[];
  workflowFiles: string[];
  detectedConfigFiles: string[];
  records: RepositoryFactRecord[];
  scannedRepositories: string[];
  incompleteRepositories: string[];
};

export type RepositorySummary = {
  name: string;
  description: string;
  language: string;
  stars: number;
  defaultBranch: string;
};

type GitHubTreeEntry = {
  path?: string;
  type?: string;
  size?: number;
};

const MAX_FACT_REPOSITORIES = 5;
const MAX_PATHS_PER_REPOSITORY = 5000;
const MAX_MANIFESTS_PER_REPOSITORY = 8;

const manifestName = (path: string) => path.split('/').at(-1)?.toLowerCase() ?? '';

export function isDependencyManifest(path: string): boolean {
  return ['package.json', 'requirements.txt', 'pyproject.toml'].includes(manifestName(path));
}

export function extractManifestDependencies(path: string, content: string): string[] {
  const name = manifestName(path);

  if (name === 'package.json') {
    try {
      const parsed = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      return [...new Set([
        ...Object.keys(parsed.dependencies ?? {}),
        ...Object.keys(parsed.devDependencies ?? {}),
      ].map((dependency) => dependency.toLowerCase()))];
    } catch {
      return [];
    }
  }

  if (name === 'requirements.txt') {
    return [...new Set(content
      .split(/\r?\n/)
      .map((line) => line.split('#')[0].trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[-]e\s+/, '').match(/^([a-zA-Z0-9._-]+)/)?.[1]?.toLowerCase() ?? '')
      .filter(Boolean))];
  }

  if (name === 'pyproject.toml') {
    const dependencies = new Set<string>();
    for (const match of content.matchAll(/["']([a-zA-Z0-9][a-zA-Z0-9._-]*)(?:\[[^\]]+])?(?:[^"']*)["']/g)) {
      dependencies.add(match[1].toLowerCase());
    }
    for (const match of content.matchAll(/^\s*([a-zA-Z0-9][a-zA-Z0-9._-]*)\s*=/gm)) {
      dependencies.add(match[1].toLowerCase());
    }
    return [...dependencies];
  }

  return [];
}

function isWorkflow(path: string): boolean {
  return /^\.github\/workflows\/.+\.ya?ml$/i.test(path);
}

function isConfig(path: string): boolean {
  const name = manifestName(path);
  return (
    /^dockerfile(?:\..+)?$/i.test(name) ||
    /^docker-compose(?:\..+)?\.ya?ml$/i.test(name) ||
    /^compose(?:\..+)?\.ya?ml$/i.test(name) ||
    name === 'nginx.conf' ||
    name.endsWith('.tf')
  );
}

async function readGitHubFile(
  username: string,
  repository: string,
  path: string,
  fetcher: typeof fetch,
): Promise<string | null> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetcher(
    `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repository)}/contents/${encodedPath}`,
  );
  if (!response.ok) return null;

  const data = await response.json() as { content?: string; encoding?: string };
  if (!data.content || data.encoding !== 'base64') return null;

  try {
    return decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
  } catch {
    return null;
  }
}

export async function collectRepositoryFacts(
  username: string,
  repositories: RepositorySummary[],
  fetcher: typeof fetch = fetch,
): Promise<RepositoryFacts> {
  const records: RepositoryFactRecord[] = [];
  const filePaths = new Set<string>();
  const workflowFiles = new Set<string>();
  const detectedConfigFiles = new Set<string>();
  const dependencies = new Set<string>();
  const recordKeys = new Set<string>();
  const scannedRepositories: string[] = [];
  const incompleteRepositories: string[] = [];
  const prioritizedRepositories = [...repositories]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, MAX_FACT_REPOSITORIES);

  await Promise.all(prioritizedRepositories.map(async (repository) => {
    const collectManifest = async (path: string) => {
      const content = await readGitHubFile(username, repository.name, path, fetcher);
      if (content === null) return;
      for (const dependency of extractManifestDependencies(path, content)) {
        dependencies.add(dependency);
        const key = `${repository.name}:${path}:dependency:${dependency}`;
        if (recordKeys.has(key)) continue;
        recordKeys.add(key);
        records.push({
          repository: repository.name,
          path,
          kind: 'dependency',
          value: dependency,
        });
      }
    };

    try {
      const treeResponse = await fetcher(
        `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}/git/trees/${encodeURIComponent(repository.defaultBranch)}?recursive=1`,
      );
      if (!treeResponse.ok) {
        incompleteRepositories.push(repository.name);
        await collectManifest('package.json');
        return;
      }

      const treeData = await treeResponse.json() as { tree?: GitHubTreeEntry[]; truncated?: boolean };
      const paths = (treeData.tree ?? [])
        .filter((entry) => entry.type === 'blob' && typeof entry.path === 'string')
        .slice(0, MAX_PATHS_PER_REPOSITORY)
        .map((entry) => entry.path as string);

      scannedRepositories.push(repository.name);
      if (treeData.truncated || (treeData.tree?.length ?? 0) > paths.length) {
        incompleteRepositories.push(repository.name);
      }

      for (const path of paths) {
        const qualifiedPath = `${repository.name}:${path}`;
        filePaths.add(qualifiedPath);

        if (isWorkflow(path)) {
          workflowFiles.add(qualifiedPath);
          records.push({ repository: repository.name, path, kind: 'workflow', value: path });
        }
        if (isConfig(path)) {
          detectedConfigFiles.add(qualifiedPath);
          records.push({ repository: repository.name, path, kind: 'config', value: path });
        }
      }

      const manifestPaths = paths.filter(isDependencyManifest).slice(0, MAX_MANIFESTS_PER_REPOSITORY);
      await Promise.all(manifestPaths.map(collectManifest));
    } catch {
      incompleteRepositories.push(repository.name);
      try {
        await collectManifest('package.json');
      } catch {
        // The scan remains partial; existing metadata and other repositories still evaluate.
      }
    }
  }));

  return {
    languages: [...new Set(repositories.map((repository) => repository.language).filter(Boolean))],
    dependencies: [...dependencies].sort(),
    filePaths: [...filePaths].sort(),
    imports: [],
    workflowFiles: [...workflowFiles].sort(),
    detectedConfigFiles: [...detectedConfigFiles].sort(),
    records,
    scannedRepositories: scannedRepositories.sort(),
    incompleteRepositories: [...new Set(incompleteRepositories)].sort(),
  };
}

export function factsFromLegacyMetadata(
  languages: string[],
  dependencies: string[],
): RepositoryFacts {
  return {
    languages: [...new Set(languages)],
    dependencies: [...new Set(dependencies.map((dependency) => dependency.toLowerCase()))],
    filePaths: [],
    imports: [],
    workflowFiles: [],
    detectedConfigFiles: [],
    records: dependencies.map((dependency) => ({
      repository: '集計結果',
      path: 'package.json',
      kind: 'dependency',
      value: dependency.toLowerCase(),
    })),
    scannedRepositories: [],
    incompleteRepositories: [],
  };
}
