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

const CustomNode: React.FC<NodeProps> = ({ data }) => {
  const nodeData = data as unknown as SkillNodeData;
  const Icon = ICON_MAP[nodeData.iconName] || Code;

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
    nodeStyle = `border-2 bg-slate-900/90 shadow-[0_0_20px_rgba(16,185,129,0.25)] border-emerald-500`;
    dotColor = 'bg-emerald-400 ring-2 ring-emerald-950';
  } else if (nodeData.state === 'recommended') {
    // Recommended: Pulsing border glow
    nodeStyle = `border-2 bg-slate-900/90 border-amber-400 animate-pulse-glow`;
    dotColor = 'bg-amber-400 ring-2 ring-amber-950';
  } else {
    // Locked: Gray, high transparency, grayscale icon
    nodeStyle = `border-2 bg-slate-950/40 border-slate-800 opacity-40 grayscale`;
    dotColor = 'bg-slate-700';
  }

  return (
    <div className="relative flex flex-col items-center group">
      {/* Target handle for connections */}
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-slate-700 !border-slate-950" />
      
      {/* Circle Circle Node */}
      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 relative shadow-lg ${categoryColors.shadow} ${categoryColors.border} ${nodeStyle}`}>
        <div className={`${categoryColors.text} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-6 h-6" />
        </div>
        
        {/* State indicator dot */}
        <span className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${dotColor}`} />
      </div>

      {/* Label tag under the circle */}
      <div className="mt-2 text-center">
        <span className="text-[10px] font-black text-slate-200 tracking-wider whitespace-nowrap bg-slate-950/90 px-2 py-0.5 rounded border border-slate-900/80 shadow-md">
          {nodeData.label}
        </span>
      </div>

      {/* Tooltip info */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-56 p-3 rounded-xl bg-slate-950/95 border border-slate-800 shadow-2xl text-xs text-slate-300 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`w-2 h-2 rounded-full ${nodeData.state === 'acquired' ? 'bg-emerald-400' : nodeData.state === 'recommended' ? 'bg-amber-400' : 'bg-slate-700'}`} />
          <p className="font-bold text-white uppercase tracking-wider">{nodeData.label}</p>
        </div>
        <p className="leading-relaxed text-[11px] text-slate-400">{nodeData.description}</p>
        <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-slate-500 border-t border-slate-900 pt-1.5">
          <span>GENRE: {nodeData.category.toUpperCase()}</span>
          <span className={nodeData.state === 'acquired' ? 'text-emerald-400' : nodeData.state === 'recommended' ? 'text-amber-400' : 'text-slate-500'}>
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
