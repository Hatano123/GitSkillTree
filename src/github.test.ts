import assert from 'node:assert/strict';
import test from 'node:test';
import { DETAILED_REPOSITORY_LIMIT, fetchUserMetadata, MAX_GITHUB_REQUESTS, parseManifestDependencies, selectDetailedRepositories } from './github.ts';

test('manifest dependencies use exact normalized package names', () => {
  assert.deepEqual(parseManifestDependencies('package.json', JSON.stringify({ dependencies: { react: '^19', next: '^16' } })), ['react', 'next']);
  assert.deepEqual(parseManifestDependencies('requirements.txt', 'FastAPI==1.0\nscikit_learn>=2\n# comment'), ['fastapi', 'scikit-learn']);
  assert.deepEqual(parseManifestDependencies('pyproject.toml', '[project]\nname="demo"\ndependencies=["opencv-python-headless>=4", "numpy"]'), ['opencv-python-headless', 'numpy']);
  assert.deepEqual(parseManifestDependencies('pyproject.toml', '[tool.poetry]\nname="demo"\n[tool.poetry.dependencies]\npython="^3.12"\nopencv-contrib-python="^4"'), ['opencv-contrib-python']);
  assert.deepEqual(parseManifestDependencies('vcpkg.json', '{"dependencies":["opencv4",{"name":"fmt"}]}'), ['opencv4', 'fmt']);
  assert.deepEqual(parseManifestDependencies('conanfile.txt', '[requires]\nopencv/4.10.0\nfmt/11.0\n[generators]\nCMakeDeps'), ['opencv', 'fmt']);
  assert.deepEqual(parseManifestDependencies('CMakeLists.txt', 'find_package(OpenCV REQUIRED)\nfind_package(fmt CONFIG)'), ['opencv', 'fmt']);
});

test('detail selection keeps the latest three and adds language diversity', () => {
  const repository = (name: string, language: string, updatedAt: string, fork = false) => ({ name, language, updatedAt, fork, description: '', stars: 0, defaultBranch: 'main' });
  const selected = selectDetailedRepositories([
    repository('new-ts', 'TypeScript', '2026-06-01'),
    repository('new-js', 'JavaScript', '2026-05-01'),
    repository('new-ts-2', 'TypeScript', '2026-04-01'),
    repository('older-python', 'Python', '2025-01-01'),
    repository('older-cpp', 'C++', '2024-01-01'),
    repository('fork-rust', 'Rust', '2026-07-01', true),
  ]);
  assert.equal(selected.length, 5);
  assert.deepEqual(selected.slice(0, 3).map((item) => item.name), ['new-ts', 'new-js', 'new-ts-2']);
  assert.ok(selected.some((item) => item.name === 'older-python'));
  assert.ok(selected.some((item) => item.name === 'older-cpp'));
});

