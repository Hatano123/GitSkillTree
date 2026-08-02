import { RefreshCw, ShieldCheck, Target, Zap } from 'lucide-react';
import type { GrowthSnapshot } from './types';

type GrowthSummaryCardProps = {
  growth?: GrowthSnapshot;
  questLabel?: string;
  onRescan: () => void;
};

export default function GrowthSummaryCard({ growth, questLabel, onRescan }: GrowthSummaryCardProps) {
  if (!growth) return null;
  const hasGain = growth.gainedExp > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-slate-950/70 to-indigo-500/10 shadow-[0_16px_45px_rgba(8,145,178,0.08)]">
      <div className="flex items-start justify-between gap-4 border-b border-cyan-500/15 px-4 py-3.5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">Node Growth</p>
          <div className="mt-1 flex items-end gap-2">
            <strong className="font-mono text-3xl font-black leading-none text-white">{growth.totalExp}</strong>
            <span className="pb-0.5 text-xs font-bold text-slate-400">TOTAL EXP</span>
          </div>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-right ${hasGain ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-slate-700 bg-slate-900/70'}`}>
          <p className={`font-mono text-sm font-black ${hasGain ? 'text-emerald-300' : 'text-slate-400'}`}>
            {hasGain ? `+${growth.gainedExp} EXP` : '±0 EXP'}
          </p>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Scan #{growth.scanCount}</p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Next Quest</p>
            <p className="mt-1 text-sm font-bold text-white">{questLabel ? `${questLabel} を使うリポジトリを増やす` : '新しい技術を使うリポジトリを増やす'}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">その技術を使う公開リポジトリが1件見つかるごとに、そのノードへ10 EXP入ります。</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] leading-4 text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
          同じ証拠で再スキャンしてもEXPは増えません。能力評価ではなく、確認できた活動の蓄積です。
        </div>

        <button
          type="button"
          onClick={onRescan}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2.5 text-xs font-black text-cyan-200 transition-all hover:border-cyan-300/50 hover:bg-cyan-400/20"
        >
          {hasGain ? <Zap className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          GitHubを更新したら再スキャン
        </button>
      </div>
    </section>
  );
}
