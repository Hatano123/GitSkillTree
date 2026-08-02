import type { ArchetypeInfo } from './types';
import { calculateTechnologyTrend, CATEGORY_LABELS } from './evaluation';

function relativeTrend(nodeIds: readonly string[]) {
  const { counts, values } = calculateTechnologyTrend(nodeIds);
  return (['network', 'infra', 'backend', 'frontend', 'ai'] as const).map((category) => ({
    subject: CATEGORY_LABELS[category],
    A: values[category],
    fullMark: 100,
    detectedCount: counts[category],
  }));
}

// Raw node definitions with level (0 = center, 1 = inner/basic, 2 = middle/applied, 3 = outer/advanced)
// and sector category. Coordinates are calculated dynamically.
export const RAW_NODES = [
  { id: 'git', level: 0, category: 'infra', label: 'Git', description: 'バージョン管理とコラボレーションの基盤。', iconName: 'GitBranch', angle: 0 },
  
  // Level 1: Basics (Radius 1)
  { id: 'html_css', level: 1, category: 'frontend', label: 'HTML/CSS', description: 'ウェブページの構造とスタイリングを定義。', iconName: 'FileCode', angle: 36 },
  { id: 'nodejs', level: 1, category: 'backend', label: 'Node.js', description: 'JSをサーバーサイドで実行するランタイム。', iconName: 'Terminal', angle: 108 },
  { id: 'docker', level: 1, category: 'infra', label: 'Docker', description: 'コンテナ技術を用いた再現性の高い実行環境。', iconName: 'Box', angle: 180 },
  { id: 'github_actions', level: 1, category: 'network', label: 'GitHub Actions', description: 'CI/CD自動化ビルド・テスト・デプロイワークフロー。', iconName: 'Workflow', angle: 252 },
  { id: 'python', level: 1, category: 'ai', label: 'Python', description: 'データサイエンスとAI開発の標準プログラミング言語。', iconName: 'Binary', angle: 324 },

  // Level 2: Intermediate/Applied (Radius 2)
  { id: 'javascript', level: 2, category: 'frontend', label: 'JavaScript', description: 'インタラクティブな動きを提供する動的言語。', iconName: 'Code', angle: 18 },
  { id: 'typescript', level: 2, category: 'frontend', label: 'TypeScript', description: '静的型付けによる堅牢なフロントエンド開発。', iconName: 'ShieldAlert', angle: 54 },
  { id: 'express', level: 2, category: 'backend', label: 'Express', description: 'Node.jsのためのシンプルで高速なウェブフレームワーク。', iconName: 'Server', angle: 108 },
  { id: 'aws', level: 2, category: 'infra', label: 'AWS', description: 'グローバルなクラウドコンピューティングプラットフォーム。', iconName: 'Cloud', angle: 180 },
  { id: 'pytorch', level: 2, category: 'ai', label: 'PyTorch', description: '柔軟で直感的なディープラーニングフレームワーク。', iconName: 'Cpu', angle: 306 },
  { id: 'llm_api', level: 2, category: 'ai', label: 'LLM API', description: 'OpenAI・Gemini・Anthropicなどの生成AIモデルを活用した機能統合。', iconName: 'Sparkles', angle: 342 },

  // Level 3: Advanced/Applied (Radius 3)
  { id: 'react', level: 3, category: 'frontend', label: 'React', description: 'コンポーネント指向UIライブラリのデファクト。', iconName: 'Atom', angle: 10 },
  { id: 'nextjs', level: 3, category: 'frontend', label: 'Next.js', description: 'SSR/SSGに対応したReactのフルスタックフレームワーク。', iconName: 'Layers', angle: 36 },
  { id: 'tailwind', level: 3, category: 'frontend', label: 'Tailwind CSS', description: 'ユーティリティファーストなスタイリング手法。', iconName: 'Palette', angle: 62 },
  { id: 'postgresql', level: 3, category: 'backend', label: 'PostgreSQL', description: '高度なリレーショナルデータベース管理システム。', iconName: 'Database', angle: 108 },
  { id: 'langchain', level: 3, category: 'ai', label: 'LangChain', description: 'LLMを用いたアプリケーション構築用オーケストレーター。', iconName: 'Link', angle: 324 }
];

// Helper function to generate React Flow nodes with circular coordinates
export function getCircularNodes() {
  const centerX = 350;
  const centerY = 350;
  
  // Radii for levels
  const radiusMap: Record<number, number> = {
    0: 0,
    1: 130, // Basics
    2: 240, // Applied
    3: 350  // Advanced
  };

  return RAW_NODES.map((node) => {
    const radius = radiusMap[node.level];
    
    // Subtract 90 degrees to put AI/Network at top if desired, or keep as is.
    // We use standard polar to cartesian coordinate conversion:
    // angle is converted to radians
    const angleRad = (node.angle * Math.PI) / 180;
    
    const x = centerX + radius * Math.cos(angleRad) - 32; // Offset by half node width (64px / 2)
    const y = centerY + radius * Math.sin(angleRad) - 32; // Offset by half node height (64px / 2)

    return {
      id: node.id,
      position: { x, y },
      data: {
        label: node.label,
        category: node.category,
        description: node.description,
        iconName: node.iconName
      }
    };
  });
}

export const INITIAL_NODES = getCircularNodes();