test('scan stays within its request budget, excludes forks, and reads multiple manifests', async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith('/users/example')) return Response.json({ login: 'example', avatar_url: '', public_repos: 11 });
    if (url.includes('/users/example/repos?')) return Response.json([
      { name: 'fork-newest', language: 'Rust', updated_at: '2026-04-01', default_branch: 'main', fork: true },
      { name: 'recent-a', language: 'TypeScript', updated_at: '2026-03-01', default_branch: 'main', fork: false },
      { name: 'recent-b', language: 'Python', updated_at: '2026-02-01', default_branch: 'main', fork: false },
      { name: 'recent-c', language: 'Go', updated_at: '2026-01-01', default_branch: 'main', fork: false },
      { name: 'older-d', language: 'Rust', updated_at: '2025-01-01', default_branch: 'main', fork: false },
      { name: 'older-e', language: 'C++', updated_at: '2024-01-01', default_branch: 'main', fork: false },
      { name: 'older-f', language: 'Ruby', updated_at: '2023-01-01', default_branch: 'main', fork: false },
      { name: 'older-g', language: 'Java', updated_at: '2022-01-01', default_branch: 'main', fork: false },
      { name: 'older-h', language: 'PHP', updated_at: '2021-01-01', default_branch: 'main', fork: false },
      { name: 'older-i', language: 'C#', updated_at: '2020-01-01', default_branch: 'main', fork: false },
      { name: 'older-j', language: 'Shell', updated_at: '2019-01-01', default_branch: 'main', fork: false },
    ]);
    if (url.includes('/recent-b/git/trees/')) return Response.json({ tree: [{ path: 'package.json', type: 'blob' }, { path: 'requirements.txt', type: 'blob' }, { path: 'pyproject.toml', type: 'blob' }] });
    if (url.includes('/git/trees/')) return Response.json({ tree: [{ path: 'package.json', type: 'blob' }, { path: 'Dockerfile', type: 'blob' }] });
    if (url.includes('/recent-b/contents/requirements.txt')) return Response.json({ content: btoa('opencv-python-headless==4.10') });
    if (url.includes('/recent-b/contents/pyproject.toml')) return Response.json({ content: btoa('[project]\ndependencies=["fastapi"]') });
    if (url.includes('/contents/package.json')) return Response.json({ content: btoa('{"dependencies":{"react":"1"}}') });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  try {
    const metadata = await fetchUserMetadata('example');
    assert.ok(urls.length <= MAX_GITHUB_REQUESTS);
    assert.ok(!urls.some((url) => url.includes('/repos/example/fork-newest/git/trees/')));
    assert.equal(urls.filter((url) => url.includes('/git/trees/')).length, DETAILED_REPOSITORY_LIMIT);
    assert.equal(metadata.repositories.length, 10);
    assert.equal(metadata.aggregatedLanguages.Rust, 1);
    assert.ok(urls.some((url) => url.includes('/recent-b/contents/requirements.txt')));
    assert.ok(urls.some((url) => url.includes('/recent-b/contents/pyproject.toml')));
    assert.ok(metadata.dependencies.includes('opencv-python-headless'));
    assert.ok(metadata.dependencies.includes('fastapi'));
    assert.equal(metadata.detailedRepositoryFacts.length, DETAILED_REPOSITORY_LIMIT);
    assert.ok(metadata.detailedRepositoryFacts.find((repository) => repository.name === 'recent-b')?.dependencies.includes('opencv-python-headless'));
    assert.ok(metadata.detailedRepositoryFacts.every((repository) => repository.status === 'read'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a failed detail request does not fail the whole scan', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/users/partial')) return Response.json({ login: 'partial', public_repos: 1 });
    if (url.includes('/users/partial/repos?')) return Response.json([{ name: 'repo', language: 'Python', updated_at: '2026-01-01', default_branch: 'main', fork: false }]);
    return new Response(null, { status: 503 });
  }) as typeof fetch;
  try {
    const metadata = await fetchUserMetadata('partial');
    assert.deepEqual(metadata.files, []);
    assert.deepEqual(metadata.dependencies, []);
    assert.equal(metadata.aggregatedLanguages.Python, 1);
    assert.equal(metadata.scanCoverage.failedRepositories, 1);
    assert.equal(metadata.scanWarnings.length, 1);
    assert.deepEqual(metadata.detailedRepositoryFacts, [
      { name: 'repo', status: 'failed', dependencies: [], files: [] },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rate exhaustion during details returns partial scan results', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestCount += 1;
    const url = String(input);
    if (url.endsWith('/users/limited')) return Response.json({ login: 'limited', public_repos: 2 }, { headers: { 'x-ratelimit-remaining': '8' } });
    if (url.includes('/users/limited/repos?')) return Response.json([
      { name: 'one', language: 'TypeScript', updated_at: '2026-02-01', default_branch: 'main', fork: false },
      { name: 'two', language: 'Python', updated_at: '2026-01-01', default_branch: 'main', fork: false },
    ], { headers: { 'x-ratelimit-remaining': '7' } });
    return new Response(null, { status: 429, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2000000000' } });
  }) as typeof fetch;
  try {
    const metadata = await fetchUserMetadata('limited');
    assert.equal(requestCount, 3);
    assert.equal(metadata.scanCoverage.rateLimited, true);
    assert.equal(metadata.scanCoverage.inspectedRepositories, 1);
    assert.ok(metadata.scanWarnings[0].includes('取得済み情報'));
    assert.equal(metadata.aggregatedLanguages.TypeScript, 1);
    assert.deepEqual(metadata.detailedRepositoryFacts, [
      { name: 'one', status: 'failed', dependencies: [], files: [] },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rate exhaustion before repository listing reports reset guidance', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, {
    status: 403,
    headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2000000000' },
  })) as typeof fetch;
  try {
    await assert.rejects(() => fetchUserMetadata('limited'), /GitHub APIの利用上限.*再度お試しください/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('secondary rate limit with Retry-After also stops detail requests', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestCount += 1;
    const url = String(input);
    if (url.endsWith('/users/secondary')) return Response.json({ login: 'secondary', public_repos: 1 }, { headers: { 'x-ratelimit-remaining': '55' } });
    if (url.includes('/users/secondary/repos?')) return Response.json([
      { name: 'repo', language: 'TypeScript', updated_at: '2026-01-01', default_branch: 'main', fork: false },
    ], { headers: { 'x-ratelimit-remaining': '54' } });
    return new Response(null, { status: 403, headers: { 'x-ratelimit-remaining': '54', 'retry-after': '60' } });
  }) as typeof fetch;
  try {
    const metadata = await fetchUserMetadata('secondary');
    assert.equal(requestCount, 3);
    assert.equal(metadata.scanCoverage.rateLimited, true);
    assert.ok(metadata.scanCoverage.resetAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a repeat scan preserves public activity after the previous scan time', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/users/activity')) return Response.json({ login: 'activity', public_repos: 0 });
    if (url.includes('/users/activity/repos?')) return Response.json([]);
    if (url.includes('/users/activity/events?')) return Response.json([
      {
        type: 'PushEvent',
        repo: { name: 'activity/project' },
        created_at: '2026-08-02T01:00:00Z',
        payload: { commits: [{ message: 'feat: add quest progress' }, { message: 'Merge branch main' }] },
      },
      {
        type: 'IssuesEvent',
        repo: { name: 'activity/project' },
        created_at: '2026-07-31T01:00:00Z',
        payload: {},
      },
    ]);
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  try {
    const metadata = await fetchUserMetadata('activity', '2026-08-01T00:00:00Z');
    assert.deepEqual(metadata.recentEvents, [{
      type: 'PushEvent',
      repoName: 'activity/project',
      createdAt: '2026-08-02T01:00:00Z',
      commits: ['feat: add quest progress'],
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
