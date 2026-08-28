import isoWeek from 'dayjs/plugin/isoWeek';

import type { RestPolicyConfig } from '../core/types/entities';
import { isRestDay } from './workdays';
import { dayjs } from './date';

dayjs.extend(isoWeek);

/**
 * 休息制度设置弹窗的派生层（纯函数，供 UI 与单测共用）。
 *
 * 存在理由（架构 T6 验收项）：大小休预览日历必须「与 isRestDay() 逐格一致」，
 * 若把这段逻辑写进组件，就无法验证它与真实判定是否同源。因此预览/对调一律
 * 收口在这里，且**只调用 isRestDay，绝不二次实现周末判定**。
 *
 * 口径：ISO 周（周一为一周之始，跨年连续），与 src/lib/workdays.ts 的锚点语义完全一致。
 */

/** ISO 周锚点格式：'YYYY-Www' */
const ISO_WEEK_PATTERN = /^(\d{4})-W(\d{2})$/;

/** 某日所在 ISO 周的锚点标识 'YYYY-Www' */
export function isoWeekIdOf(date: string): string {
  const d = dayjs(date);
  return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, '0')}`;
}

/**
 * 'YYYY-Www' → 该周周一的 ISO 日期；非法（格式不符 / 该年不存在第 53 周）返回 null。
 * 用「1 月 4 日必落在第 1 周」的 ISO 定义反推，再回读校验防止 W53 滚到次年 W01。
 */
function mondayOfAnchor(anchorWeek: string | null): string | null {
  if (!anchorWeek) return null;
  const m = ISO_WEEK_PATTERN.exec(anchorWeek.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = dayjs(`${year}-01-04`);
  const monday = jan4.subtract(jan4.isoWeekday() - 1, 'day').add(week - 1, 'week');
  return monday.isoWeek() === week && monday.isoWeekYear() === year
    ? monday.format('YYYY-MM-DD')
    : null;
}

/** 锚点是否可直接用于大小休交替判定（非法锚点在 workdays.ts 内回落为「小休周」） */
export function isValidAnchorWeek(anchorWeek: string | null): boolean {
  return mondayOfAnchor(anchorWeek) !== null;
}

/**
 * 锚点整体位移 delta 周（「对调」= delta ±1：偏移奇偶翻转 ⇒ 大休周/小休周互换）。
 * 锚点缺失或非法时以 fallbackIso 所在周为基准再位移，保证首次点击也有确定结果。
 */
export function shiftIsoWeek(
  anchorWeek: string | null,
  delta = 1,
  fallbackIso = dayjs().format('YYYY-MM-DD'),
): string {
  const base = mondayOfAnchor(anchorWeek) ?? dayjs(fallbackIso).startOf('isoWeek').format('YYYY-MM-DD');
  return isoWeekIdOf(dayjs(base).add(delta, 'week').format('YYYY-MM-DD'));
}

/** 预览格：单日的休息/上班标记 */
export interface RestDayPreviewDay {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 公历日 1~31 */
  day: number;
  /** 0=周日 … 6=周六（dayjs 口径） */
  weekday: number;
  /** 直接取自 isRestDay(date, policy)——UI 不另算 */
  rest: boolean;
}

/** 预览周：周一大休/小休标记 + 7 个预览格 */
export interface RestDayPreviewWeek {
  /** 该周周一 'YYYY-MM-DD' */
  monday: string;
  /** 大休周（周六休息）/ 小休周（周六上班）——取该周周六的 isRestDay 结果 */
  bigWeek: boolean;
  days: RestDayPreviewDay[];
}

/**
 * 生成未来 N 周的休息日预览（周一为行首）。
 * 每格 rest 字段即 isRestDay(date, policy) 的返回值，与月历/时间轴底纹同源。
 */
export function buildRestDayPreview(
  policy: RestPolicyConfig,
  opts: { weeks?: number; fromIso?: string } = {},
): RestDayPreviewWeek[] {
  const weeks = Math.max(1, Math.trunc(opts.weeks ?? 4));
  const from = dayjs(opts.fromIso ?? dayjs().format('YYYY-MM-DD')).startOf('isoWeek');

  const out: RestDayPreviewWeek[] = [];
  for (let w = 0; w < weeks; w += 1) {
    const monday = from.add(w, 'week');
    const days: RestDayPreviewDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = monday.add(i, 'day');
      const iso = d.format('YYYY-MM-DD');
      days.push({ date: iso, day: d.date(), weekday: d.day(), rest: isRestDay(iso, policy) });
    }
    // 大休/小休的判据同样只走 isRestDay：周六休息即大休周
    out.push({ monday: monday.format('YYYY-MM-DD'), bigWeek: days[5].rest, days });
  }
  return out;
}
