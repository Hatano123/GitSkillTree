import type { UserMetadata } from './github';

/**
 * Deterministic node detection - no API calls, no AI.
 * Checks repos' language fields and package.json dependencies
 * to determine which skill nodes the user has acquired.
 */

// Mapping: nodeId -> detection rules
const mentions = (keywords: string[]) => (repos: UserMetadata['repositories']) =>
  repos.some((repo) => {
    const text = `${repo.name} ${repo.description}`.toLowerCase();
    return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  });

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
    deps: ['react', 'next', 'vue', 'svelte', 'vite', 'tailwindcss'], // フロントエンド技術を使っていればHTML/CSSスキルは保有していると判定
  },
  html: {
    languages: ['HTML'],
    deps: ['react', 'next', 'vue', 'vite'],
  },
  css: {
    languages: ['CSS', 'SCSS', 'Sass', 'Less'],
    deps: ['tailwindcss', '@tailwindcss/vite', 'styled-components', '@emotion/react'],
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
  vue: {
    deps: ['vue', 'nuxt'],
  },
  vite: {
    deps: ['vite'],
  },
  ui_library: {
    deps: ['@mui/material', '@chakra-ui/react', 'antd', 'bootstrap', 'shadcn-ui'],
  },
  state_management: {
    deps: ['redux', '@reduxjs/toolkit', 'zustand', 'mobx', 'pinia', 'recoil', 'jotai'],
  },
  frontend_testing: {
    deps: ['@testing-library/react', '@testing-library/vue', 'vitest', 'jest', 'cypress', '@playwright/test'],
  },
  testing: {
    deps: ['vitest', 'jest', 'mocha', 'pytest', 'junit', 'cypress', '@playwright/test'],
  },
  frontend_deployment: {
    deps: ['vercel', 'netlify-cli', 'firebase-tools'],
    repoCheck: mentions(['vercel', 'netlify', 'firebase hosting', 'deployment']),
  },
  deployment: {
    deps: ['vercel', 'netlify-cli', 'firebase-tools'],
    repoCheck: mentions(['deploy', 'deployment']),
  },
  nextjs: {
    deps: ['next'],
  },
  tailwind: {
    deps: ['tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss'],
  },
  nodejs: {
    // JavaScript/TypeScript alone can be browser-only projects. Require a
    // server-side runtime or framework dependency before granting Node.js.
    deps: ['express', 'koa', 'fastify', 'hapi', 'nest', '@nestjs/core', 'http-server'],
  },
  express: {
    deps: ['express'],
  },
  java: {
    languages: ['Java', 'Kotlin'],
  },
  fastapi: {
    repoCheck: mentions(['fastapi']),
  },
  django: {
    repoCheck: mentions(['django']),
  },
  rest_api: {
    deps: ['express', 'fastify', '@nestjs/core', 'axios', 'openapi-types'],
    repoCheck: mentions(['rest api', 'restful', 'openapi']),
  },
  rest: {
    deps: ['axios', 'openapi-types'],
    repoCheck: mentions(['rest api', 'restful']),
  },
  database: {
    deps: ['pg', 'mysql2', 'mongoose', 'prisma', '@prisma/client', 'typeorm', 'sequelize', 'drizzle-orm'],
  },
  sql: {
    languages: ['SQL', 'PLpgSQL'],
    deps: ['pg', 'mysql2', 'prisma', '@prisma/client', 'typeorm', 'knex', 'sequelize', 'drizzle-orm'],
  },
  nosql: {
    deps: ['mongoose', 'mongodb', 'firebase', '@firebase/firestore', 'redis', 'ioredis'],
  },
  authentication: {
    deps: ['passport', 'jsonwebtoken', 'next-auth', '@auth/core', 'firebase', '@clerk/nextjs'],
  },
  backend_testing: {
    deps: ['supertest', 'pytest', 'jest', 'vitest', 'junit'],
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
  linux: {
    languages: ['Shell'],
    repoCheck: mentions(['linux', 'ubuntu', 'debian']),
  },
  shell: {
    languages: ['Shell', 'PowerShell'],
  },
  docker_compose: {
    repoCheck: mentions(['docker compose', 'docker-compose']),
  },
  nginx: {
    repoCheck: mentions(['nginx']),
  },
  ci: {
    repoCheck: mentions(['continuous integration', ' ci ', 'ci/cd', 'github actions']),
  },
  cd: {
    repoCheck: mentions(['continuous deployment', 'continuous delivery', 'ci/cd', 'deployment pipeline']),
  },
  gcp: {
    deps: ['@google-cloud/storage', '@google-cloud/functions', '@google-cloud/firestore'],
    repoCheck: mentions(['gcp', 'google cloud']),
  },
  terraform: {
    languages: ['HCL'],
    repoCheck: mentions(['terraform']),
  },
  monitoring: {
    deps: ['@sentry/node', '@sentry/react', 'prom-client', 'newrelic', 'dd-trace'],
    repoCheck: mentions(['monitoring', 'prometheus', 'grafana', 'observability']),
  },
  pytorch: {
    deps: ['torch', 'pytorch', 'torchvision'],
  },
  numpy: {
    repoCheck: mentions(['numpy']),
  },
  pandas: {
    repoCheck: mentions(['pandas']),
  },
  scikit_learn: {
    repoCheck: mentions(['scikit-learn', 'sklearn']),
  },
  opencv: {
    repoCheck: mentions(['opencv']),
  },
  tensorflow: {
    repoCheck: mentions(['tensorflow', 'keras']),
  },
  yolo: {
    repoCheck: mentions(['yolo', 'object detection']),
  },
  hugging_face: {
    deps: ['@huggingface/inference'],
    repoCheck: mentions(['hugging face', 'huggingface', 'transformers']),
  },
  computer_vision: {
    repoCheck: mentions(['computer vision', 'image recognition', 'object detection']),
  },
  openai: {
    deps: ['openai', '@google/generative-ai', 'anthropic', '@anthropic-ai/sdk'],
  },
  langchain: {
    deps: ['langchain', '@langchain/core', '@langchain/openai'],
  },
  http: {
    deps: ['axios', 'got', 'undici', 'node-fetch'],
    repoCheck: mentions(['http server', 'http client']),
  },
  tcp: {
    repoCheck: mentions([' tcp ', 'tcp server', 'tcp client']),
  },
  udp: {
    repoCheck: mentions([' udp ', 'udp server', 'udp client']),
  },
  dns: {
    deps: ['dns2'],
    repoCheck: mentions([' dns ', 'domain name system']),
  },
  websocket: {
    deps: ['ws', 'socket.io', 'socket.io-client'],
    repoCheck: mentions(['websocket', 'socket.io']),
  },
  socket_programming: {
    deps: ['ws', 'socket.io'],
    repoCheck: mentions(['socket programming', 'tcp server', 'udp server']),
  },
  ssh: {
    deps: ['ssh2'],
    repoCheck: mentions([' ssh ', 'secure shell']),
  },
  tls: {
    repoCheck: mentions([' tls ', 'ssl', 'https certificate']),
  },
  reverse_proxy: {
    repoCheck: mentions(['reverse proxy', 'nginx', 'traefik']),
  },
  cors: {
    deps: ['cors'],
    repoCheck: mentions(['cors', 'cross-origin']),
  },
  load_balancing: {
    repoCheck: mentions(['load balancing', 'load balancer']),
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

  return acquired;
}
