import { useEffect, useRef } from 'react';

import { X } from 'lucide-react';

/**
 * 手写轻对话框：Escape / 遮罩点击关闭、简单焦点管理（打开聚焦面板）。
 * 零第三方依赖，样式贴合《长夏》审美。
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-6 backdrop-blur-[6px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass-strong iridescent-border dialog-pop w-full max-w-md rounded-2xl p-5 shadow-soft outline-none"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="font-display text-display-md">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="关闭"
            className="rounded-md p-1 text-mist hover:bg-sand"
          >
            <X size={16} />
          </button>
        </div>
        <div className="text-sm leading-6 text-ink/80">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-sand px-3 py-1.5 text-sm text-mist transition-colors hover:bg-sand"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 text-sm text-white transition-colors ${
              danger ? 'bg-clay hover:bg-clay-deep' : 'bg-pine hover:bg-pine-deep'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
