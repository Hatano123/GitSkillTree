import type { Edge, Node } from '@xyflow/react';
import type { SkillCategory, SkillNodeData, SkillNodeStatus, SkillTreeNode } from './types';

export const SKILL_CATEGORIES: { id: SkillCategory; label: string; shortLabel: string }[] = [
  { id: 'frontend', label: 'Frontend', shortLabel: 'FE' },
  { id: 'backend', label: 'Backend', shortLabel: 'BE' },
  { id: 'infra', label: 'Infrastructure', shortLabel: 'INFRA' },
  { id: 'ai', label: 'AI', shortLabel: 'AI' },
  { id: 'network', label: 'Network', shortLabel: 'NET' },
];

export const LAYER_LABELS = ['基礎', '主要技術', '組み合わせ', '運用・発展'] as const;

const x = (layer: number) => (layer - 1) * 270 + 40;
const p = (layer: number, y: number) => ({ x: x(layer), y });
const node = (
  id: string,
  label: string,
  category: SkillCategory,
  layer: number,
  detectionNodeIds: string[],
  relatedNodeIds: string[],
  y: number,
  iconName: string,
  description: string,
): SkillTreeNode => ({ id, label, category, layer, detectionNodeIds, relatedNodeIds, position: p(layer, y), iconName, description });

