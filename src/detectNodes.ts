import type { UserMetadata } from './github';
import type { DetectionDebugInfo, DetectionEvidenceMatch, SkillCategory } from './types';

export interface NodeSignature {
  nodeId: string;
  category: SkillCategory;
  always?: boolean;
  languages?: string[];
  dependencies?: string[];
  files?: string[];
}

/**
 * Strong, auditable signals only. Adding a technology means adding data here;
 * the matching algorithm below does not change.
 */
export const NODE_SIGNATURES: readonly NodeSignature[] = [
  // Nodes without a defensible strong signal are kept as empty signatures and
  // therefore remain undetected until a strong signal can be defined.
  { nodeId: 'git', category: 'infra', always: true },
  { nodeId: 'html_css', category: 'frontend' },
  { nodeId: 'html', category: 'frontend', languages: ['HTML'], files: ['*.html', '*.htm'] },
  { nodeId: 'css', category: 'frontend', languages: ['CSS', 'SCSS', 'Sass', 'Less'], files: ['*.css', '*.scss', '*.sass', '*.less'] },
  { nodeId: 'javascript', category: 'frontend', languages: ['JavaScript'], files: ['*.js', '*.jsx', '*.mjs', '*.cjs'] },
  { nodeId: 'typescript', category: 'frontend', languages: ['TypeScript'], files: ['*.ts', '*.tsx', '*.mts', '*.cts'] },
  { nodeId: 'react', category: 'frontend', dependencies: ['react', 'react-dom', 'react-native'] },
  { nodeId: 'vue', category: 'frontend', dependencies: ['vue'] },
  { nodeId: 'vite', category: 'frontend', dependencies: ['vite'], files: ['vite.config.*'] },
  { nodeId: 'nextjs', category: 'frontend', dependencies: ['next'], files: ['next.config.*'] },
  { nodeId: 'tailwind', category: 'frontend', dependencies: ['tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss'], files: ['tailwind.config.*'] },
  { nodeId: 'ui_library', category: 'frontend', dependencies: ['@mui/material', '@chakra-ui/react', 'antd', 'bootstrap', 'shadcn-ui'] },
  { nodeId: 'state_management', category: 'frontend', dependencies: ['redux', '@reduxjs/toolkit', 'zustand', 'mobx', 'pinia', 'recoil', 'jotai'] },
  { nodeId: 'frontend_testing', category: 'frontend', dependencies: ['@testing-library/react', '@testing-library/vue', 'vitest', 'jest', 'cypress', '@playwright/test'] },
  { nodeId: 'testing', category: 'frontend' },
  { nodeId: 'frontend_deployment', category: 'frontend', dependencies: ['vercel', 'netlify-cli', 'firebase-tools'], files: ['vercel.json', 'netlify.toml', 'firebase.json'] },
  { nodeId: 'deployment', category: 'frontend', dependencies: ['vercel', 'netlify-cli', 'firebase-tools'], files: ['vercel.json', 'netlify.toml', 'firebase.json'] },

  { nodeId: 'python', category: 'backend', languages: ['Python'], files: ['*.py'] },
  { nodeId: 'nodejs', category: 'backend', dependencies: ['express', 'koa', 'fastify', 'hapi', '@nestjs/core'] },
  { nodeId: 'java', category: 'backend', languages: ['Java', 'Kotlin'], files: ['*.java', '*.kt', '*.kts'] },
  { nodeId: 'fastapi', category: 'backend', dependencies: ['fastapi'] },
  { nodeId: 'express', category: 'backend', dependencies: ['express'] },
  { nodeId: 'django', category: 'backend', dependencies: ['django'] },
  { nodeId: 'rest_api', category: 'backend', dependencies: ['openapi-types'], files: ['openapi.yml', 'openapi.yaml', 'swagger.yml', 'swagger.yaml'] },
  { nodeId: 'database', category: 'backend', dependencies: ['pg', 'mysql2', 'mongoose', 'prisma', '@prisma/client', 'typeorm', 'sequelize', 'drizzle-orm'] },
  { nodeId: 'sql', category: 'backend', languages: ['SQL', 'PLpgSQL'], dependencies: ['pg', 'mysql2', 'prisma', '@prisma/client', 'typeorm', 'knex', 'sequelize', 'drizzle-orm'], files: ['*.sql'] },
  { nodeId: 'postgresql', category: 'backend', dependencies: ['pg'] },
  { nodeId: 'nosql', category: 'backend', dependencies: ['mongoose', 'mongodb', '@firebase/firestore', 'redis', 'ioredis'] },
  { nodeId: 'authentication', category: 'backend', dependencies: ['passport', 'jsonwebtoken', 'next-auth', '@auth/core', 'firebase-auth', '@clerk/nextjs'] },
  { nodeId: 'backend_testing', category: 'backend', dependencies: ['supertest', 'pytest', 'junit'] },

  { nodeId: 'shell', category: 'infra', languages: ['Shell', 'PowerShell'], files: ['*.sh', '*.bash', '*.zsh', '*.ps1'] },
  { nodeId: 'linux', category: 'infra' },
  { nodeId: 'docker', category: 'infra', dependencies: ['dockerode'], files: ['Dockerfile', 'Dockerfile.*'] },
  { nodeId: 'docker_compose', category: 'infra', files: ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'] },
  { nodeId: 'nginx', category: 'infra', files: ['nginx.conf', '*/nginx.conf'] },
  { nodeId: 'github_actions', category: 'infra', files: ['.github/workflows/*.yml', '.github/workflows/*.yaml'] },
  { nodeId: 'ci', category: 'infra', files: ['.github/workflows/*.yml', '.github/workflows/*.yaml', '.gitlab-ci.yml', 'Jenkinsfile'] },
  { nodeId: 'cd', category: 'infra' },
  { nodeId: 'aws', category: 'infra', dependencies: ['aws-sdk', '@aws-sdk/client-s3', '@aws-sdk/lib-dynamodb', 'aws-cdk-lib'], files: ['cdk.json'] },
  { nodeId: 'gcp', category: 'infra', dependencies: ['@google-cloud/storage', '@google-cloud/functions', '@google-cloud/firestore'] },
  { nodeId: 'terraform', category: 'infra', languages: ['HCL'], files: ['*.tf'] },
  { nodeId: 'monitoring', category: 'infra', dependencies: ['@sentry/node', '@sentry/react', 'prom-client', 'newrelic', 'dd-trace'], files: ['prometheus.yml', 'prometheus.yaml'] },

  { nodeId: 'numpy', category: 'ai', dependencies: ['numpy'] },
  { nodeId: 'pandas', category: 'ai', dependencies: ['pandas'] },
  { nodeId: 'scikit_learn', category: 'ai', dependencies: ['scikit-learn'] },
  { nodeId: 'opencv', category: 'ai', dependencies: ['opencv', 'opencv4', 'opencv-python', 'opencv-python-headless', 'opencv-contrib-python', 'opencv-contrib-python-headless'] },
  { nodeId: 'pytorch', category: 'ai', dependencies: ['torch', 'pytorch', 'torchvision'] },
  { nodeId: 'tensorflow', category: 'ai', dependencies: ['tensorflow', 'keras'] },
  { nodeId: 'yolo', category: 'ai', dependencies: ['ultralytics'] },
  { nodeId: 'hugging_face', category: 'ai', dependencies: ['transformers', 'huggingface-hub', '@huggingface/inference'] },
  { nodeId: 'computer_vision', category: 'ai' },
  { nodeId: 'openai', category: 'ai', dependencies: ['openai', '@google/generative-ai', 'anthropic', '@anthropic-ai/sdk'] },
  { nodeId: 'langchain', category: 'ai', dependencies: ['langchain', '@langchain/core', '@langchain/openai'] },

  { nodeId: 'http', category: 'network', dependencies: ['axios', 'got', 'undici', 'node-fetch'] },
  { nodeId: 'tcp', category: 'network' },
  { nodeId: 'udp', category: 'network' },
  { nodeId: 'dns', category: 'network', dependencies: ['dns2'] },
  { nodeId: 'rest', category: 'network', dependencies: ['openapi-types'], files: ['openapi.yml', 'openapi.yaml', 'swagger.yml', 'swagger.yaml'] },
  { nodeId: 'websocket', category: 'network', dependencies: ['ws', 'socket.io', 'socket.io-client'] },
  { nodeId: 'socket_programming', category: 'network', dependencies: ['ws', 'socket.io'] },
  { nodeId: 'ssh', category: 'network', dependencies: ['ssh2'] },
  { nodeId: 'tls', category: 'network' },
  { nodeId: 'reverse_proxy', category: 'network', files: ['nginx.conf', '*/nginx.conf', 'traefik.yml', 'traefik.yaml'] },
  { nodeId: 'cors', category: 'network', dependencies: ['cors'] },
  { nodeId: 'load_balancing', category: 'network' },
] as const;

function matchesFile(pattern: string, path: string): boolean {
  const normalizedPattern = pattern.replaceAll('\\', '/').toLowerCase();
  const normalizedPath = path.replaceAll('\\', '/').toLowerCase();
  const expression = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '[^/]*');
  return new RegExp(`^(?:${expression}|.*/${expression})$`).test(normalizedPath);
}

