/**
 * 日历天/工作日解析与相对换算（双休口径，节假日表留 TODO 注释——PRD 待确认 3）。
 */

import { addBusinessDays } from '../../lib/businessdays';
import dayjs from 'dayjs';

export interface DurationHit {
  days: number;
  unit: 'calendar' | 'business';
  offset: number;
  length: number;
}

const DURATION_PATTERN = /(?<n>\d+)\s*个?\s*(?:自然|日历)?\s*天|(?<n2>\d+)\s*个?\s*日历天|(?<n3>\d+)\s*个?\s*工作日/g;

/** 抽取所有「N 个 X」工期表述 */
export function extractDurationHits(text: string): DurationHit[] {
  const out: DurationHit[] = [];
  DURATION_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null = DURATION_PATTERN.exec(text);
  while (m !== null) {
    // 三分支命名组：n2=日历天，n3=工作日，n=裸「天/自然日」（默认按日历口径）
    if (m.groups?.n3) {
      out.push({ days: parseInt(m.groups.n3, 10), unit: 'business', offset: m.index, length: m[0].length });
    } else if (m.groups?.n2) {
      out.push({ days: parseInt(m.groups.n2, 10), unit: 'calendar', offset: m.index, length: m[0].length });
    } else if (m.groups?.n) {
      out.push({ days: parseInt(m.groups.n, 10), unit: 'calendar', offset: m.index, length: m[0].length });
    }
    m = DURATION_PATTERN.exec(text);
  }
  return out;
}

/** 以 anchor 日为基准换算终点日期；calendar 按自然日，business 按双休跳过 */
export function computeEndDate(anchorIso: string, days: number, unit: 'calendar' | 'business'): string {
  if (unit === 'business') {
    return addBusinessDays(anchorIso, days);
  }
  return dayjs(anchorIso).add(days, 'day').format('YYYY-MM-DD');
}
