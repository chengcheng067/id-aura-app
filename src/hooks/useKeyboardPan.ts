import { useEffect } from 'react';

import { panRange, type TimelineRange } from '../lib/date';

/**
 * 时间轴键盘平移：←/→ 平移一个视窗跨度的 1/6；Shift 加速 ×3。
 * 输入焦点在 input/textarea/select 或 contentEditable 内时不拦截。
 */
export function useKeyboardPan(
  enabled: boolean,
  range: TimelineRange,
  onChange: (next: TimelineRange) => void,
): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const total = Math.max(
        1,
        Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000),
      );
      const step = Math.max(1, Math.floor(total / 6)) * (e.shiftKey ? 3 : 1);
      const delta = e.key === 'ArrowLeft' ? -step : step;
      e.preventDefault();
      onChange(panRange(range, delta));
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, range, onChange]);
}
