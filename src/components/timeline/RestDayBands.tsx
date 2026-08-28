import { useMemo } from 'react';

import { dayjs, rangeDays, type TimelineRange } from '../../lib/date';
import { isRestDay } from '../../lib/workdays';
import type { RestPolicyConfig } from '../../core/types/entities';
import { REST_DAY_BAND } from './timelineColors';

/** 一根条带：连续休息日合并成一段（双休 → 2 天宽） */
interface RestBand {
  /** 条带起始日距 range.from 的自然日序号 */
  startIdx: number;
  x: number;
  width: number;
}

/**
 * 把可视区间内的休息日合并成连续条带。
 *
 * ⚠️ 架构红线：x 只由「自然日序号 × pxPerDay」得出，与 lib/date.xOf 的自然日线性映射
 * 逐像素一致。休息日**只在渲染层画底纹**，绝不压缩坐标——否则时间轴上会出现宽度
 * 不等的「天」，拖拽/平移/刻度全部报废。
 */
export function buildRestBands(
  range: TimelineRange,
  pxPerDay: number,
  policy: RestPolicyConfig,
): RestBand[] {
  const total = rangeDays(range);
  const bands: RestBand[] = [];
  let runStart: number | null = null;

  const flush = (endIdxExclusive: number): void => {
    if (runStart === null) return;
    const days = endIdxExclusive - runStart;
    bands.push({
      startIdx: runStart,
      x: runStart * pxPerDay,
      width: days * pxPerDay,
    });
    runStart = null;
  };

  for (let i = 0; i < total; i += 1) {
    const iso = dayjs(range.from).add(i, 'day').format('YYYY-MM-DD');
    if (isRestDay(iso, policy)) {
      if (runStart === null) runStart = i;
    } else {
      flush(i);
    }
  }
  flush(total);

  return bands;
}

/**
 * 时间轴休息日竖向条带底纹（T7）。
 * 画在行底纹之上、阶段彩条之下，纯视觉语义层，不参与任何排期计算。
 */
export function RestDayBands({
  range,
  pxPerDay,
  height,
  policy,
}: {
  range: TimelineRange;
  pxPerDay: number;
  height: number;
  policy: RestPolicyConfig;
}): JSX.Element | null {
  const bands = useMemo(
    () => buildRestBands(range, pxPerDay, policy),
    [range, pxPerDay, policy],
  );
  if (bands.length === 0) return null;

  return (
    <g aria-hidden>
      {bands.map((b) => (
        <rect
          key={b.startIdx}
          x={b.x}
          y={0}
          width={b.width}
          height={height}
          fill={REST_DAY_BAND}
        />
      ))}
    </g>
  );
}
