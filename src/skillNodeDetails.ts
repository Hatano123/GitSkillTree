import { getDetectionDisplayConditions } from './evidenceDetectionRules.ts';

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
    detectionConditions: getDetectionDisplayConditions('react'),
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
    detectionConditions: getDetectionDisplayConditions('fastapi'),
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
    detectionConditions: getDetectionDisplayConditions('docker'),
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
    detectionConditions: getDetectionDisplayConditions('pytorch'),
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
    detectionConditions: getDetectionDisplayConditions('http'),
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