export const INITIAL_EDGES = [
  // Center to Level 1
  { id: 'e-git-html', source: 'git', target: 'html_css', animated: true },
  { id: 'e-git-node', source: 'git', target: 'nodejs', animated: true },
  { id: 'e-git-docker', source: 'git', target: 'docker', animated: true },
  { id: 'e-git-ghactions', source: 'git', target: 'github_actions', animated: true },
  { id: 'e-git-python', source: 'git', target: 'python', animated: true },

  // Level 1 to Level 2
  { id: 'e-html-js', source: 'html_css', target: 'javascript' },
  { id: 'e-js-ts', source: 'javascript', target: 'typescript' },
  { id: 'e-node-express', source: 'nodejs', target: 'express' },
  { id: 'e-docker-aws', source: 'docker', target: 'aws' },
  { id: 'e-python-pytorch', source: 'python', target: 'pytorch' },
  { id: 'e-pytorch-llm-api', source: 'pytorch', target: 'llm_api' },

  // Level 2 to Level 3
  { id: 'e-ts-react', source: 'typescript', target: 'react' },
  { id: 'e-react-nextjs', source: 'react', target: 'nextjs' },
  { id: 'e-react-tailwind', source: 'react', target: 'tailwind' },
  { id: 'e-express-postgres', source: 'express', target: 'postgresql' },
  { id: 'e-llm-api-langchain', source: 'llm_api', target: 'langchain' }
];

export const ARCHETYPES: Record<string, ArchetypeInfo> = {
  frontend: {
    name: 'Frontendを中心とした技術傾向',
    description: 'HTML/CSS、JavaScript、Reactなど、画面づくりに関わる技術が多く確認されています。',
    themeColor: 'text-pink-400 border-pink-500/30 bg-pink-950/20 shadow-pink-900/10',
    accentColor: '#ec4899',
    scores: relativeTrend(['git', 'html_css', 'javascript', 'typescript', 'react', 'tailwind']),
    nextSteps: [
      'Next.js (SSRとNext-Genルーティングによる高速化)',
      'Node.js (BFF層やWeb API開発への領域拡大)',
      'LLM API (UIへのインタラクティブなAIチャットの組み込み)'
    ],
    acquiredNodeIds: ['git', 'html_css', 'javascript', 'typescript', 'react', 'tailwind'],
    recommendedNodeIds: ['nextjs', 'nodejs', 'llm_api']
  },
  ai: {
    name: 'AI / Data領域を中心とした技術傾向',
    description: 'Python、機械学習、AI APIなど、データとAIに関わる技術が多く確認されています。',
    themeColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20 shadow-cyan-900/10',
    accentColor: '#22d3ee',
    scores: relativeTrend(['git', 'python', 'pytorch', 'llm_api']),
    nextSteps: [
      'LangChain (複数のLLMやツールを繋ぐエージェントの作成)',
      'Docker (機械学習モデルや依存ライブラリの環境コンテナ化)',
      'FastAPI / Express (AIエンジンと外部アプリを繋ぐAPI開発)'
    ],
    acquiredNodeIds: ['git', 'python', 'pytorch', 'llm_api'],
    recommendedNodeIds: ['langchain', 'docker', 'nodejs']
  },
  devops: {
    name: 'Infrastructureを中心とした技術傾向',
    description: 'コンテナ、クラウド、CI/CDなど、開発環境と運用に関わる技術が多く確認されています。',
    themeColor: 'text-amber-400 border-amber-500/30 bg-amber-950/20 shadow-amber-900/10',
    accentColor: '#fbbf24',
    scores: relativeTrend(['git', 'docker', 'github_actions']),
    nextSteps: [
      'AWS (より複雑なサーバーレス・コンテナ運用の習得)',
      'PostgreSQL (データベースの冗長化やパフォーマンスチューニング)',
      'TypeScript (AWS CDKを用いたInfrastructure as Code of AWSの推進)'
    ],
    acquiredNodeIds: ['git', 'docker', 'github_actions'],
    recommendedNodeIds: ['aws', 'postgresql', 'typescript']
  },
  fullstack: {
    name: 'Frontend / Backendを中心に幅広く経験',
    description: '画面、API、データベース、開発環境など、複数の領域にまたがる使用技術が確認されています。',
    themeColor: 'text-violet-400 border-violet-500/30 bg-violet-950/20 shadow-violet-900/10',
    accentColor: '#a78bfa',
    scores: relativeTrend(['git', 'html_css', 'javascript', 'typescript', 'react', 'nodejs', 'express', 'postgresql', 'docker']),
    nextSteps: [
      'Next.js (サーバー側とクライアント側を密に結合する高度開発)',
      'AWS (デプロイ環境の自律的スケーリングとサーバーレス化)',
      'LLM API (フルスタックアプリに最新AI機能を付加する)'
    ],
    acquiredNodeIds: ['git', 'html_css', 'javascript', 'typescript', 'react', 'nodejs', 'express', 'postgresql', 'docker'],
    recommendedNodeIds: ['nextjs', 'aws', 'llm_api']
  }
};

export const MOCK_REPOS = [
  { username: 'gaearon', type: 'frontend', name: 'gaearon (Dan Abramov - Frontend)' },
  { username: 'karpathy', type: 'ai', name: 'karpathy (Andre Karpathy - AI)' },
  { username: 'torvalds', type: 'devops', name: 'torvalds (Linus Torvalds - C/OS/Infra)' },
  { username: 'chibicode', type: 'fullstack', name: 'chibicode (Fullstack & UI Creator)' }
];
