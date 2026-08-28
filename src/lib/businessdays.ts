/**
 * 工作日换算（双休口径）——薄封装。
 *
 * 真实实现统一收敛到 src/lib/workdays.ts（支持双休/单休/大小休 + 法定节假日扩展点）。
 * 本文件仅以出厂默认策略 DEFAULT_REST_POLICY（=双休）转调，保持历史导出签名与行为不变，
 * 因此 tests/date.businessdays.spec.ts 无需任何修改。
 *
 * 新代码请直接使用 workdays.ts 并传入当前休息制度，不要继续扩散本文件的双休口径。
 */

import { DEFAULT_REST_POLICY } from '../core/types/entities';
import { dayjs } from './date';
import { addWorkdays, countWorkdays, isRestDay, isWorkday } from './workdays';

/** 是否为双休日（周六/周日），UTC 口径以日期字符串计算 */
export function isWeekend(isoDate: string): boolean {
  return isRestDay(isoDate, DEFAULT_REST_POLICY);
}

/** 是否为工作日（双休口径；法定节假日表接入后由 workdays.ts 统一扩展） */
export function isBusinessDay(isoDate: string): boolean {
  return isWorkday(isoDate, DEFAULT_REST_POLICY);
}

/** 从起始日起加 N 个工作日（N=0 返回当日） */
export function addBusinessDays(isoDate: string, days: number): string {
  // 历史语义：N<=0 时不吸附，原样返回当日（addWorkdays 会向后吸附到工作日）
  if (days <= 0) return dayjs(isoDate).format('YYYY-MM-DD');
  return addWorkdays(isoDate, days, DEFAULT_REST_POLICY);
}

/** 两日期间的工作日天数（含头尾；b<a 时返回负数） */
export function countBusinessDays(startIso: string, endIso: string): number {
  return countWorkdays(startIso, endIso, DEFAULT_REST_POLICY);
}
