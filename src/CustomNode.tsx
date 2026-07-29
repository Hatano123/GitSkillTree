import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { 
  GitBranch, FileCode, Code, ShieldAlert, Atom, Layers, Palette, 
  Terminal, Server, Database, Box, Cloud, Workflow, Binary, Cpu, Sparkles, Link 
} from 'lucide-react';
import type { SkillNodeData } from './types';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  GitBranch, FileCode, Code, ShieldAlert, Atom, Layers, Palette, 
  Terminal, Server, Database, Box, Cloud, Workflow, Binary, Cpu, Sparkles, Link
};

const UNLOCK_TIPS: Record<string, string> = {
  git: 'このツリーの起点です。すでに有効になっています。',
  html_css: '公開リポジトリを作成し、HTMLかCSSファイルを含めてコミットしてください。',
  javascript: 'JavaScriptのコード（.jsファイル）をリポジトリに追加してコミットしてください。',
  typescript: 'リポジトリに TypeScript構成（tsconfig.json等）または .ts/.tsx ファイルを追加してください。',
  react: 'package.jsonの依存関係に "react" を追加してコミットしてください。',
  nextjs: 'package.jsonの依存関係に "next" を追加してコミットしてください。',
  tailwind: 'package.jsonの依存関係に "tailwindcss" を追加してCSS構成を記述してください。',
  nodejs: 'サーバーサイドJSコードを含め、Nodeの起動スクリプトを作成してください。',
  express: 'package.jsonの依存関係に "express" を追加してAPIサーバーを作成してください。',
  postgresql: 'リポジトリにSQL定義、またはデータベース接続ライブラリ（pg, prisma等）を追加してください。',
  docker: 'リポジトリのルートに "Dockerfile" を作成してコミットしてください。',
  aws: 'リポジトリ内に ".yaml" のCloudFormation、あるいはAWS CDK構成を追加してください。',
  github_actions: 'リポジトリに ".github/workflows" ディレクトリを追加し、YAMLパイプラインを作成してください。',
  python: 'Pythonファイル（.py）を含むリポジトリを公開コミットしてください。',
  pytorch: 'requirements.txtに "torch" を追加するか、PyTorchを使用した機械学習コードを作成してください。',
  openai: 'OpenAI APIキーを呼び出すコード、または依存ライブラリを追加してください。',
  langchain: 'requirements.txtに "langchain" または "langchain-core" を追加してください。'
};

