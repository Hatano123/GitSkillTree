export interface UserMetadata {
  username: string;
  avatarUrl: string;
  publicReposCount: number;
  repositories: {
    name: string;
    description: string;
    language: string;
    stars: number;
  }[];
  aggregatedLanguages: Record<string, number>;
  packageJsonDeps: string[];
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
      { name: 'mock-repo-1', description: 'React app', language: 'TypeScript', stars: 10 },
      { name: 'mock-repo-2', description: 'Backend API', language: 'JavaScript', stars: 5 },
      { name: 'mock-repo-3', description: 'Scripts', language: 'Python', stars: 2 }
    ],
    aggregatedLanguages: { TypeScript: 5, JavaScript: 3, Python: 2 },
    packageJsonDeps: ['react', 'next', 'tailwindcss', 'express', 'pg'],
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
    
    // In local development, if we hit rate limits (403), return mock data to prevent blocking
    if (import.meta.env.DEV) {
      console.warn(`[DEV MODE] GitHub API Error (${userRes.status}). Returning mock data to bypass rate limit.`);
      return getMockUserMetadata(cleanUsername);
    }

    throw new Error(`ユーザー情報の取得に失敗しました: ${userRes.statusText}`);
  }
  const userData = await userRes.json();

  // Fetch public repositories (up to 100)
  const reposRes = await fetch(`https://api.github.com/users/${cleanUsername}/repos?per_page=100&sort=updated`);
  if (!reposRes.ok) {
    if (import.meta.env.DEV) {
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
      stars: repo.stargazers_count || 0
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

  // Extract package dependencies from top starred repos
  const topRepos = [...repositories]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 3);

  const packageJsonDepsSet = new Set<string>();

  for (const repo of topRepos) {
    try {
      const pkgRes = await fetch(`https://api.github.com/repos/${cleanUsername}/${repo.name}/contents/package.json`);
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        if (pkgData.content) {
          const decoded = decodeURIComponent(escape(atob(pkgData.content.replace(/\s/g, ''))));
          const parsedPkg = JSON.parse(decoded);
          const deps = {
            ...parsedPkg.dependencies,
            ...parsedPkg.devDependencies
          };
          
          const noisePackages = [
            'typescript', 'eslint', 'prettier', 'ts-node', 'nodemon', 'husky', 'lint-staged'
          ];
          
          Object.keys(deps).forEach((dep) => {
            if (!dep.startsWith('@types/') && !noisePackages.some(n => dep.includes(n))) {
              packageJsonDepsSet.add(dep);
            }
          });
        }
      }
    } catch (e) {
      console.log(`No package.json in ${repo.name}`);
    }
  }

  return {
    username: userData.login,
    avatarUrl: userData.avatar_url || '',
    publicReposCount: userData.public_repos || reposData.length,
    repositories,
    aggregatedLanguages,
    packageJsonDeps: Array.from(packageJsonDepsSet),
    recentEvents
  };
}
