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
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { 
  GitBranch, Sparkles, Terminal, ArrowRight, 
  Compass, ChevronLeft, Info, Award, AlertCircle
} from 'lucide-react';

import CustomNode from './CustomNode';
import { ARCHETYPES, INITIAL_NODES, INITIAL_EDGES, MOCK_REPOS } from './mockData';
import { saveScan } from './firebase';
import { fetchUserMetadata } from './github';
import { analyzeRepoWithGemini } from './gemini';
import type { AnalysisResult } from './gemini';

const GithubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const nodeTypes = {
  custom: CustomNode,
};

const LOADING_STEPS = [
  'Connecting to GitHub API...',
  'Retrieving user public repositories catalog...',
  'Analyzing repository list and descriptions...',
  'Aggregating global language density metrics...',
  'Inspecting package dependencies in top projects...',
  'Calling Gemini 2.5 Flash to compute coding archetype...',
  'Plotting skill node weights on the master layout...'
];

export default function App() {
  const [screen, setScreen] = useState<'input' | 'loading' | 'result'>('input');
  const [githubUsername, setGithubUsername] = useState('');
  const [archetypeKey, setArchetypeKey] = useState('frontend');
  const [loadingStep, setLoadingStep] = useState(0);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);

  // AI & API States
  const [customAnalysisResult, setCustomAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isUsingAi, setIsUsingAi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Mock template select helper
  const handleSelectTemplate = (username: string, type: string) => {
    setGithubUsername(username);
    setArchetypeKey(type);
    setIsUsingAi(false); // default mock for quick template clicking
    setErrorMessage(null);
    setAvatarUrl('');
  };

  // Start analysis
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = githubUsername.trim();
    if (!username) return;

    setScreen('loading');
    setLoadingStep(0);
    setErrorMessage(null);
    setCustomAnalysisResult(null);

    // If it's one of the mock templates and they didn't toggle custom, do mock simulation.
    const isMockUser = MOCK_REPOS.some(r => r.username === username);

    if (isMockUser && !isUsingAi) {
      // Mock simulation mode
      setIsUsingAi(false);
      return;
    }

    // Real GitHub + Gemini API mode
    setIsUsingAi(true);
    try {
      // Fetch user profile + repos metadata from GitHub
      const metadata = await fetchUserMetadata(username);
      setAvatarUrl(metadata.avatarUrl);
      
      // Analyze using Gemini (Model: gemini-2.5-flash)
      const geminiResult = await analyzeRepoWithGemini(metadata);
      setCustomAnalysisResult(geminiResult);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '解析中にエラーが発生しました。');
      setScreen('input');
    }
  };

  // Loading logs ticker simulation
  useEffect(() => {
    if (screen !== 'loading') return;

    const timer = setInterval(() => {
      setLoadingStep((prev) => {
        const isLastStep = prev >= LOADING_STEPS.length - 1;
        
        if (isLastStep) {
          if (isUsingAi && !customAnalysisResult) {
            // Wait for AI response to arrive
            return prev;
          }
          
          clearInterval(timer);
          // Transition to result screen
          setTimeout(() => {
            setScreen('result');
            
            // Save final results to Firebase
            const activeArchetypeKey = customAnalysisResult ? customAnalysisResult.archetypeKey : archetypeKey;
            const activeScores = customAnalysisResult ? customAnalysisResult.scores : ARCHETYPES[archetypeKey].scores;
            const activeName = ARCHETYPES[activeArchetypeKey]?.name || 'Unknown Developer';

            saveScan({
              url: `https://github.com/${githubUsername}`,
              timestamp: new Date().toLocaleString('ja-JP'),
              archetypeName: activeName,
              scores: activeScores
            }).then((docId) => {
              setSavedScanId(docId);
            });
          }, 600);
          return prev;
        }
        return prev + 1;
      });
    }, 450);

    return () => clearInterval(timer);
  }, [screen, githubUsername, archetypeKey, isUsingAi, customAnalysisResult]);

  // Sync React Flow nodes & edges whenever archetype, customAnalysisResult or screen updates
  useEffect(() => {
    if (screen !== 'result') return;

    let acquiredIds: string[] = [];
    let recommendedIds: string[] = [];

    if (customAnalysisResult) {
      acquiredIds = customAnalysisResult.acquiredNodeIds;
      recommendedIds = customAnalysisResult.recommendedNodeIds;
    } else {
      const currentArchetype = ARCHETYPES[archetypeKey] || ARCHETYPES.frontend;
      acquiredIds = currentArchetype.acquiredNodeIds;
      recommendedIds = currentArchetype.recommendedNodeIds;
    }

    // Build flow nodes with current state
    const flowNodes = INITIAL_NODES.map((node) => {
      let state: 'acquired' | 'recommended' | 'locked' = 'locked';
      if (acquiredIds.includes(node.id)) {
        state = 'acquired';
      } else if (recommendedIds.includes(node.id)) {
        state = 'recommended';
      }

      return {
        id: node.id,
        type: 'custom',
        position: node.position,
        data: {
          ...node.data,
          state,
        },
      };
    });

    // Build flow edges
    const flowEdges = INITIAL_EDGES.map((edge) => {
      const isSourceAcquired = acquiredIds.includes(edge.source);
      const isTargetAcquired = acquiredIds.includes(edge.target);
      const isTargetRecommended = recommendedIds.includes(edge.target);

      // Color edges based on connections
      let strokeColor = '#334155'; // default locked edge (gray)
      let animated = false;

      if (isSourceAcquired && isTargetAcquired) {
        strokeColor = '#10b981'; // acquired edge (green)
        animated = true;
      } else if (isSourceAcquired && isTargetRecommended) {
        strokeColor = '#fbbf24'; // recommendation pathway (yellow)
        animated = true;
      }

      return {
        ...edge,
        animated: edge.animated || animated,
        style: { stroke: strokeColor, strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [screen, archetypeKey, customAnalysisResult, setNodes, setEdges]);

  // Current archetype details (derived from AI analysis or mock selector)
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
            <p className="text-[10px] text-cyan-400 font-semibold tracking-widest uppercase">Developer Growth Tracker</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
          {screen === 'result' && savedScanId && (
            <span className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-emerald-400 flex items-center gap-1.5 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Firebase Synced ID: {savedScanId.slice(0, 8)}...
            </span>
          )}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <GithubIcon />
            GitHub
          </a>
        </div>
      </header>

      {/* Screen 1: Input Screen */}
      {screen === 'input' && (
        <main className="flex-1 flex flex-col items-center justify-center px-4 max-w-4xl mx-auto w-full relative z-10 py-12">
          
          {/* Hero Headline */}
          <div className="text-center mb-8 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-4">
              <Sparkles className="w-3 h-3 animate-pulse" /> Gemini 2.5 Flash Profile Analyzer
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
              自分のコードで<br className="sm:hidden" />
              <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent">
                ツリーを埋めろ！
              </span>
            </h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              GitHubユーザー名を入力するだけで、全公開レポジトリの使用言語・依存関係をスキャン。<br />
              あなたのエンジニア適性を多角形チャートにマッピングし、円形スキルツリーで次のおすすめを提示します。
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
                      // Auto-enable AI mode if it's not a pre-defined mock user
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
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  テスト用デモプロフィール (ユーザー選択)
                </span>
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

          {/* Quick Info */}
          <div className="mt-8 flex items-start gap-3 text-xs text-slate-500 max-w-lg bg-slate-950/20 border border-slate-900/40 p-4 rounded-xl">
            <Info className="w-5 h-5 text-cyan-500/70 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>全公開レポジトリ解析モード</strong>：GitHubユーザー全体の言語構成を一度にスキャンするため、単一のレポジトリを解析するよりも多角的にあなたのスキル特性を判別できます。
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
            ユーザープロファイルを解析中...
          </h3>
          
          <div className="w-full bg-slate-950 border border-slate-900 rounded-xl p-4 font-mono text-xs text-slate-400 h-32 overflow-hidden shadow-inner flex flex-col justify-end">
            <div className="space-y-1.5">
              {LOADING_STEPS.slice(0, loadingStep + 1).map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 text-cyan-400/90">
                  <span className="text-slate-600">{`>`}</span>
                  <span className={idx === loadingStep ? 'text-white font-bold animate-pulse' : ''}>{step}</span>
                </div>
              ))}
              {isUsingAi && loadingStep === LOADING_STEPS.length - 1 && !customAnalysisResult && (
                <div className="flex items-start gap-2 text-indigo-400 animate-pulse">
                  <span className="text-slate-600">{`>`}</span>
                  <span>Gemini 2.5 Flash is thinking...</span>
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
          <section className="w-full lg:w-96 border-r border-slate-900 bg-slate-950/40 backdrop-blur-xl p-6 flex flex-col justify-between shrink-0 overflow-y-auto max-h-[calc(100vh-73px)]">
            
            <div className="space-y-6">
              
              {/* Back & User profile header */}
              <div>
                <button
                  onClick={() => setScreen('input')}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-4"
                >
                  <ChevronLeft className="w-4 h-4" />
                  他のユーザーを解析
                </button>
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
                    {customAnalysisResult ? 'AI Scanned' : 'Mock'}
                  </span>
                </div>
              </div>

              {/* Archetype Description */}
              <div className={`p-4 rounded-xl border transition-all duration-300 ${archetype.themeColor}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 shrink-0" />
                  <h3 className="font-bold text-sm tracking-wide text-white">エンジニア適性タイプ</h3>
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
                    適性グラフ
                  </h3>
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: archetype.accentColor }} />
                    Skill Multiplier
                  </div>
                </div>

                <div className="h-56 bg-slate-950/60 border border-slate-900 rounded-xl flex items-center justify-center p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={archetype.scores}>
                      <PolarGrid stroke="#1e293b" />
                      <PolarAngleAxis 
                        dataKey="subject" 
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} />
                      <Radar
                        name="Developer Factor"
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
              </div>

              {/* AI Findings or Next Stack Recommendations */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  {customAnalysisResult ? 'AIによる解析所見' : '次のおすすめ技術スタック'}
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

            {/* Switch Archetype (Demo purposes) */}
            <div className="mt-8 pt-4 border-t border-slate-900">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                別の適性タイプに切り替え (シミュレーション)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.keys(ARCHETYPES).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCustomAnalysisResult(null); // clear AI result to allow mock exploration
                      setArchetypeKey(key);
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
                      archetypeKey === key && !customAnalysisResult
                        ? 'bg-slate-800 border-slate-700 text-white font-bold'
                        : 'bg-slate-900/30 border-slate-950 text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'
                    }`}
                  >
                    {key.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

          </section>

          {/* Right panel: React Flow Canvas */}
          <section className="flex-1 min-h-[400px] lg:min-h-0 relative bg-[#0b0f19]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              connectionLineType={ConnectionLineType.SmoothStep}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.2}
              maxZoom={2}
            >
              <Background color="#1e293b" gap={20} size={1} />
              <Controls position="top-right" className="!bg-slate-950 !border-slate-800 !text-slate-300 shadow-2xl [&_button]:!bg-slate-900 [&_button]:!border-slate-800 [&_button]:!text-slate-300 [&_button:hover]:!bg-slate-800" />
            </ReactFlow>

            {/* Tree Map Legend */}
            <div className="absolute bottom-4 left-4 right-4 lg:right-auto bg-slate-950/90 border border-slate-900 backdrop-blur-md p-3.5 rounded-xl shadow-2xl text-xs space-y-2.5 z-30 max-w-md">
              <h4 className="font-bold text-white text-[11px] tracking-wide uppercase">ツリー状態の凡例</h4>
              <div className="flex flex-wrap items-center gap-4 text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span>取得済み (ユーザー全体のコードから検出)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-400 animate-pulse" />
                  <span>おすすめ (次の一手・点滅)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-slate-700" />
                  <span>未開放 (ロック中)</span>
                </div>
              </div>
            </div>
          </section>

        </main>
      )}
    </div>
  );
}
