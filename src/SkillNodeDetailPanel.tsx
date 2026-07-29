import { CheckCircle2, Lightbulb, LockKeyhole, Search, Sparkles, X } from 'lucide-react';
import { FIXED_TREE_FLOW_NODES } from './skillTree';
import { getSkillNodeDetail } from './skillNodeDetails';
import type { SkillNodeData, SkillNodeStatus } from './types';
import type { DetectionEvidence } from './evidenceDetectionRules';

type SkillNodeDetailPanelProps = {
  nodeId: string;
  nodeData: SkillNodeData;
  evidence: DetectionEvidence[];
  onClose: () => void;
};

const STATUS_STYLE: Record<SkillNodeStatus, {
  label: string;
  className: string;
  icon: typeof LockKeyhole;
}> = {
  locked: {
    label: 'LOCKED',
    className: 'border-slate-700 bg-slate-800/70 text-slate-300',
    icon: LockKeyhole,
  },
  unlocked: {
    label: 'UNLOCKED',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    icon: CheckCircle2,
  },
  new: {
    label: 'NEW',
    className: 'border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.16)]',
    icon: Sparkles,
  },
};

function normalizeStatus(nodeData: SkillNodeData): SkillNodeStatus {
  if (nodeData.state === 'unlocked') return 'new';
  if (nodeData.state === 'acquired') return 'unlocked';
  return 'locked';
}

export default function SkillNodeDetailPanel({
  nodeId,
  nodeData,
  evidence,
  onClose,
}: SkillNodeDetailPanelProps) {
  const detail = getSkillNodeDetail(nodeId);
  const status = normalizeStatus(nodeData);
  const statusStyle = STATUS_STYLE[status];
  const StatusIcon = statusStyle.icon;
  const relatedNodes = detail?.relatedNodeIds.flatMap((relatedNodeId) => {
    const node = FIXED_TREE_FLOW_NODES.find((candidate) => candidate.id === relatedNodeId);
    return node ? [{ id: node.id, label: node.data.label }] : [];
  }) ?? [];

  return (
    <div className="absolute inset-0 z-[10000] pointer-events-none">
      <button
        type="button"
        aria-label="詳細パネルを閉じる"
        className="absolute inset-0 pointer-events-auto bg-slate-950/10"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-detail-title"
        className="skill-detail-panel pointer-events-auto absolute bottom-0 left-0 right-0 max-h-[78%] overflow-y-auto rounded-t-3xl border-t border-slate-800 bg-[#0b0f19]/96 shadow-[0_-16px_48px_rgba(0,0,0,0.42)] lg:bottom-0 lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:max-h-none lg:w-[420px] lg:rounded-none lg:rounded-l-3xl lg:border-l lg:border-t-0 lg:shadow-[-18px_0_48px_rgba(0,0,0,0.38)]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-[#0b0f19]/95 px-5 py-4 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Skill Node Detail
            </p>
            <h2 id="skill-detail-title" className="truncate text-2xl font-black text-white">
              {nodeData.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              開放状態
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black tracking-wider ${statusStyle.className}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusStyle.label}
            </span>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-slate-300">
              技術について
            </h3>
            <p className="text-sm leading-6 text-slate-400">
              {detail?.description ?? nodeData.description}
            </p>
          </section>

          {detail ? (
            <>
              {evidence.length > 0 && (
                <section>
                  <h3 className="mb-4 flex items-center gap-2.5 text-base font-black uppercase tracking-wider text-slate-300">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    今回の検出証拠
                  </h3>
                  <ul className="space-y-3">
                    {evidence.map((item) => (
                      <li
                        key={`${item.repository}:${item.path}:${item.reason}`}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3.5"
                      >
                        <p className="text-base font-bold text-emerald-200">{item.reason}</p>
                        <p className="mt-1 break-all font-mono text-sm leading-6 text-slate-400">
                          {item.repository} / {item.path}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="mb-4 flex items-center gap-2.5 text-base font-black uppercase tracking-wider text-slate-300">
                  <Search className="h-5 w-5 text-cyan-400" />
                  GitHubでの検出条件
                </h3>
                <ul className="space-y-3">
                  {detail.detectionConditions.map((condition) => (
                    <li key={condition} className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3.5 text-base leading-7 text-slate-300">
                      {condition}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-4 flex items-center gap-2.5 text-base font-black uppercase tracking-wider text-slate-300">
                  <Lightbulb className="h-5 w-5 text-amber-300" />
                  プロジェクト案
                </h3>
                <ol className="space-y-3">
                  {detail.projectIdeas.map((idea, index) => (
                    <li key={idea} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3.5 text-base text-slate-200">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/10 font-mono text-sm font-black text-amber-300">
                        {index + 1}
                      </span>
                      {idea}
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="mb-4 text-base font-black uppercase tracking-wider text-slate-300">
                  関連ノード
                </h3>
                <div className="flex flex-wrap gap-3">
                  {relatedNodes.map((node) => (
                    <span key={node.id} className="rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-2 text-base font-bold text-violet-200">
                      {node.label}
                    </span>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
              <p className="text-sm font-bold text-slate-300">詳細データは準備中です</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                このノードは現在、基本情報のみ表示しています。
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