export const SKILL_TREE_NODES: SkillTreeNode[] = [
  node('frontend-html', 'HTML', 'frontend', 1, ['html', 'html_css'], ['frontend-react', 'frontend-vue'], 55, 'FileCode', 'Webページの構造を表現するマークアップ。'),
  node('frontend-css', 'CSS', 'frontend', 1, ['css', 'html_css'], ['frontend-ui-library', 'frontend-vite'], 205, 'Palette', 'レイアウトと見た目を構築するスタイル技術。'),
  node('frontend-javascript', 'JavaScript', 'frontend', 1, ['javascript'], ['frontend-typescript', 'frontend-react', 'frontend-vue'], 355, 'Code', 'ブラウザ上の振る舞いを実装する言語。'),
  node('frontend-typescript', 'TypeScript', 'frontend', 2, ['typescript'], ['frontend-react', 'frontend-vue', 'frontend-testing'], 40, 'ShieldAlert', 'JavaScriptへ静的型付けを加える言語。'),
  node('frontend-react', 'React', 'frontend', 2, ['react'], ['frontend-nextjs', 'frontend-state-management', 'frontend-testing'], 190, 'Atom', 'コンポーネント指向のUIライブラリ。'),
  node('frontend-vue', 'Vue', 'frontend', 2, ['vue'], ['frontend-vite', 'frontend-state-management', 'frontend-testing'], 340, 'Layers', '段階的に導入できるUIフレームワーク。'),
  node('frontend-vite', 'Vite', 'frontend', 3, ['vite'], ['frontend-deployment'], 25, 'Workflow', '高速なフロントエンドビルドツール。'),
  node('frontend-nextjs', 'Next.js', 'frontend', 3, ['nextjs'], ['frontend-deployment'], 135, 'Layers', 'ReactベースのフルスタックWebフレームワーク。'),
  node('frontend-ui-library', 'UI Library', 'frontend', 3, ['ui_library', 'tailwind'], ['frontend-testing'], 245, 'Palette', '再利用可能なUI部品とデザイン基盤。'),
  node('frontend-state-management', 'State Management', 'frontend', 3, ['state_management'], ['frontend-testing'], 355, 'Database', '複数画面・部品を横断する状態管理。'),
  node('frontend-testing', 'Testing', 'frontend', 4, ['frontend_testing', 'testing'], ['frontend-deployment'], 120, 'ShieldAlert', 'UIの振る舞いを自動検証する仕組み。'),
  node('frontend-deployment', 'Deployment', 'frontend', 4, ['frontend_deployment', 'deployment'], [], 300, 'Cloud', 'Webアプリを継続的に公開する運用。'),

  node('backend-python', 'Python', 'backend', 1, ['python'], ['backend-fastapi', 'backend-django'], 55, 'Binary', 'APIや業務処理に広く使われる言語。'),
  node('backend-nodejs', 'Node.js', 'backend', 1, ['nodejs'], ['backend-express'], 205, 'Terminal', 'JavaScriptのサーバーサイド実行環境。'),
  node('backend-java', 'Java', 'backend', 1, ['java'], ['backend-rest-api', 'backend-authentication'], 355, 'Code', '堅牢なサーバー開発に使われる言語。'),
  node('backend-fastapi', 'FastAPI', 'backend', 2, ['fastapi'], ['backend-rest-api', 'backend-testing'], 40, 'Server', 'Python向けの高速なAPIフレームワーク。'),
  node('backend-express', 'Express', 'backend', 2, ['express'], ['backend-rest-api', 'backend-testing'], 190, 'Server', 'Node.js向けの軽量Webフレームワーク。'),
  node('backend-django', 'Django', 'backend', 2, ['django'], ['backend-database', 'backend-authentication'], 340, 'Server', '機能を包括したPython Webフレームワーク。'),
  node('backend-rest-api', 'REST API', 'backend', 3, ['rest_api', 'rest'], ['backend-authentication', 'backend-testing'], 25, 'Workflow', 'HTTPリソース指向のAPI設計。'),
  node('backend-database', 'Database', 'backend', 3, ['database'], ['backend-sql', 'backend-nosql'], 135, 'Database', 'アプリケーションデータの永続化。'),
  node('backend-sql', 'SQL', 'backend', 3, ['sql', 'postgresql'], ['backend-testing'], 245, 'Database', 'リレーショナルデータを扱う問い合わせ言語。'),
  node('backend-nosql', 'NoSQL', 'backend', 3, ['nosql'], ['backend-testing'], 355, 'Database', '非リレーショナルなデータストア。'),
  node('backend-authentication', 'Authentication', 'backend', 4, ['authentication'], [], 120, 'ShieldAlert', 'ユーザー本人性とアクセスを保護する仕組み。'),
  node('backend-testing', 'Testing', 'backend', 4, ['backend_testing', 'testing'], [], 300, 'ShieldAlert', 'APIと業務ロジックの自動検証。'),

  node('infra-linux', 'Linux', 'infra', 1, ['linux'], ['infra-docker', 'infra-nginx'], 55, 'Terminal', 'サーバー運用の基盤となるOS。'),
  node('infra-shell', 'Shell', 'infra', 1, ['shell'], ['infra-docker-compose', 'infra-ci'], 205, 'Terminal', '環境操作と自動化を記述するスクリプト。'),
  node('infra-docker', 'Docker', 'infra', 1, ['docker'], ['infra-docker-compose', 'infra-ci'], 355, 'Box', 'アプリと依存関係をコンテナ化する技術。'),
  node('infra-docker-compose', 'Docker Compose', 'infra', 2, ['docker_compose'], ['infra-cd', 'infra-monitoring'], 40, 'Box', '複数コンテナをまとめて構成する仕組み。'),
  node('infra-nginx', 'Nginx', 'infra', 2, ['nginx'], ['infra-monitoring', 'infra-cd'], 190, 'Server', 'Web配信とリバースプロキシを担うサーバー。'),
  node('infra-github-actions', 'GitHub Actions', 'infra', 2, ['github_actions'], ['infra-ci', 'infra-cd'], 340, 'Workflow', 'GitHub上でワークフローを自動実行する仕組み。'),
  node('infra-ci', 'CI', 'infra', 3, ['ci'], ['infra-cd'], 25, 'Workflow', '変更を継続的に統合・検証する運用。'),
  node('infra-cd', 'CD', 'infra', 3, ['cd'], ['infra-monitoring'], 135, 'Workflow', '変更を継続的に提供・配備する運用。'),
  node('infra-aws', 'AWS', 'infra', 3, ['aws'], ['infra-terraform', 'infra-monitoring'], 245, 'Cloud', 'Amazonのクラウドプラットフォーム。'),
  node('infra-gcp', 'GCP', 'infra', 3, ['gcp'], ['infra-terraform', 'infra-monitoring'], 355, 'Cloud', 'Googleのクラウドプラットフォーム。'),
  node('infra-terraform', 'Terraform', 'infra', 4, ['terraform'], ['infra-monitoring'], 120, 'Layers', 'インフラをコードで宣言・管理する技術。'),
  node('infra-monitoring', 'Monitoring', 'infra', 4, ['monitoring'], [], 300, 'Sparkles', '稼働状況と異常を継続的に観測する仕組み。'),

  node('ai-python', 'Python', 'ai', 1, ['python'], ['ai-numpy', 'ai-pandas'], 55, 'Binary', 'データ処理とAI開発の中心的な言語。'),
  node('ai-numpy', 'NumPy', 'ai', 1, ['numpy'], ['ai-scikit-learn', 'ai-pytorch', 'ai-tensorflow'], 205, 'Database', '数値計算と多次元配列の基盤。'),
  node('ai-pandas', 'Pandas', 'ai', 1, ['pandas'], ['ai-scikit-learn'], 355, 'Database', '表形式データを加工・分析するライブラリ。'),
  node('ai-scikit-learn', 'scikit-learn', 'ai', 2, ['scikit_learn'], ['ai-hugging-face'], 40, 'Cpu', '古典的な機械学習の標準ライブラリ。'),
  node('ai-opencv', 'OpenCV', 'ai', 2, ['opencv'], ['ai-computer-vision', 'ai-yolo'], 190, 'Cpu', '画像・映像処理のライブラリ。'),
  node('ai-pytorch', 'PyTorch', 'ai', 2, ['pytorch'], ['ai-yolo', 'ai-hugging-face'], 340, 'Cpu', '柔軟な深層学習フレームワーク。'),
  node('ai-tensorflow', 'TensorFlow', 'ai', 3, ['tensorflow'], ['ai-computer-vision'], 25, 'Cpu', '機械学習モデルの構築・運用基盤。'),
  node('ai-yolo', 'YOLO', 'ai', 3, ['yolo'], ['ai-computer-vision'], 135, 'Sparkles', 'リアルタイム物体検出モデル群。'),
  node('ai-hugging-face', 'Hugging Face', 'ai', 3, ['hugging_face'], ['ai-langchain'], 245, 'Sparkles', 'モデルとデータセットの共有・利用基盤。'),
  node('ai-computer-vision', 'Computer Vision', 'ai', 3, ['computer_vision'], [], 355, 'Cpu', '画像から意味を抽出する技術領域。'),
  node('ai-openai-api', 'OpenAI API', 'ai', 4, ['openai'], ['ai-langchain'], 120, 'Sparkles', '生成AIモデルをアプリへ組み込むAPI。'),
  node('ai-langchain', 'LangChain', 'ai', 4, ['langchain'], [], 300, 'Link', 'LLMアプリの処理を組み立てるフレームワーク。'),

  node('network-http', 'HTTP', 'network', 1, ['http'], ['network-rest', 'network-websocket', 'network-cors'], 55, 'Workflow', 'Webの要求と応答を運ぶプロトコル。'),
  node('network-tcp', 'TCP', 'network', 1, ['tcp'], ['network-socket-programming', 'network-tls'], 205, 'Link', '信頼性のある接続型の通信プロトコル。'),
  node('network-udp', 'UDP', 'network', 1, ['udp'], ['network-socket-programming'], 355, 'Link', '軽量なコネクションレス通信。'),
  node('network-dns', 'DNS', 'network', 2, ['dns'], ['network-tls', 'network-reverse-proxy'], 40, 'Cloud', '名前とIPアドレスを対応付ける仕組み。'),
  node('network-rest', 'REST', 'network', 2, ['rest', 'rest_api'], ['network-cors', 'network-load-balancing'], 190, 'Workflow', 'リソース指向のWeb API設計様式。'),
  node('network-websocket', 'WebSocket', 'network', 2, ['websocket'], ['network-load-balancing'], 340, 'Link', '双方向の常時接続通信。'),
  node('network-socket-programming', 'Socket Programming', 'network', 3, ['socket_programming'], ['network-tls'], 25, 'Terminal', 'ソケットAPIを使った低レベル通信実装。'),
  node('network-ssh', 'SSH', 'network', 3, ['ssh'], ['network-reverse-proxy'], 135, 'Terminal', '安全なリモート接続プロトコル。'),
  node('network-tls', 'TLS', 'network', 3, ['tls'], ['network-reverse-proxy'], 245, 'ShieldAlert', '通信を暗号化し相手を検証する仕組み。'),
  node('network-reverse-proxy', 'Reverse Proxy', 'network', 3, ['reverse_proxy', 'nginx'], ['network-load-balancing'], 355, 'Server', '外部リクエストを内部サーバーへ中継する構成。'),
  node('network-cors', 'CORS', 'network', 4, ['cors'], [], 120, 'ShieldAlert', 'ブラウザのオリジン間アクセス制御。'),
  node('network-load-balancing', 'Load Balancing', 'network', 4, ['load_balancing'], [], 300, 'Layers', 'トラフィックを複数の処理先へ分散する仕組み。'),
];

