import type { PointerEvent as ReactPointerEvent } from 'react';

import { xOf, type TimelineRange } from '../../lib/date';
import type { Stage } from '../../core/types/entities';
import { StageStatus } from '../../core/types/enums';
import { STAGE_BAR_COLORS } from './stageColors';
import { STAGE_ACTIVE_STROKE, STAGE_GLOW_COLOR } from './timelineColors';

/**
 * 彩条本体：SVG rect + 左右手柄 + 激活发光 + 交付段子刻度。
 * 坐标一律经 lib/date.xOf 计算（T10 铁则）。
 */
export function StageBar({
  stage,
  rowIndex,
  rowH,
  rowGap,
  range,
  pxPerDay,
  active,
  draggingDeltaDays,
  draggingEdge,
  onHandleDown,
  onClick,
}: {
  stage: Stage;
  rowIndex: number;
  rowH: number;
  rowGap: number;
  range: TimelineRange;
  pxPerDay: number;
  active: boolean;
  /** 实时拖拽位移（天）；非拖拽为 null */
  draggingDeltaDays: number | null;
  draggingEdge: 'start' | 'end' | null;
  onHandleDown(e: ReactPointerEvent, stage: Stage, edge: 'start' | 'end'): void;
  onClick(): void;
}): JSX.Element {
  const y = rowIndex * (rowH + rowGap);
  const barH = rowH - 14;

  const dStart = stage.startAt.slice(0, 10);
  const dEnd = stage.endAt.slice(0, 10);

  let xStart = xOf(dStart, range, pxPerDay);
  let xEnd = xOf(dEnd, range, pxPerDay) + pxPerDay; // 含头尾：终点日右缘

  // 拖拽实时形变预览（daily snap 后的整数天）
  if (draggingDeltaDays !== null && draggingEdge === 'end') {
    xEnd += draggingDeltaDays * pxPerDay;
    if (xEnd < xStart + pxPerDay) xEnd = xStart + pxPerDay; // 至少一天
  }
  if (draggingDeltaDays !== null && draggingEdge === 'start') {
    xStart += draggingDeltaDays * pxPerDay;
    if (xStart > xEnd - pxPerDay) xStart = xEnd - pxPerDay;
  }

  const w = Math.max(pxPerDay, xEnd - xStart);
  const fill = STAGE_BAR_COLORS[stage.orderIndex] ?? '#88A293';

  // 状态透明度
  const opacity =
    stage.status === StageStatus.Completed ? 0.35 : stage.status === StageStatus.NotStarted ? 0.8 : 1;

  const handleW = 7;

  return (
    <g
      style={{ cursor: 'pointer' }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* 彩条主体 */}
      <rect
        x={xStart}
        y={y + 7}
        width={w}
        height={barH}
        rx={4}
        ry={4}
        fill={fill}
        opacity={opacity}
        filter={active ? 'url(#stage-glow)' : undefined}
        stroke={active ? STAGE_ACTIVE_STROKE : 'none'}
        strokeWidth={active ? 1.5 : 0}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      />

      {/* 交付阶段子刻度（交底 / 中期 / 验收 三等分浅色竖线） */}
      {stage.name.includes('交付') && w > pxPerDay * 6 && (
        <>
          {[1, 2].map((i) => (
            <line
              key={`seg-${stage.id}-${i}`}
              x1={xStart + (w * i) / 3}
              x2={xStart + (w * i) / 3}
              y1={y + 10}
              y2={y + barH + 4}
              stroke="#FFFFFF"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.55}
            />
          ))}
          {/* 子刻度标签 */}
          {[0, 1, 2].map((i) => (
            <text
              key={`lab-${stage.id}-${i}`}
              x={xStart + (w * i) / 3 + w / 9}
              y={y + barH - 3}
              textAnchor="middle"
              fontSize={9}
              fill="#FFFFFF"
              opacity={0.85}
            >
              {['交底', '中期', '验收'][i]}
            </text>
          ))}
        </>
      )}

      {/* 左右手柄（仅未完成阶段可拖） */}
      {stage.status !== StageStatus.Completed && (
        <>
          <rect
            x={xStart + 1}
            y={y + 12}
            width={handleW}
            height={barH - 10}
            rx={3}
            fill="rgba(255,255,255,0.5)"
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(e) => onHandleDown(e, stage, 'start')}
          />
          <rect
            x={xEnd - handleW - 1}
            y={y + 12}
            width={handleW}
            height={barH - 10}
            rx={3}
            fill="rgba(255,255,255,0.5)"
            style={{ cursor: 'ew-resize' }}
            onPointerDown={(e) => onHandleDown(e, stage, 'end')}
          />
        </>
      )}

      {/* 条内日期标注（宽度足够时） */}
      {w > pxPerDay * 20 && (
        <text
          x={xStart + w / 2}
          y={y + 18}
          textAnchor="middle"
          fontSize={9.5}
          fill="#FFFFFF"
          opacity={0.92}
          pointerEvents="none"
        >
          {dStart} → {dEnd}
        </text>
      )}
    </g>
  );
}

/** SVG filter defs（激活发光）——挂在 TimelineView 的 svg 内 */
export function StageBarDefs(): JSX.Element {
  return (
    <defs>
      <filter id="stage-glow" x="-15%" y="-40%" width="130%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={STAGE_GLOW_COLOR} floodOpacity="0.45" />
      </filter>
    </defs>
  );
}