export interface DetectionFacts {
  languages: readonly string[];
  dependencies: readonly string[];
  files: readonly string[];
}

/** Pure common matcher: one exact language, dependency, or dedicated file unlocks a node. */
export function detectNodesFromFacts(facts: DetectionFacts): string[] {
  const languages = new Set(facts.languages.map((value) => value.toLowerCase()));
  const dependencies = new Set(facts.dependencies.map((value) => value.toLowerCase()));

  return NODE_SIGNATURES.filter((signature) =>
    signature.always === true
    || signature.languages?.some((value) => languages.has(value.toLowerCase()))
    || signature.dependencies?.some((value) => dependencies.has(value.toLowerCase()))
    || signature.files?.some((pattern) => facts.files.some((path) => matchesFile(pattern, path))),
  ).map((signature) => signature.nodeId);
}

function collectMetadataMatches(signature: NodeSignature, metadata: UserMetadata): DetectionEvidenceMatch[] {
  const matches: DetectionEvidenceMatch[] = [];
  if (signature.always) matches.push({ type: 'always', value: '常時開放' });

  for (const repository of metadata.repositories) {
    const language = repository.language.toLowerCase();
    const matchedLanguage = signature.languages?.find((value) => value.toLowerCase() === language);
    if (matchedLanguage) matches.push({ type: 'language', value: matchedLanguage, repository: repository.name });
  }

  for (const repository of metadata.detailedRepositoryFacts) {
    for (const dependency of repository.dependencies) {
      if (signature.dependencies?.some((value) => value.toLowerCase() === dependency.toLowerCase())) {
        matches.push({ type: 'dependency', value: dependency, repository: repository.name });
      }
    }
    for (const file of repository.files) {
      if (signature.files?.some((pattern) => matchesFile(pattern, file))) {
        matches.push({ type: 'file', value: file, repository: repository.name });
      }
    }
  }

  // Keep persisted debug data compact while showing more than one repository
  // when the same evidence appears repeatedly.
  return matches.slice(0, 8);
}

export function detectAcquiredNodesWithDebug(metadata: UserMetadata): { nodeIds: string[]; debug: DetectionDebugInfo } {
  const nodeEvidence = NODE_SIGNATURES
    .map((signature) => ({ nodeId: signature.nodeId, matches: collectMetadataMatches(signature, metadata) }))
    .filter((evidence) => evidence.matches.length > 0);
  return {
    nodeIds: nodeEvidence.map((evidence) => evidence.nodeId),
    debug: {
      listedRepositoryCount: metadata.repositories.length,
      detailedRepositories: metadata.detailedRepositoryFacts.map(({ name, status }) => ({ name, status })),
      nodeEvidence,
    },
  };
}

/** Deterministic detection only; repository names, descriptions, and AI are ignored. */
export function detectAcquiredNodes(metadata: UserMetadata): string[] {
  return detectAcquiredNodesWithDebug(metadata).nodeIds;
}