export const DETECTION_NODE_IDS = [...new Set(SKILL_TREE_NODES.flatMap((item) => item.detectionNodeIds))];

export function isTreeNodeDetected(treeNode: SkillTreeNode, detectedNodeIds: ReadonlySet<string>): boolean {
  return treeNode.detectionNodeIds.some((id) => detectedNodeIds.has(id));
}

export function getNodeStatus(
  treeNode: SkillTreeNode,
  detectedNodeIds: ReadonlySet<string>,
  previousDetectedNodeIds?: ReadonlySet<string>,
): SkillNodeStatus {
  if (!isTreeNodeDetected(treeNode, detectedNodeIds)) return 'locked';
  if (previousDetectedNodeIds && !isTreeNodeDetected(treeNode, previousDetectedNodeIds)) return 'new';
  return 'unlocked';
}

export function getNextTreeNodes(
  detectedNodeIds: readonly string[],
  category?: SkillCategory,
  limit = 3,
): SkillTreeNode[] {
  const detected = new Set(detectedNodeIds);
  const candidates = category ? SKILL_TREE_NODES.filter((item) => item.category === category) : SKILL_TREE_NODES;
  const byId = new Map(SKILL_TREE_NODES.map((item) => [item.id, item]));
  const active = candidates.filter((item) => isTreeNodeDetected(item, detected));
  const adjacentIds = active.flatMap((item) => item.relatedNodeIds);
  const adjacent = [...new Set(adjacentIds)]
    .map((id) => byId.get(id))
    .filter((item): item is SkillTreeNode => Boolean(item))
    .filter((item) => (!category || item.category === category) && !isTreeNodeDetected(item, detected));
  const fallback = candidates
    .filter((item) => item.layer === 1 && !isTreeNodeDetected(item, detected))
    .sort((a, b) => a.position.y - b.position.y);
  return [...new Map([...adjacent, ...fallback].map((item) => [item.id, item])).values()].slice(0, limit);
}

