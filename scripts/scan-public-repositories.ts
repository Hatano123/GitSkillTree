import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectNodesFromFacts } from '../src/detectNodes.ts';
import { parseManifestDependencies } from '../src/github.ts';

interface RepositoryResponse {
  name: string;
  language: string | null;
  default_branch: string;
  updated_at: string;
  fork: boolean;
  private: boolean;
}

interface RateLimitResponse {
  resources: { core: { limit: number; remaining: number; reset: number } };
}

interface TreeResponse {
  truncated?: boolean;
  tree?: { path?: string; type?: string }[];
}

const DEFAULT_REPOSITORY_LIMIT = 10;
const MAX_REPOSITORY_LIMIT = 30;
const MINIMUM_RATE_REMAINING = 500;
const MAX_STORED_FILES_PER_REPOSITORY = 5_000;
const MANIFEST_NAMES = ['package.json', 'requirements.txt', 'pyproject.toml', 'vcpkg.json', 'conanfile.txt', 'CMakeLists.txt'] as const;

class GitHubCommandError extends Error {
  rateLimited: boolean;

  constructor(message: string) {
    super(message);
    this.rateLimited = /HTTP (403|429)|rate limit|Retry-After/i.test(message);
  }
}

function readArguments(): { username: string; repositoryLimit: number } {
  const username = process.argv[2]?.trim();
  if (!username || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(username)) {
    throw new Error('Usage: npm run harness:scan -- <github-username> [--max-repos 1-30]');
  }
  const limitIndex = process.argv.indexOf('--max-repos');
  const repositoryLimit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : DEFAULT_REPOSITORY_LIMIT;
  if (!Number.isInteger(repositoryLimit) || repositoryLimit < 1 || repositoryLimit > MAX_REPOSITORY_LIMIT) {
    throw new Error(`--max-repos must be an integer from 1 to ${MAX_REPOSITORY_LIMIT}.`);
  }
  return { username, repositoryLimit };
}

function runGhApi<T>(endpoint: string, countRequest = true): T {
  if (countRequest) {
    if (requestCount >= requestBudget) throw new Error(`Request budget exhausted (${requestBudget}).`);
    requestCount += 1;
  }
  const result = spawnSync('gh', ['api', endpoint], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    throw new GitHubCommandError((result.stderr || result.stdout || `gh api failed: ${endpoint}`).trim());
  }
  return JSON.parse(result.stdout) as T;
}

function selectRepositories(repositories: RepositoryResponse[], limit: number): RepositoryResponse[] {
  const sorted = repositories
    .filter((repository) => !repository.fork && !repository.private)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.name.localeCompare(right.name));
  const selected = sorted.slice(0, Math.min(3, limit));
  const selectedNames = new Set(selected.map((repository) => repository.name));
  const selectedLanguages = new Set(selected.map((repository) => repository.language?.toLowerCase()).filter(Boolean));

  for (const repository of sorted) {
    const language = repository.language?.toLowerCase();
    if (selected.length >= limit) break;
    if (!selectedNames.has(repository.name) && language && !selectedLanguages.has(language)) {
      selected.push(repository);
      selectedNames.add(repository.name);
      selectedLanguages.add(language);
    }
  }
  for (const repository of sorted) {
    if (selected.length >= limit) break;
    if (!selectedNames.has(repository.name)) selected.push(repository);
  }
  return selected;
}

function findManifest(files: string[]): string | undefined {
  for (const name of MANIFEST_NAMES) {
    const lowerName = name.toLowerCase();
    const match = files.find((path) => path.toLowerCase() === lowerName || path.toLowerCase().endsWith(`/${lowerName}`));
    if (match) return match;
  }
  return undefined;
}

const { username, repositoryLimit } = readArguments();
const requestBudget = 2 + repositoryLimit * 2;
let requestCount = 0;
const warnings: string[] = [];

const rateBefore = runGhApi<RateLimitResponse>('rate_limit', false).resources.core;
if (rateBefore.remaining < Math.max(MINIMUM_RATE_REMAINING, requestBudget + 50)) {
  throw new Error(`GitHub API remaining count is too low (${rateBefore.remaining}). Try again after the reset time.`);
}

