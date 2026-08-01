import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchUserMetadata, parseManifestDependencies } from './github.ts';

test('manifest dependencies use exact normalized package names', () => {
  assert.deepEqual(parseManifestDependencies('package.json', JSON.stringify({ dependencies: { react: '^19', next: '^16' } })), ['react', 'next']);
  assert.deepEqual(parseManifestDependencies('requirements.txt', 'FastAPI==1.0\nscikit_learn>=2\n# comment'), ['fastapi', 'scikit-learn']);
});

test('scan uses at most eight requests and inspects only three recent non-forks', async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith('/users/example')) return Response.json({ login: 'example', avatar_url: '', public_repos: 4 });
    if (url.includes('/users/example/repos?')) return Response.json([
      { name: 'fork-newest', language: 'Rust', updated_at: '2026-04-01', default_branch: 'main', fork: true },
      { name: 'recent-a', language: 'TypeScript', updated_at: '2026-03-01', default_branch: 'main', fork: false },
      { name: 'recent-b', language: 'Python', updated_at: '2026-02-01', default_branch: 'main', fork: false },
      { name: 'recent-c', language: 'Go', updated_at: '2026-01-01', default_branch: 'main', fork: false },
    ]);
    if (url.includes('/git/trees/')) return Response.json({ tree: [{ path: 'package.json', type: 'blob' }, { path: 'Dockerfile', type: 'blob' }] });
    if (url.includes('/contents/package.json')) return Response.json({ content: btoa('{"dependencies":{"react":"1"}}') });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  try {
    const metadata = await fetchUserMetadata('example');
    assert.equal(urls.length, 8);
    assert.ok(!urls.some((url) => url.includes('/repos/example/fork-newest/git/trees/')));
    assert.equal(urls.filter((url) => url.includes('/contents/')).length, 3);
    assert.equal(metadata.repositories.length, 4);
    assert.equal(metadata.aggregatedLanguages.Rust, 1);
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
  } finally {
    globalThis.fetch = originalFetch;
  }
});
