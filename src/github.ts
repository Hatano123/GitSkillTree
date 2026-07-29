import {
  collectRepositoryFacts,
  factsFromLegacyMetadata,
  type RepositoryFacts,
} from './repositoryFacts';

export interface UserMetadata {
  username: string;
  avatarUrl: string;
  publicReposCount: number;
  repositories: {
    name: string;
    description: string;
    language: string;
    stars: number;
    defaultBranch: string;
  }[];
  aggregatedLanguages: Record<string, number>;
  packageJsonDeps: string[];
  repositoryFacts: RepositoryFacts;
  recentEvents: {
    type: string;
    repoName: string;
    createdAt: string;
    commits: string[];
  }[];
}

// Fallback for local development when GitHub API rate limit is exceeded
function getMockUserMetadata(username: string): UserMetadata {
  return {
    username,
    avatarUrl: 'https://avatars.githubusercontent.com/u/9919?v=4', // GitHub logo
    publicReposCount: 15,
    repositories: [
      { name: 'mock-repo-1', description: 'React app', language: 'TypeScript', stars: 10, defaultBranch: 'main' },
      { name: 'mock-repo-2', description: 'Backend API', language: 'JavaScript', stars: 5, defaultBranch: 'main' },
      { name: 'mock-repo-3', description: 'Scripts', language: 'Python', stars: 2, defaultBranch: 'main' }
    ],
    aggregatedLanguages: { TypeScript: 5, JavaScript: 3, Python: 2 },
    packageJsonDeps: ['react', 'next', 'tailwindcss', 'express', 'pg'],
    repositoryFacts: factsFromLegacyMetadata(
      ['TypeScript', 'JavaScript', 'Python'],
      ['react', 'next', 'tailwindcss', 'express', 'pg'],
    ),
    recentEvents: [
      {
        type: 'PushEvent',
        repoName: `${username}/mock-repo-1`,
        createdAt: new Date().toISOString(),
        commits: ['feat: add new feature', 'fix: bug fix']
      }
    ]
  };
}

function shouldUseDevMock(response: Response): boolean {
  return import.meta.env.DEV && response.status === 403;
}

export async function fetchUserMetadata(username: string, sinceTimestamp?: string): Promise<UserMetadata> {
  const cleanUsername = username.trim();
  if (!cleanUsername) {
    throw new Error('ユーザー名を入力してください。');
  }

  // Fetch basic user profile info
  const userRes = await fetch(`https://api.github.com/users/${cleanUsername}`);
  if (!userRes.ok) {
    if (userRes.status === 404) {
      throw new Error(`GitHubユーザー "${cleanUsername}" が見つかりませんでした。`);
    }
    
    // Only hide GitHub rate limits during local development. Other failures
    // must remain visible instead of being presented as an invented analysis.
    if (shouldUseDevMock(userRes)) {
      console.warn(`[DEV MODE] GitHub API Error (${userRes.status}). Returning mock data to bypass rate limit.`);
      return getMockUserMetadata(cleanUsername);
    }

    throw new Error(`ユーザー情報の取得に失敗しました: ${userRes.statusText}`);
  }
  const userData = await userRes.json();

  // Fetch public repositories (up to 100)
  const reposRes = await fetch(`https://api.github.com/users/${cleanUsername}/repos?per_page=100&sort=updated`);
  if (!reposRes.ok) {
    if (shouldUseDevMock(reposRes)) {
      console.warn(`[DEV MODE] GitHub API Repos Error. Returning mock data.`);
      return getMockUserMetadata(cleanUsername);
    }
    throw new Error(`レポジトリ一覧の取得に失敗しました: ${reposRes.statusText}`);
  }
  const reposData = await reposRes.json();

  const repositories: UserMetadata['repositories'] = reposData
    .filter((repo: any) => !repo.fork) // Exclude forks - only analyze user's own code
    .map((repo: any) => ({
      name: repo.name,
      description: repo.description || '',
      language: repo.language || '',
      stars: repo.stargazers_count || 0,
      defaultBranch: repo.default_branch || 'main',
    }));

  // Aggregate languages
  const aggregatedLanguages: Record<string, number> = {};
  repositories.forEach((repo) => {
    if (repo.language) {
      aggregatedLanguages[repo.language] = (aggregatedLanguages[repo.language] || 0) + 1;
    }
  });

  // Fetch recent public events to detect commit diffs
  let recentEvents: UserMetadata['recentEvents'] = [];
  try {
    const eventsRes = await fetch(`https://api.github.com/users/${cleanUsername}/events`);
    if (eventsRes.ok) {
      const eventsData = await eventsRes.json();
      if (Array.isArray(eventsData)) {
        // Map raw events
        const mapped = eventsData.map((event: any) => {
          let commits = event.payload?.commits?.map((c: any) => c.message) || [];
          // Filter auto messages and truncate
          commits = commits
            .filter((msg: string) => !msg.includes('Merge pull request') && !msg.includes('Merge branch'))
            .map((msg: string) => msg.length > 50 ? msg.substring(0, 50) + '...' : msg);

          return {
            type: event.type,
            repoName: event.repo?.name || '',
            createdAt: event.created_at,
            commits
          };
        });

        // If sinceTimestamp is provided, filter for only new events
        if (sinceTimestamp) {
          const baselineTime = new Date(sinceTimestamp).getTime();
          recentEvents = mapped.filter((e) => new Date(e.createdAt).getTime() > baselineTime);
        } else {
          // Default: take last 10 events for baseline analysis context
          recentEvents = mapped.slice(0, 10);
        }
      }
    } else if (import.meta.env.DEV) {
      console.warn(`[DEV MODE] GitHub API Events Error. Using empty events.`);
    }
  } catch (e) {
    console.warn('Failed to fetch recent events:', e);
  }

  // Build one bounded repository evidence index, then let fixed rules evaluate it.
  const repositoryFacts = await collectRepositoryFacts(cleanUsername, repositories);
  const packageJsonDeps = [...new Set(repositoryFacts.records
    .filter((record) => record.kind === 'dependency' && record.path.toLowerCase().endsWith('package.json'))
    .map((record) => record.value))];

  return {
    username: userData.login,
    avatarUrl: userData.avatar_url || '',
    publicReposCount: userData.public_repos || reposData.length,
    repositories,
    aggregatedLanguages,
    packageJsonDeps,
    repositoryFacts,
    recentEvents
  };
}
