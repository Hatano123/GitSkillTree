import type { UserMetadata } from './github';

/**
 * Deterministic node detection - no API calls, no AI.
 * Checks repos' language fields and package.json dependencies
 * to determine which skill nodes the user has acquired.
 */

// Mapping: nodeId -> detection rules
const NODE_DETECTION_RULES: Record<string, {
  languages?: string[];
  deps?: string[];
  repoCheck?: (repos: UserMetadata['repositories']) => boolean;
}> = {
  git: {
    repoCheck: (repos) => repos.length > 0,
  },
  html_css: {
    languages: ['HTML', 'CSS', 'SCSS', 'Sass', 'Less'],
  },
  javascript: {
    languages: ['JavaScript'],
  },
  typescript: {
    languages: ['TypeScript'],
  },
  python: {
    languages: ['Python'],
  },
  react: {
    deps: ['react', 'react-dom', 'react-native'],
  },
  nextjs: {
    deps: ['next'],
  },
  tailwind: {
    deps: ['tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss'],
  },
  nodejs: {
    deps: ['express', 'koa', 'fastify', 'hapi', 'nest', '@nestjs/core', 'http-server'],
    languages: ['JavaScript', 'TypeScript'],
  },
  express: {
    deps: ['express'],
  },
  postgresql: {
    deps: ['pg', 'prisma', '@prisma/client', 'typeorm', 'knex', 'sequelize', 'drizzle-orm'],
  },
  docker: {
    repoCheck: (repos) => repos.some(r =>
      r.name.toLowerCase().includes('docker') ||
      r.description.toLowerCase().includes('docker') ||
      r.description.toLowerCase().includes('container')
    ),
    deps: ['dockerode'],
  },
  aws: {
    deps: ['aws-sdk', '@aws-sdk/client-s3', '@aws-sdk/lib-dynamodb', 'aws-cdk-lib'],
    repoCheck: (repos) => repos.some(r =>
      r.name.toLowerCase().includes('aws') ||
      r.description.toLowerCase().includes('aws')
    ),
  },
  github_actions: {
    // Hard to detect from deps/language alone.
    // Check repo names/descriptions for CI/CD clues.
    repoCheck: (repos) => repos.some(r =>
      r.name.toLowerCase().includes('ci') ||
      r.name.toLowerCase().includes('actions') ||
      r.description.toLowerCase().includes('github actions') ||
      r.description.toLowerCase().includes('ci/cd')
    ),
  },
  pytorch: {
    deps: ['torch', 'pytorch', 'torchvision'],
  },
  openai: {
    deps: ['openai', '@google/generative-ai', 'anthropic', '@anthropic-ai/sdk'],
  },
  langchain: {
    deps: ['langchain', '@langchain/core', '@langchain/openai'],
  },
};

/**
 * Detect which skill nodes are acquired based on existing metadata.
 * Pure logic - no API calls, runs instantly.
 */
export function detectAcquiredNodes(metadata: UserMetadata): string[] {
  const acquired: string[] = [];
  const languages = new Set(Object.keys(metadata.aggregatedLanguages));
  const deps = new Set(metadata.packageJsonDeps.map(d => d.toLowerCase()));

  for (const [nodeId, rules] of Object.entries(NODE_DETECTION_RULES)) {
    let detected = false;

    // Check language match
    if (rules.languages) {
      for (const lang of rules.languages) {
        if (languages.has(lang)) {
          detected = true;
          break;
        }
      }
    }

    // Check dependency match
    if (!detected && rules.deps) {
      for (const dep of rules.deps) {
        if (deps.has(dep.toLowerCase())) {
          detected = true;
          break;
        }
      }
    }

    // Check custom repo logic
    if (!detected && rules.repoCheck) {
      detected = rules.repoCheck(metadata.repositories);
    }

    if (detected) {
      acquired.push(nodeId);
    }
  }

  // Special case: nodejs is acquired if user has JS or TS repos with deps
  // (already handled by the combo rule above, but enforce it)
  if (!acquired.includes('nodejs') && (languages.has('JavaScript') || languages.has('TypeScript')) && deps.size > 0) {
    acquired.push('nodejs');
  }

  return acquired;
}
