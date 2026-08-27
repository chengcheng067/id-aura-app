import { useCallback, useRef, useState } from 'react';

/**
 * 拖拽改期手势状态机（Pointer Events + setPointerCapture，无 dnd 库）。
 * 返回 {deltaDays, handlePointerDown, live} 供 StageBar 渲染实时形变；
 * pointerup 时经 onCommit 把「净 delta」交还上层唤出 RescheduleDialog（闸门在弹窗层）。
 */

export type DragEdge = 'start' | 'end';

export interface DragStartCtx {
  stageId: string;
  edge: DragEdge;
  /** 手势起点对应的像素 x */
  startX: number;
  /** pxPerDay 由 TimelineView 注入（x 坐标公式统一复用 lib/date） */
  pxPerDay: number;
}

export interface UseDragRescheduleResult {
  draggingStageId: string | null;
  edge: DragEdge | null;
  /** 净移动天数（含符号；向右为正） */
  deltaDays: number;
  isDragging(stageId: string): boolean;
  onHandleDown(e: React.PointerEvent, stageId: string, edge: DragEdge, pxPerDay: number): void;
  /** StageBar 在窗口层绑定 pointermove/up（capture 后事件仍路由到起始元素，这里挂 window 兜底） */
  attachWindowListeners(onCommit: (stageId: string, edge: DragEdge, delta: number) => void): void;
}

export function useDragReschedule(): UseDragRescheduleResult {
  const ctxRef = useRef<DragStartCtx | null>(null);
  const [dragging, setDragging] = useState<{ stageId: string; edge: DragEdge } | null>(null);
  const [deltaDays, setDeltaDays] = useState(0);

  const onHandleDown = useCallback(
    (e: React.PointerEvent, stageId: string, edge: DragEdge, pxPerDay: number) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      ctxRef.current = { stageId, edge, startX: e.clientX, pxPerDay };
      setDragging({ stageId, edge });
      setDeltaDays(0);
    },
    [],
  );

  const attachWindowListeners = useCallback(
    (onCommit: (stageId: string, edge: DragEdge, delta: number) => void) => {
      const move = (ev: PointerEvent): void => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        const rawDelta = (ev.clientX - ctx.startX) / ctx.pxPerDay;
        // daily snap：四舍五入到整天
        const snapped = Math.round(rawDelta);
        // 起点缘不允许把开始日拖到截止日之后：delta 下限使 newStart<=newEnd（保守 clamp 到 -3650）
        setDeltaDays(Math.max(Math.min(snapped, 3650), -3650));
      };
      const up = (): void => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        setDragging(null);
        setDeltaDays((d) => {
          onCommit(ctx.stageId, ctx.edge, d);
          return 0;
        });
        ctxRef.current = null;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
      window.addEventListener('pointercancel', up, { once: true });
    },
    [],
  );

  return {
    draggingStageId: dragging?.stageId ?? null,
    edge: dragging?.edge ?? null,
    deltaDays,
    isDragging: (stageId) => dragging?.stageId === stageId,
    onHandleDown,
    attachWindowListeners,
  };
}
