export type SkillNodeDetail = {
  nodeId: string;
  description: string;
  detectionConditions: string[];
  projectIdeas: string[];
  relatedNodeIds: string[];
};

export const SKILL_NODE_DETAILS: Record<string, SkillNodeDetail> = {
  'frontend-react': {
    nodeId: 'frontend-react',
    description: 'コンポーネント単位でUIを構築するJavaScriptライブラリです。',
    detectionConditions: [
      'package.json の dependencies または devDependencies に react が含まれる',
      '.jsx / .tsx ファイルで React コンポーネントが実装されている',
    ],
    projectIdeas: [
      'Todoアプリ',
      'GitHub API表示アプリ',
      'Firebase認証付きアプリ',
    ],
    relatedNodeIds: ['frontend-typescript', 'frontend-vite', 'frontend-nextjs'],
  },
  'backend-fastapi': {
    nodeId: 'backend-fastapi',
    description: 'Pythonで型安全かつ高速なAPIを構築するWebフレームワークです。',
    detectionConditions: [
      'requirements.txt または pyproject.toml に fastapi が含まれる',
      'Pythonコードで FastAPI を生成し、APIルートを定義している',
    ],
    projectIdeas: [
      'タスク管理REST API',
      '画像アップロードAPI',
      'JWT認証付きユーザーAPI',
    ],
    relatedNodeIds: ['backend-python', 'backend-rest-api', 'backend-testing'],
  },
  'infra-docker': {
    nodeId: 'infra-docker',
    description: 'アプリケーションと依存環境を再現可能なコンテナとしてまとめる技術です。',
    detectionConditions: [
      'リポジトリに Dockerfile が含まれる',
      'コンテナのビルドまたは起動構成が記述されている',
    ],
    projectIdeas: [
      'Webアプリのコンテナ化',
      '開発環境のDocker Compose化',
      'GitHub Actionsでのイメージ自動ビルド',
    ],
    relatedNodeIds: ['infra-docker-compose', 'infra-github-actions', 'infra-ci'],
  },
  'ai-pytorch': {
    nodeId: 'ai-pytorch',
    description: '柔軟なモデル構築と学習処理に使われる深層学習フレームワークです。',
    detectionConditions: [
      'requirements.txt または pyproject.toml に torch が含まれる',
      'Pythonコードで torch を使ったモデルまたは学習処理が実装されている',
    ],
    projectIdeas: [
      '画像分類モデル',
      '手書き数字認識アプリ',
      '学習結果を可視化する実験ダッシュボード',
    ],
    relatedNodeIds: ['ai-python', 'ai-yolo', 'ai-hugging-face'],
  },
  'network-http': {
    nodeId: 'network-http',
    description: 'Web上でクライアントとサーバーが要求・応答を交換する通信プロトコルです。',
    detectionConditions: [
      'HTTPクライアントまたはWebサーバーを利用するコードが含まれる',
      'APIエンドポイントやHTTPメソッドを扱う実装が含まれる',
    ],
    projectIdeas: [
      'HTTPリクエスト確認ツール',
      'シンプルなWeb APIクライアント',
      'レスポンスヘッダー可視化アプリ',
    ],
    relatedNodeIds: ['network-tcp', 'network-rest', 'network-tls'],
  },
};

export function getSkillNodeDetail(nodeId: string): SkillNodeDetail | undefined {
  return SKILL_NODE_DETAILS[nodeId];
}