runGhApi(`users/${encodeURIComponent(username)}`);
const listedRepositories = runGhApi<RepositoryResponse[]>(
  `users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&sort=updated`,
);
const selectedRepositories = selectRepositories(listedRepositories, repositoryLimit);
const allLanguages = [...new Set(listedRepositories.map((repository) => repository.language).filter((value): value is string => Boolean(value)))];
const allFiles: string[] = [];
const allDependencies = new Set<string>();
const inspectedRepositories: Array<Record<string, unknown>> = [];
let previousDetected = new Set(detectNodesFromFacts({ languages: allLanguages, dependencies: [], files: [] }));
let consecutiveWithoutNewNodes = 0;

for (const repository of selectedRepositories) {
  let status: 'read' | 'partial' | 'failed' = 'read';
  let files: string[] = [];
  let manifestPath: string | undefined;
  let manifestDependencies: string[] = [];
  try {
    const tree = runGhApi<TreeResponse>(
      `repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}/git/trees/${encodeURIComponent(repository.default_branch)}?recursive=1`,
    );
    files = (tree.tree ?? []).filter((item) => item.type === 'blob' && item.path).map((item) => item.path!);
    if (tree.truncated) {
      status = 'partial';
      warnings.push(`${repository.name}: Git Trees response was truncated.`);
    }
    manifestPath = findManifest(files);
    if (manifestPath) {
      try {
        const manifest = runGhApi<{ content?: string }>(
          `repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}/contents/${manifestPath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(repository.default_branch)}`,
        );
        if (manifest.content) {
          const content = Buffer.from(manifest.content.replace(/\s/g, ''), 'base64').toString('utf8');
          manifestDependencies = parseManifestDependencies(manifestPath, content);
          manifestDependencies.forEach((dependency) => allDependencies.add(dependency));
        }
      } catch (error) {
        status = 'partial';
        warnings.push(`${repository.name}: manifest could not be read.`);
        if (error instanceof GitHubCommandError && error.rateLimited) throw error;
      }
    }
    allFiles.push(...files);
  } catch (error) {
    status = files.length > 0 ? 'partial' : 'failed';
    warnings.push(`${repository.name}: repository details could not be read.`);
    inspectedRepositories.push({ name: repository.name, language: repository.language, status, fileCount: files.length });
    if (error instanceof GitHubCommandError && error.rateLimited) break;
    continue;
  }

  const detected = new Set(detectNodesFromFacts({ languages: allLanguages, dependencies: [...allDependencies], files: allFiles }));
  const newNodeIds = [...detected].filter((nodeId) => !previousDetected.has(nodeId));
  consecutiveWithoutNewNodes = newNodeIds.length === 0 ? consecutiveWithoutNewNodes + 1 : 0;
  previousDetected = detected;
  inspectedRepositories.push({
    name: repository.name,
    language: repository.language,
    status,
    fileCount: files.length,
    files: files.slice(0, MAX_STORED_FILES_PER_REPOSITORY),
    filesTruncatedForReport: files.length > MAX_STORED_FILES_PER_REPOSITORY,
    manifest: manifestPath ? { path: manifestPath, dependencies: manifestDependencies } : null,
    newNodeIds,
  });

  if (inspectedRepositories.length >= DEFAULT_REPOSITORY_LIMIT && consecutiveWithoutNewNodes >= 5) {
    warnings.push('Stopped after five detailed repositories produced no new nodes.');
    break;
  }
}

const detectedNodeIds = detectNodesFromFacts({ languages: allLanguages, dependencies: [...allDependencies], files: allFiles });
const rateAfter = runGhApi<RateLimitResponse>('rate_limit', false).resources.core;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  target: username,
  limits: { requestedRepositoryLimit: repositoryLimit, requestBudget, minimumRemaining: MINIMUM_RATE_REMAINING },
  api: { requestsUsedByHarness: requestCount, before: rateBefore, after: rateAfter },
  listedRepositoryCount: listedRepositories.length,
  publicNonForkRepositoryCount: listedRepositories.filter((repository) => !repository.private && !repository.fork).length,
  languages: allLanguages,
  dependencies: [...allDependencies].sort(),
  detectedNodeIds,
  inspectedRepositories,
  warnings,
};

const outputDirectory = resolve('harness', 'reports');
mkdirSync(outputDirectory, { recursive: true });
const timestamp = report.generatedAt.replaceAll(':', '-');
const outputPath = resolve(outputDirectory, `${username}-${timestamp}.json`);
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Scanned ${inspectedRepositories.length}/${selectedRepositories.length} detailed repositories using ${requestCount}/${requestBudget} requests.`);
console.log(`Detected nodes: ${detectedNodeIds.join(', ')}`);
console.log(`Report: ${outputPath}`);
