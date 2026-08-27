/**
 * 工作日换算（双休口径）。
 * TODO(节假日)：`holidays` 设置键已预埋（settings 表），后续填入法定节假日
 * YYYY-MM-DD 数组后，在本文件各函数追加跳过逻辑即可全局生效。
 */

import dayjs from 'dayjs';

/** 是否为双休日（周六/周日），UTC 口径以日期字符串计算 */
export function isWeekend(isoDate: string): boolean {
  const dow = dayjs(isoDate).day();
  return dow === 0 || dow === 6;
}

/** 是否为工作日（双休口径；法定节假日表接入后在此扩展） */
export function isBusinessDay(isoDate: string): boolean {
  return !isWeekend(isoDate);
}

/** 从起始日起加 N 个工作日（N=0 返回当日） */
export function addBusinessDays(isoDate: string, days: number): string {
  let cursor = dayjs(isoDate);
  let remaining = days;
  while (remaining > 0) {
    cursor = cursor.add(1, 'day');
    if (isBusinessDay(cursor.format('YYYY-MM-DD'))) {
      remaining -= 1;
    }
  }
  return cursor.format('YYYY-MM-DD');
}

/** 两日期间的工作日天数（含头尾；b<a 时返回负数） */
export function countBusinessDays(startIso: string, endIso: string): number {
  let a = dayjs(startIso);
  let b = dayjs(endIso);
  const sign = b.isBefore(a) ? -1 : 1;
  if (sign < 0) {
    const tmp = a;
    a = b;
    b = tmp;
  }
  let count = 0;
  let cursor = a;
  while (!cursor.isAfter(b)) {
    if (isBusinessDay(cursor.format('YYYY-MM-DD'))) count += 1;
    cursor = cursor.add(1, 'day');
  }
  return sign * count;
}