export function getRecommendedDetectionNodeIds(detectedNodeIds: readonly string[], limit = 3): string[] {
  return getNextTreeNodes(detectedNodeIds, undefined, limit).map((item) => item.detectionNodeIds[0]);
}

export function createCategoryFlow(
  category: SkillCategory,
  detectedNodeIds: readonly string[],
  previousDetectedNodeIds?: readonly string[],
): { nodes: Node<SkillNodeData>[]; edges: Edge[]; nextNodes: SkillTreeNode[] } {
  const detected = new Set(detectedNodeIds);
  const previous = previousDetectedNodeIds ? new Set(previousDetectedNodeIds) : undefined;
  const categoryNodes = SKILL_TREE_NODES.filter((item) => item.category === category);
  const categoryIds = new Set(categoryNodes.map((item) => item.id));
  const nextNodes = getNextTreeNodes(detectedNodeIds, category);
  const nextIds = new Set(nextNodes.map((item) => item.id));

  const nodes: Node<SkillNodeData>[] = categoryNodes.map((item) => ({
    id: item.id,
    type: 'custom',
    position: item.position,
    draggable: false,
    data: {
      label: item.label,
      state: getNodeStatus(item, detected, previous) === 'locked' ? 'locked' : 'unlocked',
      status: getNodeStatus(item, detected, previous),
      category: item.category,
      layer: item.layer,
      description: item.description,
      iconName: item.iconName,
      recommended: nextIds.has(item.id),
    },
  }));

  const edges: Edge[] = categoryNodes.flatMap((source) =>
    source.relatedNodeIds
      .filter((target) => categoryIds.has(target))
      .map((target) => {
        const targetNode = categoryNodes.find((item) => item.id === target)!;
        const sourceDetected = isTreeNodeDetected(source, detected);
        const targetDetected = isTreeNodeDetected(targetNode, detected);
        const recommended = sourceDetected && nextIds.has(target);
        const stroke = sourceDetected && targetDetected ? '#10b981' : recommended ? '#fbbf24' : '#334155';
        return {
          id: `${source.id}-${target}`,
          source: source.id,
          target,
          type: 'smoothstep',
          animated: sourceDetected && (targetDetected || recommended),
          style: { stroke, strokeWidth: sourceDetected ? 2 : 1.25 },
        };
      }),
  );

  return { nodes, edges, nextNodes };
}

