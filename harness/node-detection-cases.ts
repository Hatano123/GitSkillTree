import type { DetectionFacts } from '../src/detectNodes.ts';

export interface NodeDetectionCase {
  id: string;
  reason: string;
  facts: DetectionFacts;
  manifests?: readonly { path: string; content: string }[];
  expected: readonly string[];
  forbidden: readonly string[];
}

/**
 * Small, user-facing acceptance corpus. Add a case copied from an actual missed
 * or surprising scan before changing detection behavior.
 */
export const NODE_DETECTION_CASES: readonly NodeDetectionCase[] = [
  {
    id: 'react-vite-is-not-next',
    reason: 'A normal React/Vite repository must not be promoted to Next.js.',
    facts: {
      languages: ['TypeScript'],
      dependencies: [],
      files: ['package.json', 'src/App.tsx', 'vite.config.ts'],
    },
    manifests: [{ path: 'package.json', content: '{"dependencies":{"react":"^19","react-dom":"^19"},"devDependencies":{"vite":"^8"}}' }],
    expected: ['git', 'typescript', 'react', 'vite'],
    forbidden: ['nextjs'],
  },
  {
    id: 'next-has-direct-evidence',
    reason: 'The exact Next package and config file are direct evidence.',
    facts: {
      languages: ['TypeScript'],
      dependencies: [],
      files: ['package.json', 'next.config.mjs', 'app/page.tsx'],
    },
    manifests: [{ path: 'package.json', content: '{"dependencies":{"next":"^16","react":"^19"}}' }],
    expected: ['git', 'typescript', 'react', 'nextjs'],
    forbidden: [],
  },
  {
    id: 'opencv-python-project',
    reason: 'OpenCV package variants commonly appear in Python vision projects.',
    facts: {
      languages: ['Python'],
      dependencies: [],
      files: ['requirements.txt', 'src/camera.py'],
    },
    manifests: [{ path: 'requirements.txt', content: 'numpy>=2\nopencv-python-headless==4.10\n' }],
    expected: ['git', 'python', 'numpy', 'opencv'],
    forbidden: ['tensorflow', 'pytorch', 'yolo'],
  },
  {
    id: 'static-web-source-files',
    reason: 'HTML and CSS should unlock from their own source files.',
    facts: {
      languages: [],
      dependencies: [],
      files: ['public/index.html', 'assets/site.css', 'scripts/main.js'],
    },
    expected: ['git', 'html', 'css', 'javascript'],
    forbidden: ['react', 'nextjs', 'vue'],
  },
  {
    id: 'docker-and-github-actions',
    reason: 'Dedicated infrastructure files are strong evidence.',
    facts: {
      languages: ['Shell'],
      dependencies: [],
      files: ['Dockerfile', 'compose.yaml', '.github/workflows/test.yml', 'scripts/deploy.sh'],
    },
    expected: ['git', 'shell', 'docker', 'docker_compose', 'github_actions', 'ci'],
    forbidden: ['aws', 'gcp', 'terraform'],
  },
  {
    id: 'fastapi-postgresql',
    reason: 'Backend nodes require their exact packages or language evidence.',
    facts: {
      languages: ['Python'],
      dependencies: ['fastapi', 'pytest', 'pg'],
      files: ['pyproject.toml', 'app/main.py'],
    },
    expected: ['git', 'python', 'fastapi', 'postgresql', 'sql', 'backend_testing'],
    forbidden: ['django', 'express'],
  },
  {
    id: 'websocket-and-cors',
    reason: 'Network nodes unlock only from their exact packages.',
    facts: {
      languages: ['JavaScript'],
      dependencies: ['socket.io', 'cors'],
      files: ['package.json', 'server.js'],
    },
    expected: ['git', 'javascript', 'websocket', 'socket_programming', 'cors'],
    forbidden: ['dns', 'ssh', 'tls'],
  },
  {
    id: 'terraform-is-not-cloud-provider',
    reason: 'Terraform files do not prove a particular cloud provider.',
    facts: {
      languages: ['HCL'],
      dependencies: [],
      files: ['infra/main.tf', 'infra/variables.tf'],
    },
    expected: ['git', 'terraform'],
    forbidden: ['aws', 'gcp'],
  },
  {
    id: 'gemini-is-not-openai',
    reason: 'A Gemini SDK dependency is direct evidence for Gemini, not OpenAI.',
    facts: {
      languages: ['TypeScript'],
      dependencies: ['@google/generative-ai'],
      files: ['package.json', 'src/gemini.ts'],
    },
    expected: ['git', 'typescript'],
    forbidden: ['openai'],
  },
  {
    id: 'kotlin-is-not-java',
    reason: 'Kotlin source is not exact evidence that Java was used.',
    facts: {
      languages: ['Kotlin'],
      dependencies: [],
      files: ['app/src/main/kotlin/Main.kt'],
    },
    expected: ['git'],
    forbidden: ['java'],
  },
  {
    id: 'git-empty-profile',
    reason: 'Git is the only unconditional node.',
    facts: { languages: [], dependencies: [], files: [] },
    expected: ['git'],
    forbidden: ['html', 'python', 'linux', 'http'],
  },
] as const;
