import { useCallback, useMemo, useState } from 'react';

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
import { StageStatus } from '../../core/types/enums';
import { useUiStore, type TimelineZoom } from '../../store/useUiStore';
import { useKeyboardPan } from '../../hooks/useKeyboardPan';
import { useDragReschedule } from '../../hooks/useDragReschedule';
import { MonthScaleHeader } from './MonthScaleHeader';
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

  const pxPerDay = ZOOM_PPD[zoom];

  // 可视窗口：项目起止外扩 7 天
  const baseRange = useMemo<TimelineRange>(() => {
    const from = new Date(`${project.plannedStartAt.slice(0, 10)}T00:00:00Z`);
    const to = new Date(`${project.plannedEndAt.slice(0, 10)}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 7);
    to.setUTCDate(to.getUTCDate() + 7);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [project.plannedStartAt, project.plannedEndAt]);

  const [range, setRange] = useState<TimelineRange>(baseRange);

  const days = rangeDays(range);
  const chartW = days * pxPerDay;

  useKeyboardPan(true, range, setRange);

  /* ------------------------------ 拖拽改期编排 ------------------------------ */
  const drag = useDragReschedule();
  const [pending, setPending] = useState<PendingReschedule | null>(null);

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
        setPending({
          stageId,
          stageName: target.name,
          oldStartAt: dStart,
          oldEndAt: dEnd,
          newStartAt: newStart,
          newEndAt: newEnd,
        });
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

      {/* 延期原因弹窗（硬闸门在弹窗内实现） */}
      {pending && (
        <RescheduleDialog
          pending={pending}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}

/** 激活阶段判定：今天落在其区间内且未完成；否则取最近的未完成阶段 */
export function pickActiveStage(stages: Stage[], todayIso: string): string | null {
  const visible = stages.filter((s) => s.visible !== false);
  const inRange = visible.find(
    (s) =>
      s.status !== StageStatus.Completed &&
      todayIso >= s.startAt.slice(0, 10) &&
      todayIso <= s.endAt.slice(0, 10),
  );
  if (inRange) return inRange.id;
  const nextUp = visible
    .filter((s) => s.status !== StageStatus.Completed)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .find((s) => s.startAt.slice(0, 10) > todayIso);
  return nextUp?.id ?? null;
}

/** 平移导出（供外部分页按钮类控件复用） */
export { panRange };

// re-export 供类型引用
export type { Stage };
