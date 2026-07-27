import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Atom, Binary, Box, Cloud, Code, Cpu, Database, FileCode, Layers,
  Link, Palette, Server, ShieldAlert, Sparkles, Terminal, Workflow,
} from 'lucide-react';
import type { SkillNodeData } from './types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Atom, Binary, Box, Cloud, Code, Cpu, Database, FileCode, Layers,
  Link, Palette, Server, ShieldAlert, Sparkles, Terminal, Workflow,
};

const CATEGORY_STYLE = {
  frontend: { text: 'text-pink-300', tint: 'bg-pink-500/10' },
  backend: { text: 'text-violet-300', tint: 'bg-violet-500/10' },
  infra: { text: 'text-amber-300', tint: 'bg-amber-500/10' },
  ai: { text: 'text-cyan-300', tint: 'bg-cyan-500/10' },
  network: { text: 'text-emerald-300', tint: 'bg-emerald-500/10' },
} as const;

const CustomNode = ({ data }: NodeProps) => {
  const nodeData = data as unknown as SkillNodeData;
  const Icon = ICON_MAP[nodeData.iconName] ?? Code;
  const category = CATEGORY_STYLE[nodeData.category];
  const statusClass = nodeData.status === 'new'
    ? 'border-amber-300 bg-slate-900 shadow-[0_0_24px_rgba(251,191,36,0.5)] animate-unlock-sparkle'
    : nodeData.status === 'unlocked'
      ? 'border-emerald-500/80 bg-slate-900 shadow-[0_0_14px_rgba(16,185,129,0.2)]'
      : nodeData.recommended
        ? 'border-amber-400/80 bg-slate-950/90 animate-pulse-glow'
        : 'border-slate-800 bg-slate-950/75 opacity-55';

  return (
    <div className="group relative w-[172px]">
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-slate-950 !bg-slate-600" />
      <div className={`relative min-h-[78px] rounded-xl border-2 px-3 py-2.5 transition-all ${statusClass}`}>
        <div className="flex items-start gap-2.5">
          <div className={`mt-0.5 rounded-lg p-2 ${category.tint} ${category.text}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Layer {nodeData.layer}</p>
            <p className="mt-0.5 truncate text-xs font-black text-slate-100">{nodeData.label}</p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
          <span className={
            nodeData.status === 'new' ? 'text-amber-300'
              : nodeData.status === 'unlocked' ? 'text-emerald-400'
                : 'text-slate-600'
          }>
            {nodeData.status}
          </span>
          {nodeData.status === 'new' && (
            <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[8px] font-black text-slate-950 animate-pulse">NEW</span>
          )}
          {nodeData.recommended && nodeData.status === 'locked' && (
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[8px] text-amber-300">NEXT</span>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-[11px] leading-relaxed text-slate-300 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100">
        <p className="mb-1 font-bold text-white">{nodeData.label}</p>
        <p>{nodeData.description}</p>
        <p className="mt-2 border-t border-slate-800 pt-2 text-[9px] uppercase tracking-wider text-slate-500">
          検出結果だけで開放・Layer前提なし
        </p>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-slate-950 !bg-slate-600" />
    </div>
  );
};

export default memo(CustomNode);
