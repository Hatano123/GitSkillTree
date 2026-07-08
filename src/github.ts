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
    throw new Error(`ユーザー情報の取得に失敗しました: ${userRes.statusText}`);
  }
  const userData = await userRes.json();

  // Fetch public repositories (up to 100)
  const reposRes = await fetch(`https://api.github.com/users/${cleanUsername}/repos?per_page=100&sort=updated`);
  if (!reposRes.ok) {
    throw new Error(`レポジトリ一覧の取得に失敗しました: ${reposRes.statusText}`);
  }
  const reposData = await reposRes.json();

  const repositories: UserMetadata['repositories'] = reposData.map((repo: any) => ({
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
          const commits = event.payload?.commits?.map((c: any) => c.message) || [];
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
          Object.keys(deps).forEach((dep) => packageJsonDepsSet.add(dep));
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
