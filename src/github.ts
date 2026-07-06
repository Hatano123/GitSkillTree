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
}

export async function fetchUserMetadata(username: string): Promise<UserMetadata> {
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

  // Fetch public repositories (up to 100, sorted by last updated)
  const reposRes = await fetch(`https://api.github.com/users/${cleanUsername}/repos?per_page=100&sort=updated`);
  if (!reposRes.ok) {
    throw new Error(`レポジトリ一覧の取得に失敗しました: ${reposRes.statusText}`);
  }
  const reposData = await reposRes.json();

  if (!Array.isArray(reposData) || reposData.length === 0) {
    throw new Error(`ユーザー "${cleanUsername}" には公開リポジトリが存在しないか、取得できませんでした。`);
  }

  const repositories = reposData.map((repo: any) => ({
    name: repo.name,
    description: repo.description || '',
    language: repo.language || '',
    stars: repo.stargazers_count || 0
  }));

  // Aggregate languages by counting occurrences
  const aggregatedLanguages: Record<string, number> = {};
  repositories.forEach((repo) => {
    if (repo.language) {
      aggregatedLanguages[repo.language] = (aggregatedLanguages[repo.language] || 0) + 1;
    }
  });

  // Extract dependencies from top 3 repositories (sorted by stars) to avoid rate limits
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
      // Quietly skip if package.json fetch/parse fails for one repo
      console.log(`Skipping package.json for ${repo.name}`);
    }
  }

  return {
    username: userData.login,
    avatarUrl: userData.avatar_url || '',
    publicReposCount: userData.public_repos || reposData.length,
    repositories,
    aggregatedLanguages,
    packageJsonDeps: Array.from(packageJsonDepsSet)
  };
}