const CustomNode: React.FC<NodeProps> = ({ id, data }) => {
  const nodeData = data as unknown as SkillNodeData;
  const Icon = ICON_MAP[nodeData.iconName] || Code;
  const isCategory = nodeData.kind === 'category';
  const isLocked = nodeData.state === 'locked';

  // Genre/Category Specific Colors
  const categoryColors = {
    frontend: {
      text: 'text-pink-400',
      bg: 'bg-pink-500/10',
      border: 'border-pink-500/30 hover:border-pink-400/60',
      shadow: 'shadow-pink-500/10'
    },
    backend: {
      text: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/30 hover:border-violet-400/60',
      shadow: 'shadow-violet-500/10'
    },
    infra: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30 hover:border-amber-400/60',
      shadow: 'shadow-amber-500/10'
    },
    network: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30 hover:border-emerald-400/60',
      shadow: 'shadow-emerald-500/10'
    },
    ai: {
      text: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30 hover:border-cyan-400/60',
      shadow: 'shadow-cyan-500/10'
    }
  }[nodeData.category] || { text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', shadow: 'shadow-slate-500/10' };

  // Status Styling
  let nodeStyle = '';
  let dotColor = '';

  if (nodeData.state === 'acquired') {
    // Acquired: Bright colored glowing border and filled glassmorphism
    nodeStyle = `border-2 bg-slate-900/90 shadow-[0_0_20px_rgba(16,185,129,0.25)]`;
    dotColor = 'bg-emerald-400 ring-2 ring-emerald-950';
  } else if (nodeData.state === 'unlocked') {
    // Unlocked: Gold/green intense sparkle animation
    nodeStyle = `border-2 bg-slate-900/90 animate-unlock-sparkle`;
    dotColor = 'bg-amber-400 ring-2 ring-amber-950 animate-ping';
  } else if (nodeData.state === 'recommended') {
    // Recommended: Pulsing border glow
    nodeStyle = `border-2 bg-slate-900/90 ring-2 ring-amber-400/80 animate-pulse-glow`;
    dotColor = 'bg-amber-400 ring-2 ring-amber-950';
  } else {
    // Locked: keep the disc opaque so background edges never show through it.
    nodeStyle = `border-2 bg-[#0b0f19] border-slate-800 grayscale`;
    dotColor = 'bg-slate-700';
  }

  return (
    <div className={`relative flex flex-col items-center group ${isLocked ? 'opacity-70 hover:opacity-100' : ''}`}>
      {/* Target handle for connections */}
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-slate-700 !border-slate-950" />
      
      {/* Circle Circle Node */}
      <div className={`${isCategory ? 'w-24 h-24 border-[3px]' : isLocked ? 'w-16 h-16' : 'w-18 h-18'} rounded-full flex items-center justify-center transition-all duration-300 relative shadow-lg ${categoryColors.bg} ${categoryColors.shadow} ${categoryColors.border} ${nodeStyle}`}>
        <div className={`${categoryColors.text} ${nodeData.state === 'locked' ? 'opacity-35' : ''} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className={isCategory ? 'w-10 h-10' : isLocked ? 'w-6 h-6' : 'w-7 h-7'} />
        </div>

        {isCategory && (
          <span className={`absolute inset-2 rounded-full border ${categoryColors.border} opacity-60`} />
        )}
        
        {/* State indicator dot */}
        <span className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${dotColor}`} />
        
        {/* Sparkle star for unlocked state */}
        {nodeData.state === 'unlocked' && (
          <span className="absolute -bottom-1 -right-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] font-black text-slate-950 shadow-md animate-bounce">
            NEW!
          </span>
        )}
      </div>

      {/* Label tag under the circle */}
      <div className={`mt-2 text-center transition-opacity ${isLocked ? 'opacity-40 group-hover:opacity-100' : ''}`}>
        {isCategory && (
          <span className={`mb-1.5 block text-[11px] font-black uppercase tracking-[0.22em] ${categoryColors.text}`}>
            Category
          </span>
        )}
        <span className={`${isCategory ? 'text-xl px-4 py-1.5' : 'text-base px-3 py-1'} font-black text-slate-100 tracking-wide whitespace-nowrap bg-slate-950/95 rounded-md border border-slate-800 shadow-lg`}>
          {nodeData.label}
        </span>
      </div>

      {/* Tooltip info */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-80 p-4 rounded-xl bg-slate-950/95 border border-slate-800 shadow-2xl text-sm text-slate-300 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-[9999]">
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            nodeData.state === 'acquired' ? 'bg-emerald-400' : 
            nodeData.state === 'unlocked' ? 'bg-amber-400 animate-ping' : 
            nodeData.state === 'recommended' ? 'bg-amber-400' : 'bg-slate-700'
          }`} />
          <p className="text-base font-bold text-white uppercase tracking-wider">{nodeData.label}</p>
        </div>
        
        <p className="mb-3 text-sm leading-relaxed text-slate-300">{nodeData.description}</p>
        
        {/* Custom unlock instructions if locked or recommended */}
        {nodeData.state !== 'acquired' && nodeData.state !== 'unlocked' && (
          <div className="mb-3 rounded-lg border border-slate-800/60 bg-slate-900/80 p-3">
            <p className="mb-1 text-sm font-bold text-amber-400">🔓 解放条件（次の一手）</p>
            <p className="text-sm leading-relaxed text-slate-300">{UNLOCK_TIPS[id] || '公開リポジトリでこの技術を使用してください。'}</p>
          </div>
        )}

        {nodeData.state === 'unlocked' && (
          <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
            🎉 前回のスキャンから新しく習得（解放）されました！
          </div>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-slate-900 pt-2 text-xs font-mono text-slate-500">
          <span>GENRE: {nodeData.category.toUpperCase()}</span>
          <span className={
            nodeData.state === 'acquired' ? 'text-emerald-400 font-bold' : 
            nodeData.state === 'unlocked' ? 'text-amber-400 font-black animate-pulse' : 
            nodeData.state === 'recommended' ? 'text-amber-400 font-semibold' : 'text-slate-500'
          }>
            {nodeData.state.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Source handle for connections */}
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-slate-700 !border-slate-950" />
    </div>
  );
};

export default memo(CustomNode);
