import { useEffect } from 'react';

import { useProjectsStore } from '../../store/useProjectsStore';
import { cn } from '../../lib/cn';

/**
 * 瞬时操作反馈 Toast 容器（PRD 交互规则 2）：
 * 全部写操作成功只弹瞬时 toast（≤2s 自动消失，由 store.pushToast 驱动），
 * 绝不出现全屏 loading 圈。AppShell 已内联同款实现——本组件供独立挂载场景复用。
 */
export function ToastHost(): JSX.Element {
  const toasts = useProjectsStore((s) => s.toasts);
  const dismiss = useProjectsStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => window.setTimeout(() => dismiss(t.id), 2000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            'toast-enter pointer-events-auto rounded-md px-4 py-2 text-sm shadow-soft',
            t.kind === 'success'
              ? 'bg-pine text-cream'
              : t.kind === 'error'
                ? 'bg-clay text-white'
                : 'bg-ink text-cream',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