/** Compact constellation shown before a category is expanded. */
export function createCategoryOverviewFlow(
  detectedNodeIds: readonly string[],
  onSelect: (category: SkillCategory) => void,
): { nodes: Node<SkillNodeData>[]; edges: Edge[] } {
  const detected = new Set(detectedNodeIds);
  const positions: Record<SkillCategory, { x: number; y: number }> = {
    frontend: { x: 760, y: 105 },
    backend: { x: 820, y: 400 },
    infra: { x: 500, y: 590 },
    ai: { x: 150, y: 400 },
    network: { x: 210, y: 105 },
  };
  const hub: Node<SkillNodeData> = {
    id: 'skill-map', type: 'custom', position: { x: 490, y: 285 }, draggable: false,
    data: { label: 'Skill Map', state: 'unlocked', status: 'unlocked', category: 'frontend', layer: 0, description: 'カテゴリをクリックして枝を展開します。', iconName: 'GitBranch', kind: 'hub' },
  };
  const categoryNodes: Node<SkillNodeData>[] = SKILL_CATEGORIES.map((category) => {
    const skills = SKILL_TREE_NODES.filter((item) => item.category === category.id);
    const detectedCount = skills.filter((item) => isTreeNodeDetected(item, detected)).length;
    return {
      id: `category-${category.id}`,
      type: 'custom',
      position: positions[category.id],
      draggable: false,
      data: {
        label: category.label,
        state: detectedCount > 0 ? 'unlocked' : 'locked',
        status: detectedCount > 0 ? 'unlocked' : 'locked',
        category: category.id,
        layer: 0,
        description: `${detectedCount} / ${skills.length} 技術を検出`,
        iconName: category.id === 'ai' ? 'Sparkles' : category.id === 'infra' ? 'Cloud' : category.id === 'network' ? 'Link' : category.id === 'backend' ? 'Server' : 'Atom',
        kind: 'category',
        detectedCount,
        onClick: () => onSelect(category.id),
      },
    };
  });
  const edges: Edge[] = categoryNodes.map((item) => ({
    id: `skill-map-${item.id}`,
    source: 'skill-map', target: item.id, type: 'smoothstep',
    animated: item.data.status === 'unlocked',
    style: { stroke: item.data.status === 'unlocked' ? '#14b8a6' : '#334155', strokeWidth: 1.5, strokeDasharray: '5 5' },
  }));
  return { nodes: [hub, ...categoryNodes], edges };
}

const MAIN_FLOW_CENTER = { x: 1050, y: 850 };
const CATEGORY_ANGLES: Record<SkillCategory, number> = {
  frontend: -72,
  backend: 0,
  infra: 72,
  ai: 144,
  network: 216,
};

function polarPosition(angle: number, radius: number, offset = 0) {
  const radians = (angle * Math.PI) / 180;
  const perpendicular = radians + Math.PI / 2;
  return {
    x: MAIN_FLOW_CENTER.x + Math.cos(radians) * radius + Math.cos(perpendicular) * offset,
    y: MAIN_FLOW_CENTER.y + Math.sin(radians) * radius + Math.sin(perpendicular) * offset,
  };
}

/**
 * The complete fixed tree projected into the original main-branch React Flow UI.
 * This changes only the data supplied to the canvas; CustomNode and the page UI
 * remain identical to main.
 */
