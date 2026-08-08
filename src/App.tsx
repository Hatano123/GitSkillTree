import { useState, useEffect, useMemo } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer 
} from 'recharts';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  ConnectionLineType,
  MarkerType
} from '@xyflow/react';
import type { Node, Edge, ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { 
  GitBranch, Sparkles, Terminal, ArrowRight, 
  Compass, ChevronLeft, Info, Award, AlertCircle, Share2, TrendingUp, PanelLeftOpen, X
} from 'lucide-react';

import CustomNode from './CustomNode';
import CircularEdge from './CircularEdge';
import SkillNodeDetailPanel from './SkillNodeDetailPanel';
import GrowthSummaryCard from './GrowthSummaryCard';
import { ARCHETYPES, MOCK_REPOS } from './mockData';
import { FIXED_TREE_FLOW_NODES, FIXED_TREE_FLOW_EDGES } from './skillTree';
import { saveScan, getScanById, getLatestScanByUsername } from './firebase';
import { fetchUserMetadata } from './github';
import { detectAcquiredNodesWithDebug } from './detectNodes';
import { generateExplanationWithGemini } from './gemini';
import type { AnalysisResult } from './gemini';
import { EVALUATION_VERSION, evaluateNodes, fallbackExplanation } from './evaluation';
import { advanceNodeGrowth, GROWTH_VERSION, nodeExpProgressPercent } from './growth';
import type { DetectionDebugInfo, ScanRecord, SkillNodeData } from './types';

const GithubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const nodeTypes = {
  custom: CustomNode,
};
const edgeTypes = {
  circular: CircularEdge,
};

const SCAN_CACHE_DURATION_MS = 10 * 60 * 1000;
type AnalysisResultSource = 'fresh' | 'cache' | 'fallback' | null;

const DETECTION_EVIDENCE_LABELS = {
  always: '常時開放',
  language: '言語',
  dependency: '依存関係',
  file: '専用ファイル',
} as const;

const REPOSITORY_READ_STATUS_LABELS = {
  read: '取得済み',
  partial: '一部取得',
  failed: '取得失敗',
} as const;

function createDemoDetectionDebug(nodeIds: readonly string[]): DetectionDebugInfo {
  return {
    listedRepositoryCount: 1,
    detailedRepositories: [{ name: 'growth-demo', status: 'read' }],
    nodeEvidence: nodeIds.map((nodeId) => ({
      nodeId,
      matches: nodeId === 'git'
        ? [{ type: 'always', value: '常時開放' }]
        : [{ type: 'file', value: `demo/${nodeId}.evidence`, repository: 'growth-demo' }],
    })),
  };
}

function toAnalysisResult(scan: ScanRecord): AnalysisResult {
  const normalized = evaluateNodes(scan.acquiredNodeIds);
  const growth = scan.growth ?? (scan.detectionDebug ? advanceNodeGrowth({
    detectedNodeIds: scan.acquiredNodeIds,
    detectionDebug: scan.detectionDebug,
    previousGrowth: null,
    migrationBaseline: true,
  }) : undefined);
  return {
    archetypeKey: normalized.archetypeKey,
    scores: scan.evaluationVersion === EVALUATION_VERSION ? scan.scores.map((point) => ({ ...point, detectedCount: point.detectedCount ?? 0 })) : normalized.scores,
    detectedCounts: scan.evaluationVersion === EVALUATION_VERSION && scan.detectedCounts ? scan.detectedCounts : normalized.detectedCounts,
    evaluationVersion: EVALUATION_VERSION,
    dataStatus: scan.evaluationVersion === EVALUATION_VERSION && scan.dataStatus ? scan.dataStatus : normalized.dataStatus,
    acquiredNodeIds: scan.acquiredNodeIds,
    recommendedNodeIds: scan.recommendedNodeIds,
    unlockedNodeIds: scan.unlockedNodeIds,
    customLogs: scan.customLogs,
    detectionDebug: scan.detectionDebug,
    growth,
  };
}

function isScanCacheValid(scan: ScanRecord): boolean {
  const timestamp = new Date(scan.timestamp).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp >= 0 && Date.now() - timestamp < SCAN_CACHE_DURATION_MS;
}

const LOADING_STEP_LABELS = [
  'Firestore: 前回スキャン検索',
  'GitHub API: リポジトリ取得',
  'ノード検出 (クライアント)',
  'Gemini API: 説明文生成',
  '完了'
];

export default function App() {
  const [screen, setScreen] = useState<'input' | 'loading' | 'result'>('input');
  const [githubUsername, setGithubUsername] = useState('');
  const [archetypeKey, setArchetypeKey] = useState('frontend');
  const [loadingStep, setLoadingStep] = useState(0);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);
  const [timingLogs, setTimingLogs] = useState<{ label: string; ms: number }[]>([]);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Growth & Analysis States
  const [previousScan, setPreviousScan] = useState<ScanRecord | null>(null);
  const [customAnalysisResult, setCustomAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisResultSource, setAnalysisResultSource] = useState<AnalysisResultSource>(null);
  const [isUsingAi, setIsUsingAi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [isDemoGrowthActive, setIsDemoGrowthActive] = useState(false);
  const [isScoreBreakdownOpen, setIsScoreBreakdownOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  useEffect(() => {
    if (screen !== 'result' || !flowInstance) return;
    const gitNode = nodes.find((node) => node.id === 'git');
    if (!gitNode) return;

    const frame = window.requestAnimationFrame(() => {
      const width = gitNode.measured?.width ?? gitNode.width ?? 0;
      const height = gitNode.measured?.height ?? gitNode.height ?? 0;
      void flowInstance.setCenter(
        gitNode.position.x + width / 2,
        gitNode.position.y + height / 2,
        { zoom: 0.7, duration: 0 },
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [screen, nodes, flowInstance]);

  useEffect(() => {
    if (screen === 'result') {
      setIsSidebarOpen(window.matchMedia('(min-width: 1024px)').matches);
      setIsLegendOpen(false);
    } else {
      setSelectedNodeId(null);
      setIsSidebarOpen(true);
      setIsLegendOpen(false);
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== 'result') return;

    const desktopViewport = window.matchMedia('(min-width: 1024px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setIsSidebarOpen(false);
    };

    desktopViewport.addEventListener('change', handleViewportChange);
    return () => desktopViewport.removeEventListener('change', handleViewportChange);
  }, [screen]);

  // 1. URL ID Param check on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scanId = params.get('id');
    if (scanId) {
      setScreen('loading');
      setLoadingStep(0);
      
      getScanById(scanId).then((record) => {
        if (record) {
          setGithubUsername(record.username);
          setAvatarUrl(record.avatarUrl);
          setSavedScanId(record.id || scanId);
          setCustomAnalysisResult(toAnalysisResult(record));
          
          if (record.previousScanId) {
            getScanById(record.previousScanId).then((prev) => {
              if (prev) setPreviousScan(prev);
            });
          }

          setTimeout(() => {
            setIsSidebarOpen(window.matchMedia('(min-width: 1024px)').matches);
            setScreen('result');
          }, 800);
        } else {
          setErrorMessage('指定された共有IDのスキャンデータが見つかりませんでした。');
          setScreen('input');
        }
      }).catch((err) => {
        console.error(err);
        setErrorMessage('データの読み込み中にエラーが発生しました。');
        setScreen('input');
      });
    }
  }, []);

  // Mock template select helper
  const handleSelectTemplate = (username: string, type: string) => {
    setGithubUsername(username);
    setArchetypeKey(type);
    setIsUsingAi(false);
    setErrorMessage(null);
    setAvatarUrl('');
    setPreviousScan(null);
    setCustomAnalysisResult(null);
    setAnalysisResultSource(null);
  };

  // Start analysis
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = githubUsername.trim();
    if (!username) return;

    setScreen('loading');
    setLoadingStep(0);
    setDisplayProgress(0);
    setTimingLogs([]);
    setErrorMessage(null);
    setCustomAnalysisResult(null);
    setPreviousScan(null);
    setAnalysisResultSource(null);

    const mockTemplate = MOCK_REPOS.find(r => r.username === username);

    if (mockTemplate && !isUsingAi) {
      setIsUsingAi(false);
      const mockArchetype = ARCHETYPES[mockTemplate.type] || ARCHETYPES.frontend;

      // Template scans do not call external APIs, but must still complete the
      // loading flow so the result screen is reachable.
      setLoadingStep(4);
      window.setTimeout(() => {
        const detectionDebug = createDemoDetectionDebug(mockArchetype.acquiredNodeIds);
        const growth = advanceNodeGrowth({
          detectedNodeIds: mockArchetype.acquiredNodeIds,
          detectionDebug,
          previousGrowth: null,
        });
        const evaluation = evaluateNodes(Object.keys(growth.nodeProgress));
        setCustomAnalysisResult({
          ...evaluation,
          customLogs: mockArchetype.nextSteps,
          detectionDebug,
          growth,
        });
        setAnalysisResultSource('fresh');
      }, 400);
      return;
    }

    setIsUsingAi(true);
    let prevScanRecord: ScanRecord | null = null;
    try {
      // Step 0: Firestore lookup
      let t0 = performance.now();
      prevScanRecord = await getLatestScanByUsername(username);
      if (prevScanRecord) {
        setPreviousScan(prevScanRecord);
      }
      setTimingLogs(prev => [...prev, { label: LOADING_STEP_LABELS[0], ms: Math.round(performance.now() - t0) }]);

      if (prevScanRecord && isScanCacheValid(prevScanRecord)) {
        setAvatarUrl(prevScanRecord.avatarUrl);
        setSavedScanId(prevScanRecord.id || null);
        setPreviousScan(null);
        setCustomAnalysisResult(toAnalysisResult(prevScanRecord));
        setAnalysisResultSource('cache');
        setLoadingStep(4);
        return;
      }

      setLoadingStep(1);

      // Step 1: GitHub API
      t0 = performance.now();
      const metadata = await fetchUserMetadata(username, prevScanRecord?.timestamp);
      setAvatarUrl(metadata.avatarUrl);
      setTimingLogs(prev => [...prev, { label: LOADING_STEP_LABELS[1], ms: Math.round(performance.now() - t0) }]);
      setLoadingStep(2);

      // Step 2: Deterministic node detection (instant)
      t0 = performance.now();
      const detection = detectAcquiredNodesWithDebug(metadata);
      const detectedNodes = detection.nodeIds;
      setTimingLogs(prev => [...prev, { label: LOADING_STEP_LABELS[2], ms: Math.round(performance.now() - t0) }]);
      setLoadingStep(3);

      // Step 3: evaluate deterministically, then ask Gemini for wording only.
      t0 = performance.now();
      // A changed detector/evaluation version starts a new baseline instead of
      // presenting migration differences as newly acquired skills.
      const comparablePreviousScan = prevScanRecord?.evaluationVersion === EVALUATION_VERSION
        ? prevScanRecord
        : null;
      const previousGrowth = prevScanRecord?.growth?.version === GROWTH_VERSION
        ? prevScanRecord.growth
        : null;
      const growth = advanceNodeGrowth({
        detectedNodeIds: detectedNodes,
        detectionDebug: detection.debug,
        previousGrowth,
        migrationBaseline: Boolean(prevScanRecord && !previousGrowth),
      });
      const evaluation = {
        ...evaluateNodes(Object.keys(growth.nodeProgress), comparablePreviousScan),
        unlockedNodeIds: prevScanRecord ? growth.newNodeIds : [],
      };
      let customLogs = fallbackExplanation(metadata.username, evaluation.unlockedNodeIds);
      try {
        customLogs = await generateExplanationWithGemini(metadata, evaluation);
      } catch (geminiError) {
        console.warn('Gemini explanation failed; showing deterministic evaluation.', geminiError);
      }
      if (metadata.scanWarnings.length > 0) {
        customLogs = [...metadata.scanWarnings, ...customLogs].slice(0, 3);
      }
      setTimingLogs(prev => [...prev, { label: LOADING_STEP_LABELS[3], ms: Math.round(performance.now() - t0) }]);
      setLoadingStep(4);

      setCustomAnalysisResult({ ...evaluation, customLogs, detectionDebug: detection.debug, growth });
      setAnalysisResultSource('fresh');
    } catch (err: any) {
      console.error(err);
      if (prevScanRecord) {
        setAvatarUrl(prevScanRecord.avatarUrl);
        setSavedScanId(prevScanRecord.id || null);
        setPreviousScan(null);
        setCustomAnalysisResult(toAnalysisResult(prevScanRecord));
        setAnalysisResultSource('fallback');
        setLoadingStep(4);
        return;
      }
      setErrorMessage(err.message || '解析中にエラーが発生しました。');
      setScreen('input');
    }
  };

  // Trigger simulated delta growth demo
  const handleSimulateGrowth = () => {
    setIsDemoGrowthActive(true);
    setAnalysisResultSource(null);
    setScreen('loading');
    setLoadingStep(0);
    setErrorMessage(null);

    setTimeout(() => {
      const baselineNodeIds = ['git', 'javascript', 'typescript', 'react', 'nodejs', 'express', 'postgresql'];
      const currentNodeIds = [...baselineNodeIds, 'nextjs', 'docker'];
      const baselineDebug = createDemoDetectionDebug(baselineNodeIds);
      const currentDebug = createDemoDetectionDebug(currentNodeIds);
      const baselineGrowth = advanceNodeGrowth({ detectedNodeIds: baselineNodeIds, detectionDebug: baselineDebug, previousGrowth: null });
      const currentGrowth = advanceNodeGrowth({ detectedNodeIds: currentNodeIds, detectionDebug: currentDebug, previousGrowth: baselineGrowth });
      const baselineEvaluation = evaluateNodes(baselineNodeIds);
      const currentEvaluation = {
        ...evaluateNodes(currentNodeIds, { acquiredNodeIds: baselineNodeIds }),
        unlockedNodeIds: currentGrowth.newNodeIds,
      };
      // Baseline Scan setup
      const baselineScan: ScanRecord = {
        id: 'baseline-demo-id',
        username: 'chibicode',
        avatarUrl: 'https://avatars.githubusercontent.com/u/74620?v=4',
        timestamp: '2026/07/07 10:00:00',
        ...baselineEvaluation,
        detectionDebug: baselineDebug,
        growth: baselineGrowth,
        previousScanId: null,
        customLogs: []
      };

      setPreviousScan(baselineScan);
      setGithubUsername('chibicode');
      setAvatarUrl('https://avatars.githubusercontent.com/u/74620?v=4');

      // Updated Growth Scan setup
      setCustomAnalysisResult({
        ...currentEvaluation,
        detectionDebug: currentDebug,
        growth: currentGrowth,
        customLogs: [
          '🎉 前回のスキャンから新たに Next.js が導入されました！フロントエンド技術が一段と強化されています。',
          '🐳 Dockerfileのコミットを検知！インフラノード Docker が新しく解放されました。',
          'コミット差分により、新たに2つの技術スタックがアンロックされました！素晴らしい成長です！'
        ]
      });

      setIsSidebarOpen(window.matchMedia('(min-width: 1024px)').matches);
      setScreen('result');
      setIsDemoGrowthActive(false);

      saveScan({
        username: 'chibicode',
        avatarUrl: 'https://avatars.githubusercontent.com/u/74620?v=4',
        timestamp: new Date().toLocaleString('ja-JP'),
        ...currentEvaluation,
        detectionDebug: currentDebug,
        growth: currentGrowth,
        previousScanId: 'baseline-demo-id',
        customLogs: [
          '🎉 前回のスキャンから新たに Next.js が導入されました！フロントエンド技術が一段と強化されています。',
          '🐳 Dockerfileのコミットを検知！インフラノード Docker が新しく解放されました。',
          'コミット差分により、新たに2つの技術スタックがアンロックされました！素晴らしい成長です！'
        ]
      }).then((docId) => {
        setSavedScanId(docId);
      });

    }, 3100);
  };

  // Smooth progress bar animation
  useEffect(() => {
    if (screen !== 'loading') return;

    // Target percentages for each step to make it feel smooth
    const TARGETS = [15, 50, 60, 95, 100];
    
    const timer = setInterval(() => {
      setDisplayProgress(prev => {
        const target = TARGETS[Math.min(loadingStep, TARGETS.length - 1)];
        // Ease towards target
        const diff = target - prev;
        if (diff <= 0.1) return target;
        return prev + diff * 0.15; // 15% closer every 50ms
      });
    }, 50);

    return () => clearInterval(timer);
  }, [screen, loadingStep]);

  // Transition to result screen when analysis completes
  useEffect(() => {
    if (screen !== 'loading' || !customAnalysisResult) return;

    const transitionTimer = setTimeout(() => {
      setIsSidebarOpen(window.matchMedia('(min-width: 1024px)').matches);
      setScreen('result');

      const params = new URLSearchParams(window.location.search);
      if (params.get('id') || isDemoGrowthActive) return;
      if (analysisResultSource !== 'fresh') return;

      const activeArchetypeKey = customAnalysisResult.archetypeKey;
      const activeScores = customAnalysisResult.scores;
      const acquiredNodeIds = customAnalysisResult.acquiredNodeIds;
      const recommendedNodeIds = customAnalysisResult.recommendedNodeIds;
      const unlockedNodeIds = customAnalysisResult.unlockedNodeIds;
      const customLogs = customAnalysisResult.customLogs;

      const scanRecord: Omit<ScanRecord, 'id'> = {
        username: githubUsername,
        avatarUrl: avatarUrl,
        timestamp: new Date().toISOString(),
        archetypeKey: activeArchetypeKey,
        scores: activeScores,
        detectedCounts: customAnalysisResult.detectedCounts,
        evaluationVersion: customAnalysisResult.evaluationVersion,
        dataStatus: customAnalysisResult.dataStatus,
        growth: customAnalysisResult.growth,
        acquiredNodeIds,
        recommendedNodeIds,
        unlockedNodeIds,
        previousScanId: previousScan ? (previousScan.id || null) : null,
        customLogs
      };
      if (customAnalysisResult.detectionDebug) {
        scanRecord.detectionDebug = customAnalysisResult.detectionDebug;
      }

      saveScan(scanRecord).then((docId) => {
        setSavedScanId(docId);
      });
    }, 800);

    return () => clearTimeout(transitionTimer);
  }, [screen, customAnalysisResult, githubUsername, avatarUrl, previousScan, isDemoGrowthActive, analysisResultSource]);

  // Sync React Flow nodes & edges
  useEffect(() => {
    if (screen !== 'result') return;

    let acquiredIds: string[] = [];
    let recommendedIds: string[] = [];
    let unlockedIds: string[] = [];

    if (customAnalysisResult) {
      acquiredIds = customAnalysisResult.acquiredNodeIds;
      recommendedIds = customAnalysisResult.recommendedNodeIds;
      unlockedIds = customAnalysisResult.unlockedNodeIds || [];
    } else {
      const currentArchetype = ARCHETYPES[archetypeKey] || ARCHETYPES.frontend;
      acquiredIds = currentArchetype.acquiredNodeIds;
      recommendedIds = currentArchetype.recommendedNodeIds;
    }

    const skillNodes = FIXED_TREE_FLOW_NODES.map((node) => {
      let state: 'acquired' | 'recommended' | 'locked' | 'unlocked' = 'locked';

      const detectionNodeIds = node.data.detectionNodeIds ?? [node.id];
      const nodeProgress = node.data.kind === 'category'
        ? undefined
        : detectionNodeIds
          .map((id) => customAnalysisResult?.growth?.nodeProgress[id])
          .find(Boolean);
      if (detectionNodeIds.some((id) => unlockedIds.includes(id))) {
        state = 'unlocked';
      } else if (detectionNodeIds.some((id) => acquiredIds.includes(id))) {
        state = 'acquired';
      } else if (detectionNodeIds.some((id) => recommendedIds.includes(id))) {
        state = 'recommended';
      }

      return {
        id: node.id,
        type: 'custom',
        zIndex: 10,
        position: node.position,
        data: {
          ...node.data,
          state,
          exp: nodeProgress?.exp,
          level: nodeProgress?.level,
          expProgress: nodeProgress ? nodeExpProgressPercent(nodeProgress) : undefined,
          gainedExp: nodeProgress?.lastGainedExp,
        },
      };
    });

    const flowNodes: Node[] = skillNodes;
    const nodeState = new Map(skillNodes.map((node) => [node.id, node.data.state]));
    const categoryEdgeColors = {
      frontend: '#9d174d',
      backend: '#6d28d9',
      infra: '#b45309',
      ai: '#0e7490',
      network: '#047857',
    };
    const flowEdges = FIXED_TREE_FLOW_EDGES.map((edge) => {
      const isSourceAcquired = nodeState.get(edge.source) === 'acquired' || nodeState.get(edge.source) === 'unlocked';
      const isTargetRecommended = nodeState.get(edge.target) === 'recommended';

      let strokeColor = edge.groupEdge ? categoryEdgeColors[edge.category] : '#475569';
      let animated = false;
      let strokeDasharray: string | undefined;

      if (nodeState.get(edge.target) === 'unlocked') {
        strokeColor = '#10b981';
        animated = true;
        strokeDasharray = '6 7';
      } else if (isSourceAcquired && isTargetRecommended) {
        strokeColor = '#fbbf24';
        animated = true;
        strokeDasharray = '4 7';
      }

      return {
        ...edge,
        animated,
        zIndex: -10,
        style: {
          stroke: strokeColor,
          strokeWidth: edge.groupEdge ? 1.25 : 2,
          strokeDasharray,
          opacity: edge.groupEdge ? 0.55 : 0.8,
        },
        markerEnd: edge.groupEdge ? undefined : {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [screen, archetypeKey, customAnalysisResult, setNodes, setEdges]);

  // Current archetype details
  const archetype = useMemo(() => {
    if (customAnalysisResult) {
      const key = customAnalysisResult.archetypeKey;
      const base = ARCHETYPES[key] || ARCHETYPES.frontend;
      return {
        name: base.name,
        description: base.description,
        themeColor: base.themeColor,
        accentColor: base.accentColor,
        scores: customAnalysisResult.scores,
        nextSteps: customAnalysisResult.customLogs
      };
    }
    return ARCHETYPES[archetypeKey] || ARCHETYPES.frontend;
  }, [archetypeKey, customAnalysisResult]);

  // Radar Data
  const canComparePrevious = previousScan?.evaluationVersion === EVALUATION_VERSION;
  const radarData = useMemo(() => {
    return archetype.scores.map((s) => {
      const previousPoint = canComparePrevious ? previousScan?.scores?.find(ps => ps.subject === s.subject) : undefined;
      return {
        subject: s.subject,
        A: s.A,
        B: previousPoint?.A,
        detectedCount: s.detectedCount ?? 0,
        previousDetectedCount: previousPoint?.detectedCount ?? previousScan?.detectedCounts?.[s.subject === 'ネットワーク' ? 'network' : s.subject === 'インフラ' ? 'infra' : s.subject === 'バックエンド' ? 'backend' : s.subject === 'フロントエンド' ? 'frontend' : 'ai'],
        fullMark: 100,
      };
    });
  }, [archetype, canComparePrevious, previousScan]);

  const dataStatusLabel = customAnalysisResult?.dataStatus === 'available'
    ? '傾向を表示'
    : customAnalysisResult?.dataStatus === 'limited'
      ? '限定的な傾向'
      : 'データ不足';
  const growthQuestLabel = useMemo(() => {
    const recommendedNodeId = customAnalysisResult?.recommendedNodeIds[0];
    if (!recommendedNodeId) return undefined;
    return FIXED_TREE_FLOW_NODES.find((node) =>
      node.data.kind === 'skill' && node.data.detectionNodeIds?.includes(recommendedNodeId),
    )?.data.label;
  }, [customAnalysisResult]);

  const handleCopyLink = () => {
    const idToShare = savedScanId;
    if (!idToShare) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${idToShare}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setIsShareCopied(true);
      setTimeout(() => setIsShareCopied(false), 2000);
    });
  };

  const handleBackToInput = () => {
    window.history.pushState({}, document.title, window.location.pathname);
    setSavedScanId(null);
    setPreviousScan(null);
    setCustomAnalysisResult(null);
    setAnalysisResultSource(null);
    setScreen('input');
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Background radial effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,24,48,0.3),transparent_70%)] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-lg shadow-indigo-500/20">
            <GitBranch className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              GitSkillTree
            </h1>
            <p className="text-[10px] text-cyan-400 font-semibold tracking-widest uppercase">Growth Tracker</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
          {screen === 'result' && savedScanId && (
            <button
              onClick={handleCopyLink}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-full text-slate-300 flex items-center gap-1.5 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              {isShareCopied ? 'コピー完了!' : '共有リンクをコピー'}
            </button>
          )}
          {screen === 'result' && savedScanId && (
            <span className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-emerald-400 hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Synced ID: {savedScanId.slice(0, 8)}...
            </span>
          )}
        </div>
      </header>

      {/* Screen 1: Input Screen */}
      {screen === 'input' && (
        <main className="flex-1 flex flex-col items-center justify-center px-4 max-w-4xl mx-auto w-full relative z-10 py-12">
          
          {/* Hero Headline */}
          <div className="text-center mb-8 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-4">
              <Sparkles className="w-3 h-3 animate-pulse" /> 昨日の自分を超えろ。成長特化型エンジニアリングトラッカー
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
              コミットが切り拓く、<br />
              <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent">
                君だけのスキルツリー
              </span>
            </h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              初回スキャンでノードごとのEXPを記録。開発した後に再スキャンすると、<br />
              <strong>技術を確認できたリポジトリ数</strong>がEXPになり、スキルツリーが育ちます。
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="w-full max-w-2xl mb-6 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3 text-xs animate-shake">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="font-bold">解析エラー</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Form Card */}
          <div className="w-full bg-slate-950/40 border border-slate-900 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-2xl relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl" />
            
            <form onSubmit={handleAnalyze} className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    GitHub Username
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isUsingAi}
                      onChange={(e) => setIsUsingAi(e.target.checked)}
                      className="w-3.5 h-3.5 bg-slate-900 border border-slate-800 text-cyan-500 rounded focus:ring-cyan-500/50"
                    />
                    <span>Gemini AIでリアルタイムに解析する</span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Enter GitHub Username (e.g., gaearon)"
                    value={githubUsername}
                    onChange={(e) => {
                      setGithubUsername(e.target.value);
                      const isMockUser = MOCK_REPOS.some(r => r.username === e.target.value);
                      if (!isMockUser && e.target.value.trim() !== '') {
                        setIsUsingAi(true);
                      }
                    }}
                    className="w-full bg-slate-900/90 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 rounded-xl py-3.5 pl-4 pr-12 text-sm text-slate-200 outline-none transition-all placeholder:text-slate-600"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-2 p-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-lg transition-all"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mock template selections */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    テスト用デモプロフィール (ユーザー選択)
                  </span>
                  
                  <button
                    type="button"
                    onClick={handleSimulateGrowth}
                    className="text-[10px] font-black text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/40 border border-cyan-550/20 px-2.5 py-1 rounded-lg transition-all"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    成長比較デモを即時開始
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MOCK_REPOS.map((repo) => (
                    <button
                      key={repo.username}
                      type="button"
                      onClick={() => handleSelectTemplate(repo.username, repo.type)}
                      className={`text-left p-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                        githubUsername === repo.username && !isUsingAi
                          ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-200 shadow-md shadow-cyan-950/20'
                          : 'bg-slate-900/50 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      <span className="truncate pr-2">{repo.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 font-mono tracking-wide text-cyan-500 uppercase">
                        {repo.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>

          <div className="mt-8 flex items-start gap-3 text-xs text-slate-500 max-w-lg bg-slate-950/20 border border-slate-900/40 p-4 rounded-xl">
            <Info className="w-5 h-5 text-cyan-500/70 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>「成長比較デモを即時開始」</strong>ボタンを押すと、初回スキャン（ベースライン）と2回目スキャン（Next.jsとDockerを新習得）をシミュレーションした差分成長画面（キラキラ演出・二重レーダー）が即座に体験できます。
            </p>
          </div>
        </main>
      )}

      {/* Screen 2: Loading Screen */}
      {screen === 'loading' && (
        <main className="flex-1 flex flex-col items-center justify-center py-12 px-6 max-w-md mx-auto w-full z-10">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl animate-pulse" />
            <div className="w-16 h-16 rounded-full border-4 border-slate-900 border-t-cyan-500 animate-spin" />
            <Terminal className="w-6 h-6 text-cyan-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>

          <h3 className="text-lg font-bold text-white mb-2 tracking-wide">
            差分データをスキャン中...
          </h3>

          {/* Percentage display */}
          <div className="w-full mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-slate-500 font-mono">Progress</span>
              <span className="text-sm font-bold text-cyan-400 font-mono">
                {Math.round(displayProgress)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-none"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          </div>
          
          <div className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 font-mono text-xs text-slate-400 overflow-hidden shadow-inner">
            <div className="space-y-1.5">
              {/* Completed steps with timing */}
              {timingLogs.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <span>✓</span>
                    <span>{log.label}</span>
                  </div>
                  <span className={`font-bold shrink-0 ${log.ms > 2000 ? 'text-amber-400' : log.ms > 500 ? 'text-cyan-400' : 'text-emerald-400'}`}>
                    {log.ms >= 1000 ? `${(log.ms / 1000).toFixed(1)}s` : `${log.ms}ms`}
                  </span>
                </div>
              ))}
              {/* Current step (in progress) */}
              {loadingStep < LOADING_STEP_LABELS.length - 1 && (
                <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
                  <span>⟳</span>
                  <span>{LOADING_STEP_LABELS[loadingStep]} ...</span>
                </div>
              )}
              {/* Total time */}
              {timingLogs.length === 4 && (
                <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-1.5 mt-1.5">
                  <span className="text-white font-bold">合計</span>
                  <span className="text-white font-bold">
                    {(timingLogs.reduce((sum, l) => sum + l.ms, 0) / 1000).toFixed(2)}s
                  </span>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* Screen 3: Result Screen */}
      {screen === 'result' && (
        <main className="flex-1 flex flex-col lg:flex-row relative z-10 min-h-[calc(100vh-73px)]">
          
          {/* Left panel: Aptitude Radar Chart */}
          <section className={`result-sidebar-readable w-full lg:flex lg:w-80 border-r border-slate-900 bg-slate-950/40 backdrop-blur-xl p-4 lg:p-5 flex-col justify-between shrink-0 overflow-y-auto max-h-[calc(100vh-73px)] ${isSidebarOpen ? 'flex' : 'hidden'}`}>
            
            <div className="space-y-6">
              
              {/* Back & User profile header */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={handleBackToInput}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    他のユーザーを解析
                  </button>
                  
                  {/* Simulate Growth Demo Button when viewing baseline result */}
                  {!previousScan && (
                    <button
                      onClick={handleSimulateGrowth}
                      className="text-[10px] font-black bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      成長差分を試す(再スキャン)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="lg:hidden flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-slate-200 transition-colors hover:bg-slate-800"
                    aria-label="Close sidebar"
                  >
                    <X className="h-4 w-4" />
                    Close
                  </button>
                </div>
                
                <div className="bg-slate-900/60 border border-slate-900 px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-9 h-9 rounded-full border border-slate-800 shrink-0" alt="GitHub Avatar" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-800 shrink-0 flex items-center justify-center text-slate-400">
                      <GithubIcon />
                    </div>
                  )}
                  <div className="truncate flex-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">User Profile</p>
                    <span className="text-slate-200 truncate font-mono font-bold">@{githubUsername}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase font-mono font-semibold">
                    {customAnalysisResult ? (previousScan ? 'Growth Delta' : 'Baseline') : 'Mock'}
                  </span>
                </div>
                {analysisResultSource && analysisResultSource !== 'fresh' && (
                  <div className={`mt-3 px-3 py-2.5 rounded-xl border flex items-start gap-2 text-xs ${
                    analysisResultSource === 'cache'
                      ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-100'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-100'
                  }`}>
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      {analysisResultSource === 'cache'
                        ? '10分以内の前回スキャンを表示中です。GitHub API と Gemini API は呼び出していません。'
                        : 'API の呼び出しに失敗したため、前回スキャンの結果を表示しています。'}
                    </p>
                  </div>
                )}
              </div>

              {/* Archetype Description */}
              <GrowthSummaryCard
                growth={customAnalysisResult?.growth}
                questLabel={growthQuestLabel}
                onRescan={handleBackToInput}
              />

              {/* Archetype Description */}
              <div className={`p-4 rounded-xl border transition-all duration-300 ${archetype.themeColor}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 shrink-0" />
                  <h3 className="font-bold text-sm tracking-wide text-white">技術傾向プロファイル</h3>
                </div>
                <h4 className="text-base font-extrabold mb-2 text-white">
                  {archetype.name}
                </h4>
                <p className="text-xs leading-relaxed text-slate-300">
                  {archetype.description}
                </p>
              </div>

              {/* Radar Chart */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {canComparePrevious ? '使用技術の分布 (前回比較)' : '使用技術の分布'}
                  </h3>
                  <div className="text-[10px] font-mono flex items-center gap-2">
                    {canComparePrevious && (
                      <span className="text-slate-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        前回
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: archetype.accentColor }} />
                      今回
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsScoreBreakdownOpen((open) => !open)}
                      aria-expanded={isScoreBreakdownOpen}
                      className="ml-1 inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                    >
                      <Info className="w-3 h-3" />
                      検出の根拠
                    </button>
                  </div>
                </div>

                <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                  <span className="mr-2 rounded bg-cyan-500/10 px-2 py-0.5 font-semibold text-cyan-300">{dataStatusLabel}</span>
                  GitHub上で確認できた使用技術を分野別に集計し、最も多い分野を基準に相対表示しています。能力や習熟度を評価するものではありません。
                  {previousScan && !canComparePrevious && (
                    <span className="mt-2 block text-amber-300">前回は異なる集計方式のため、直接比較していません。</span>
                  )}
                </div>

                <div className="h-56 bg-slate-950/60 border border-slate-900 rounded-xl flex items-center justify-center p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#1e293b" />
                      <PolarAngleAxis 
                        dataKey="subject" 
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} />
                      
                      {canComparePrevious && (
                        <Radar
                          name="Previous"
                          dataKey="B"
                          stroke="#475569"
                          fill="#475569"
                          fillOpacity={0.05}
                          strokeDasharray="4 4"
                          animationDuration={500}
                        />
                      )}
                      
                      <Radar
                        name="Current"
                        dataKey="A"
                        stroke={archetype.accentColor}
                        fill={archetype.accentColor}
                        fillOpacity={0.15}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {isScoreBreakdownOpen && (
                  <div className="mt-3 space-y-2 rounded-xl border border-cyan-500/20 bg-slate-950/80 p-3 text-xs">
                    <p className="text-slate-300 leading-relaxed">
                      各分野の検出技術数を集計し、最多分野を100として相対表示します。生成AIは検出・分類・計算に関与しません。
                    </p>
                    {customAnalysisResult?.detectionDebug ? (
                      <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                        <div>
                          <div className="flex items-center justify-between gap-3 font-semibold text-slate-100">
                            <span>詳細を確認したリポジトリ</span>
                            <span className="shrink-0 font-mono text-cyan-300">
                              一覧 {customAnalysisResult.detectionDebug.listedRepositoryCount}件 / 詳細 {customAnalysisResult.detectionDebug.detailedRepositories.length}件
                            </span>
                          </div>
                          {customAnalysisResult.detectionDebug.detailedRepositories.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {customAnalysisResult.detectionDebug.detailedRepositories.map((repository) => (
                                <span key={repository.name} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300">
                                  {repository.name}
                                  <span className="ml-1 text-[10px] text-slate-500">{REPOSITORY_READ_STATUS_LABELS[repository.status]}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-slate-500">詳細確認できたリポジトリはありません。</p>
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-slate-100">見つかったノードと検出根拠</p>
                          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                            {customAnalysisResult.detectionDebug.nodeEvidence.map((nodeEvidence) => {
                              const flowNode = FIXED_TREE_FLOW_NODES.find((node) =>
                                node.data.kind !== 'category' && node.data.detectionNodeIds?.includes(nodeEvidence.nodeId),
                              );
                              const nodeLabel = typeof flowNode?.data?.label === 'string' ? flowNode.data.label : nodeEvidence.nodeId;
                              return (
                                <div key={nodeEvidence.nodeId} className="rounded-md border border-slate-800 bg-slate-950/80 p-2">
                                  <p className="font-semibold text-cyan-200">{nodeLabel}</p>
                                  <ul className="mt-1 space-y-1 text-slate-400">
                                    {nodeEvidence.matches.map((match, index) => (
                                      <li key={`${match.type}-${match.value}-${match.repository ?? ''}-${index}`}>
                                        {match.repository && <span className="text-slate-300">{match.repository} · </span>}
                                        {DETECTION_EVIDENCE_LABELS[match.type]}: {match.value}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-slate-500">
                        このスキャンにはリポジトリ別の検出根拠が保存されていません。
                      </p>
                    )}
                    {radarData.map((category) => (
                      <div key={category.subject} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                        <div className="flex items-center justify-between font-semibold text-slate-100">
                          <span>{category.subject}</span>
                          <span className="font-mono text-cyan-300">検出 {category.detectedCount}件・相対値 {category.A}</span>
                        </div>
                        {canComparePrevious && <p className="mt-1 text-[10px] text-slate-500">前回の検出技術数: {category.previousDetectedCount ?? 0}件</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Findings or Next Stack Recommendations */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  {customAnalysisResult ? (previousScan ? '📈 成長フィードバック' : '📊 スキャン解析所見') : '次のおすすめ技術スタック'}
                </h3>
                <ul className="space-y-2">
                  {archetype.nextSteps.map((step, idx) => (
                    <li 
                      key={idx}
                      className="text-xs bg-slate-900/40 hover:bg-slate-900 border border-slate-900/60 hover:border-slate-800 p-2.5 rounded-xl flex items-start gap-2.5 text-slate-300 transition-colors"
                    >
                      <span className="w-4 h-4 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

          </section>

          {/* Right panel: React Flow Canvas */}
          <section className="relative h-[calc(100dvh-73px)] min-h-[400px] w-full flex-1 overflow-hidden bg-[#0b0f19]">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="absolute left-3 top-3 z-40 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs font-bold text-slate-200 shadow-lg backdrop-blur transition-colors hover:bg-slate-800 lg:hidden"
                aria-label="サイドパネルを開く"
              >
                <PanelLeftOpen className="h-4 w-4" />
                情報
              </button>
            )}
            <div className="absolute inset-0">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                nodesDraggable={false}
                onInit={setFlowInstance}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                connectionLineType={ConnectionLineType.SmoothStep}
                minZoom={0.2}
                maxZoom={2}
              >
                <Background color="#1e293b" gap={20} size={1} />
                <Controls position="top-right" className="!bg-slate-950 !border-slate-800 !text-slate-300 shadow-2xl [&_button]:!bg-slate-900 [&_button]:!border-slate-800 [&_button]:!text-slate-300 [&_button:hover]:!bg-slate-800" />
              </ReactFlow>
            </div>

            {selectedNode && (
              <SkillNodeDetailPanel
                nodeId={selectedNode.id}
                nodeData={selectedNode.data as unknown as SkillNodeData}
                evidence={(
                  (selectedNode.data as unknown as SkillNodeData).detectionNodeIds ?? [selectedNode.id]
                ).flatMap((detectionNodeId) =>
                  customAnalysisResult?.detectionDebug?.nodeEvidence.find(
                    (nodeEvidence) => nodeEvidence.nodeId === detectionNodeId,
                  )?.matches ?? []
                )}
                onClose={() => setSelectedNodeId(null)}
              />
            )}

            {/* Tree Map Legend */}
            {!isLegendOpen && (
              <button
                type="button"
                onClick={() => setIsLegendOpen(true)}
                className="absolute bottom-3 left-3 z-30 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 text-xs font-bold text-slate-300 shadow-xl backdrop-blur-md lg:hidden"
              >
                Legend
              </button>
            )}
            <div className={`${isLegendOpen ? 'block' : 'hidden lg:block'} absolute bottom-3 left-3 right-3 lg:bottom-4 lg:left-4 lg:right-auto bg-slate-950/90 border border-slate-900 backdrop-blur-md p-2.5 rounded-lg shadow-2xl text-xs space-y-2 z-30 max-w-xl`}>
              <button
                type="button"
                onClick={() => setIsLegendOpen(false)}
                className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
                aria-label="Close legend"
              >
                <X className="h-4 w-4" />
              </button>
              <h4 className="text-sm font-bold uppercase tracking-wide text-white">スキルマップの凡例</h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span>取得済み</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-400 animate-unlock-sparkle" />
                  <span>✨ 今回新しく解放 (点滅)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-400 animate-pulse" />
                  <span>おすすめ (次の一手)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-slate-700" />
                  <span>未開放 (ロック中)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-cyan-400 text-[6px] font-black text-cyan-200">2</span>
                  <span>外周リング：ノードEXP / LV</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="block h-px w-8 bg-slate-500" />
                  <span>実線：技術の関連</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="block w-8 border-t-2 border-dashed border-emerald-400" />
                  <span>緑の点線：今回伸びた枝</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="block w-8 border-t-2 border-dashed border-amber-400" />
                  <span>黄色の点線：次の一手</span>
                </div>
              </div>
            </div>
          </section>

        </main>
      )}
    </div>
  );
}
