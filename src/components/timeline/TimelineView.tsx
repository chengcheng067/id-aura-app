import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildHalfMonthTicks,
  buildMonthTicks,
  dateAtX,
  panRange,
  rangeDays,
  xOf,
  type TimelineRange,
} from '../../lib/date';
import type { Stage, Project, Member } from '../../core/types/entities';
import { pickActiveStageId } from '../../lib/progress';
import { useUiStore, type TimelineZoom } from '../../store/useUiStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useKeyboardPan } from '../../hooks/useKeyboardPan';
import { useDragReschedule } from '../../hooks/useDragReschedule';
import { MonthScaleHeader } from './MonthScaleHeader';
import { RestDayBands } from './RestDayBands';
import { StageRowsColumn } from './StageRowsColumn';
import { StageBar } from './StageBar';
import { TodayLine } from './TodayLine';
import { RescheduleDialog } from './RescheduleDialog';
import { ROW_BG_ACTIVE, ROW_BG_EVEN, ROW_BG_ODD } from './timelineColors';

/** 行几何常量（像素） */
const ROW_H = 44;
const ROW_GAP = 8;
const LEFT_COL_W = 260;
const HEADER_H = 36;

const ZOOM_PPD: Record<TimelineZoom, number> = {
  month: 14, // 月粒度：14px/天
  'half-month': 30, // 双周粒度：30px/天
};

export interface PendingReschedule {
  stageId: string;
  stageName: string;
  oldStartAt: string;
  oldEndAt: string;
  newStartAt: string;
  newEndAt: string;
}

/** 批量改期（磁吸联动）：items 按 orderIndex 升序，primaryIndex 指向被拖动的阶段 */
export interface BatchReschedule {
  items: PendingReschedule[];
  primaryIndex: number;
}

/**
 * 时间轴主视图容器：zoom 档位、坐标系、今日线、左锁定列、拖拽改期编排。
 * x=date 映射复用 lib/date.xOf / dateAtX（架构 T10 铁则）。
 * v0.2：memberView=true 时（成员视角）：
 *   - stages 已由 ProjectDetailPage 过滤为「与自己相关」的阶段（本组件透传）；
 *   - 拖拽改期禁用（阶段改期是管理员操作，权限矩阵 #11 语义延伸）；
 *   - 左列负责人显示角色标签（StageRowsColumn）。
 */