export const FIXED_TREE_FLOW_NODES = [
  {
    id: 'git',
    position: MAIN_FLOW_CENTER,
    data: {
      label: 'Git', category: 'infra' as const, description: 'すべての技術ブランチの起点。',
      iconName: 'GitBranch', detectionNodeIds: ['git'], kind: 'hub' as const,
    },
  },
  ...SKILL_CATEGORIES.flatMap((category) => {
    const angle = CATEGORY_ANGLES[category.id];
    const categorySkills = SKILL_TREE_NODES.filter((item) => item.category === category.id);
    const categoryNode = {
      id: `category-${category.id}`,
      position: polarPosition(angle, 180),
      data: {
        label: category.label,
        category: category.id,
        description: `${category.label} の固定スキルブランチ。`,
        iconName: category.id === 'frontend' ? 'Atom' : category.id === 'backend' ? 'Server' : category.id === 'infra' ? 'Cloud' : category.id === 'ai' ? 'Sparkles' : 'Link',
        detectionNodeIds: [...new Set(categorySkills.flatMap((item) => item.detectionNodeIds))],
        kind: 'category' as const,
      },
    };
    const skillNodes = categorySkills.map((item) => {
      const sameLayer = categorySkills.filter((candidate) => candidate.layer === item.layer);
      const index = sameLayer.findIndex((candidate) => candidate.id === item.id);
      const sectorArc = 52;
      const angleOffset = sameLayer.length === 1
        ? 0
        : -sectorArc / 2 + index * (sectorArc / (sameLayer.length - 1));
      return {
        id: item.id,
        position: polarPosition(angle + angleOffset, 330 + (item.layer - 1) * 155),
        data: {
          label: item.label,
          category: item.category,
          description: item.description,
          iconName: item.iconName,
          detectionNodeIds: item.detectionNodeIds,
          kind: 'skill' as const,
          layer: item.layer,
        },
      };
    });
    return [categoryNode, ...skillNodes];
  }),
];

const NODE_HALF_SIZE = 36;
const FLOW_VISUAL_CENTER = {
  x: MAIN_FLOW_CENTER.x + NODE_HALF_SIZE,
  y: MAIN_FLOW_CENTER.y + NODE_HALF_SIZE,
};
const FLOW_NODE_CENTERS = new Map(
  FIXED_TREE_FLOW_NODES.map((node) => [
    node.id,
    {
      x: node.position.x + NODE_HALF_SIZE,
      y: node.position.y + NODE_HALF_SIZE,
    },
  ]),
);

export const FIXED_TREE_FLOW_EDGES = [
  ...SKILL_CATEGORIES.map((category) => ({
    id: `git-category-${category.id}`,
    source: 'git',
    target: `category-${category.id}`,
    groupEdge: false,
    category: category.id,
  })),
  ...SKILL_CATEGORIES.flatMap((category) => {
    const categorySkills = SKILL_TREE_NODES.filter((item) => item.category === category.id);
    const layerAnchors = [1, 2, 3, 4].map((layer) => {
      const layerNodes = categorySkills.filter((item) => item.layer === layer);
      return layerNodes[Math.floor(layerNodes.length / 2)];
    });
    const backboneEdges = layerAnchors.map((anchor, index) => ({
      id: index === 0
        ? `category-${category.id}-layer-1`
        : `${category.id}-layer-${index}-layer-${index + 1}`,
      source: index === 0 ? `category-${category.id}` : layerAnchors[index - 1].id,
      target: anchor.id,
      groupEdge: false,
      category: category.id,
    }));
    const circularGroupEdges = [1, 2, 3, 4].flatMap((layer) => {
      const layerNodes = categorySkills.filter((item) => item.layer === layer);
      return layerNodes.slice(0, -1).map((item, index) => ({
        id: `circle-${category.id}-layer-${layer}-${index}`,
        source: item.id,
        target: layerNodes[index + 1].id,
        type: 'circular',
        groupEdge: true,
        category: category.id,
        data: {
          center: FLOW_VISUAL_CENTER,
          sourcePoint: FLOW_NODE_CENTERS.get(item.id)!,
          targetPoint: FLOW_NODE_CENTERS.get(layerNodes[index + 1].id)!,
        },
      }));
    });
    return [...backboneEdges, ...circularGroupEdges];
  }),
];
