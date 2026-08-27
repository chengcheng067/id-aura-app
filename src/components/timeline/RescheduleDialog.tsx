import { useEffect, useState } from 'react';

import { AlertTriangle, X } from 'lucide-react';

import type { PendingReschedule } from './TimelineView';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useMembersStore } from '../../store/useMembersStore';
import { createProjectActions } from '../../store/useProjectsStore';
import { useRepos } from '../../hooks/useRepos';

/**
 * 延期原因弹窗（PRD 硬规则 1）：
 *   delta > 0（截止日后移）→ 原因必填，空则保存按钮 disabled；
 *   delta ≤ 0（提前/平移）→ 原因选填。
 * 确认后经 StageService.reschedule 落库 + 留痕。
 */
export function RescheduleDialog({
  pending,
  onClose,
}: {
  pending: PendingReschedule;
  onClose(): void;
}): JSX.Element {
  const repos = useRepos();
  const currentMemberId = useSettingsStore((s) => s.currentMemberId);
  const members = useMembersStore((s) => s.members);
  const operatorName =
    members.find((m) => m.id === currentMemberId)?.name ?? '设计师本人';

  const postponed =
    new Date(pending.newEndAt).getTime() > new Date(pending.oldEndAt).getTime();

  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 推进时原因为空 → 保存按钮 disabled（弹回逻辑）
  const canSave = !postponed || reason.trim().length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (): Promise<void> => {
    if (!canSave) return;
    setSubmitting(true);
    const actions = createProjectActions(repos);
    const ok = await actions.rescheduleStage(pending.stageId, {
      newStartAt: `${pending.newStartAt}T00:00:00Z`,
      newEndAt: `${pending.newEndAt}T23:59:59Z`,
      reason: reason.trim() || null,
      operatorName,
    });
    setSubmitting(false);
    if (ok) onClose();
    else setError('保存被拒绝：请填写延期原因后重试。');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-6 backdrop-blur-[6px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-strong iridescent-border dialog-pop w-full max-w-md rounded-2xl p-5 shadow-soft">
        <div className="mb-3 flex items-start justify-between">
          <h3 className="flex items-center gap-2 font-display text-display-md">
            {postponed && <AlertTriangle size={18} className="text-clay" />}
            改期确认 · {pending.stageName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="取消改期"
            className="rounded-md p-1 text-mist hover:bg-sand"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <span className="text-mist">开始</span>
          <span className="tabular-nums">
            {pending.oldStartAt} → <b>{pending.newStartAt}</b>
          </span>
          <span className="text-mist">截止</span>
          <span className="tabular-nums">
            {pending.oldEndAt} →{' '}
            <b className={postponed ? 'text-clay' : 'text-pine-deep'}>{pending.newEndAt}</b>
          </span>
        </div>

        {postponed ? (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                延期原因 <span className="text-clay">*（截止日后移必填）</span>
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="如：业主确认图纸延迟 / 消防验收排队…"
                className="w-full resize-y rounded-md border border-sand p-2 text-sm leading-6 outline-none focus:border-pine"
                autoFocus
              />
            </label>
            {!canSave && (
              <p className="mt-1 text-xs text-clay">未填写延期原因前无法保存（历史将完整留痕）。</p>
            )}
          </>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">备注原因（提前/平移可留空）</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-sand px-2 py-1.5 text-sm outline-none focus:border-pine"
            />
          </label>
        )}

        {error && <p className="mt-2 text-xs leading-5 text-clay">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-sand px-3 py-1.5 text-sm text-mist hover:bg-sand"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canSave || submitting}
            onClick={() => void submit()}
            className="rounded-md bg-pine px-4 py-1.5 text-sm text-white hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            保存并留痕
          </button>
        </div>
      </div>
    </div>
  );
}