export function TimelineView({
  project,
  stages,
  members = [],
  memberView = false,
}: {
  project: Project;
  stages: Stage[];
  members?: Member[];
  memberView?: boolean;
}): JSX.Element {
  const zoom = useUiStore((s) => s.timelineZoom);
  const setZoom = useUiStore((s) => s.setTimelineZoom);
  const openDrawer = useUiStore((s) => s.openStageDrawer);
  const restPolicy = useSettingsStore((s) => s.restPolicy);

  const pxPerDay = ZOOM_PPD[zoom];

  // 可视窗口：以所有阶段的实际起止为边界，外扩 7 天；确保磁吸联动延后也能完整显示。
  const baseRange = useMemo<TimelineRange>(() => {
    const startSources = stages.length > 0 ? stages.map((s) => s.startAt.slice(0, 10)) : [project.plannedStartAt.slice(0, 10)];
    const endSources = stages.length > 0 ? stages.map((s) => s.endAt.slice(0, 10)) : [project.plannedEndAt.slice(0, 10)];
    const minStart = startSources.reduce((a, b) => (a < b ? a : b));
    const maxEnd = endSources.reduce((a, b) => (a > b ? a : b));
    const from = new Date(`${minStart}T00:00:00Z`);
    const to = new Date(`${maxEnd}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 7);
    to.setUTCDate(to.getUTCDate() + 7);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [project.plannedStartAt, project.plannedEndAt, stages]);

  const [range, setRange] = useState<TimelineRange>(baseRange);

  // stages 变化（如磁吸联动延后）导致 baseRange 扩展时，自动扩展可视窗口
  useEffect(() => {
    setRange(baseRange);
  }, [baseRange]);

  const days = rangeDays(range);
  const chartW = days * pxPerDay;

  useKeyboardPan(true, range, setRange);

  /* ------------------------------ 拖拽改期编排（含磁吸联动） ------------------------------ */
  const drag = useDragReschedule();
  const [batchPending, setBatchPending] = useState<BatchReschedule | null>(null);

  // StageBar 手柄 pointerdown 后挂窗级监听；up 时进入弹窗闸门（不直接落库）
  const beginEdgeDrag = useCallback(
    (
      e: React.PointerEvent,
      stage: Stage,
      edge: 'start' | 'end',
    ): void => {
      drag.onHandleDown(e, stage.id, edge, pxPerDay);
      drag.attachWindowListeners((stageId, dragEdge, delta) => {
        if (delta === 0) return; // 无位移视作点击 → 由 click 处理抽屉
        const target = stages.find((s) => s.id === stageId);
        if (!target) return;
        const dStart = target.startAt.slice(0, 10);
        const dEnd = target.endAt.slice(0, 10);
        const shift = (iso: string, dd: number): string => {
          const d = new Date(`${iso}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() + dd);
          return d.toISOString().slice(0, 10);
        };
        const newStart = dragEdge === 'start' ? shift(dStart, delta) : dStart;
        const newEnd = dragEdge === 'end' ? shift(dEnd, delta) : dEnd;
        if (new Date(newEnd) < new Date(newStart)) return; // 倒置直接忽略（回弹）

        // 磁吸联动：当前阶段结束日期变化多少天，后续阶段整体顺延多少天
        const primary: PendingReschedule = {
          stageId,
          stageName: target.name,
          oldStartAt: dStart,
          oldEndAt: dEnd,
          newStartAt: newStart,
          newEndAt: newEnd,
        };
        const deltaEnd = daysBetween(dEnd, newEnd);
        const sortedStages = [...stages].sort((a, b) => a.orderIndex - b.orderIndex);
        const followers: PendingReschedule[] =
          deltaEnd === 0
            ? []
            : sortedStages
                .filter((s) => s.orderIndex > target.orderIndex)
                .map((s) => ({
                  stageId: s.id,
                  stageName: s.name,
                  oldStartAt: s.startAt.slice(0, 10),
                  oldEndAt: s.endAt.slice(0, 10),
                  newStartAt: shift(s.startAt.slice(0, 10), deltaEnd),
                  newEndAt: shift(s.endAt.slice(0, 10), deltaEnd),
                }));
        setBatchPending({ items: [primary, ...followers], primaryIndex: 0 });
      });
    },
    [drag, pxPerDay, stages],
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const activeStageId = pickActiveStage(stages, todayIso);

  // 成员视角禁止拖拽改期（阶段日期编辑仅管理员）
  const effectiveHandleDown = memberView ? (() => undefined) : beginEdgeDrag;

  return (
    <div className="relative">
      {/* 缩放档位切换 */}
      <div className="mb-2 flex items-center justify-between text-xs text-mist">
        <span>提示：拖动彩条边缘改期；←/→ 键平移时间轴（Shift 加速）</span>
        <div className="flex overflow-hidden rounded-md border border-sand">
          {(
            [
              ['month', '月'],
              ['half-month', '双周'],
            ] as Array<[TimelineZoom, string]>
          ).map(([z, label]) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={`px-3 py-1 transition-colors ${
                zoom === z ? 'bg-pine text-white' : 'bg-paper text-mist hover:bg-sand'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-medium overflow-x-auto rounded-lg border border-sand bg-paper shadow-soft">
        <div style={{ width: LEFT_COL_W + chartW, minWidth: '100%' }}>
          {/* 表头行：左侧空置 + 刻度尺 */}
          <div className="flex" style={{ height: HEADER_H }}>
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-sand bg-cream"
              style={{ width: LEFT_COL_W }}
            />
            <MonthScaleHeader
              ticks={
                zoom === 'month'
                  ? buildMonthTicks(range.from, range.to).map((t) => ({ ...t }))
                  : buildHalfMonthTicks(range.from, range.to).map((t) => ({ ...t }))
              }
              pxPerDay={pxPerDay}
            />
          </div>

          <div className="flex relative">
            {/* 左锁定列 */}
            <StageRowsColumn
              stages={stages}
              todayIso={todayIso}
              onRowClick={(stageId) => openDrawer(stageId)}
              activeStageId={activeStageId}
              members={members}
              memberView={memberView}
            />

            {/* 右侧 SVG 画布 */}
            <div className="relative" style={{ height: stages.length * (ROW_H + ROW_GAP) }}>
              <svg
                width={chartW}
                height={stages.length * (ROW_H + ROW_GAP)}
                className="block select-none"
                role="img"
                aria-label="九阶段时间轴"
              >
                {/* 行底纹：激活阶段整行高亮（hex 收敛 timelineColors 常量，v0.3 暗色） */}
                {stages.map((s, i) => (
                  <g key={`rowbg-${s.id}`}>
                    <rect
                      x={0}
                      y={i * (ROW_H + ROW_GAP)}
                      width={chartW}
                      height={ROW_H + ROW_GAP}
                      fill={s.id === activeStageId ? ROW_BG_ACTIVE : i % 2 === 0 ? ROW_BG_EVEN : ROW_BG_ODD}
                    />
                  </g>
                ))}

                {/* 休息日竖向条带（渲染层语义底纹：坐标系仍是自然日线性映射，xOf 用法不变） */}
                <RestDayBands
                  range={range}
                  pxPerDay={pxPerDay}
                  height={stages.length * (ROW_H + ROW_GAP)}
                  policy={restPolicy}
                />

                {/* 今日虚线 */}
                <TodayLine x={xOf(todayIso, range, pxPerDay)} height={stages.length * (ROW_H + ROW_GAP)} />

                {/* 彩条层 */}
                {stages.map((s, i) => (
                  <StageBar
                    key={s.id}
                    stage={s}
                    rowIndex={i}
                    rowH={ROW_H}
                    rowGap={ROW_GAP}
                    range={range}
                    pxPerDay={pxPerDay}
                    active={s.id === activeStageId}
                    draggingDeltaDays={drag.draggingStageId === s.id ? drag.deltaDays : null}
                    draggingEdge={drag.draggingStageId === s.id ? drag.edge : null}
                    onHandleDown={effectiveHandleDown}
                    onClick={() => openDrawer(s.id)}
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 延期原因弹窗（硬闸门在弹窗内实现；v0.5 支持磁吸联动批量改期） */}
      {batchPending && (
        <RescheduleDialog
          batch={batchPending}
          onClose={() => setBatchPending(null)}
        />
      )}
    </div>
  );
}

/** 激活阶段判定（id 版，保持旧签名避免回归）：委托到共享派生层 lib/progress */
export function pickActiveStage(stages: Stage[], todayIso: string): string | null {
  return pickActiveStageId(stages, todayIso);
}

/** 平移导出（供外部分页按钮类控件复用） */
export { panRange };

/** ISO 日期之间相差天数（end - start，可负） */
function daysBetween(startIso: string, endIso: string): number {
  const ms = new Date(`${endIso}T00:00:00Z`).getTime() - new Date(`${startIso}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}

// re-export 供类型引用
export type { Stage };
