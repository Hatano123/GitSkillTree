import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGithubApiPath } from './githubProxy.ts';

test('allows only GitHub endpoints used by the deterministic scanner', () => {
  assert.equal(parseGithubApiPath('/users/octocat'), '/users/octocat');
  assert.equal(parseGithubApiPath('/users/octocat/repos?per_page=100&sort=updated'), '/users/octocat/repos?per_page=100&sort=updated');
  assert.equal(parseGithubApiPath('/users/octocat/events?per_page=30'), '/users/octocat/events?per_page=30');
  assert.equal(parseGithubApiPath('/repos/octocat/Hello-World/git/trees/main?recursive=1'), '/repos/octocat/Hello-World/git/trees/main?recursive=1');
  assert.equal(parseGithubApiPath('/repos/octocat/Hello-World/contents/package.json?ref=main'), '/repos/octocat/Hello-World/contents/package.json?ref=main');
});

test('rejects arbitrary hosts, mutation endpoints, and malformed paths', () => {
  assert.equal(parseGithubApiPath('https://example.com/steal'), null);
  assert.equal(parseGithubApiPath('/user'), null);
  assert.equal(parseGithubApiPath('/repos/octocat/Hello-World/issues'), null);
  assert.equal(parseGithubApiPath('/repos/octocat/Hello-World/contents/../../secret?ref=main'), null);
  assert.equal(parseGithubApiPath('/users/octocat/repos?per_page=100&sort=updated&unexpected=true'), null);
});
