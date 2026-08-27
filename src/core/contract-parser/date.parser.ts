/**
 * 中西文多格式日期解析（含汉字数字年份），全部纯函数。
 */

import type { FieldCandidate } from './types';

const CN_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  〇: 0,
};

function cnSectionToNumber(section: string): number | null {
  if (/^\d+$/.test(section)) return parseInt(section, 10);
  // 简单位权转换（十/两/廿 支持）
  let total = 0;
  let current = 0;
  for (const ch of section) {
    if (ch === '十') {
      total += (current || 1) * 10;
      current = 0;
    } else if (ch === '两') {
      current = current * 10 + 2;
    } else if (ch === '廿') {
      total += 20;
      current = 0;
    } else if (CN_DIGITS[ch] !== undefined) {
      current = current * 10 + CN_DIGITS[ch];
    } else {
      return null;
    }
  }
  return total + current;
}

/** 汉字数字年份，如 二〇二六 → 2026 */
export function chineseYearToNumber(raw: string): number | null {
  let year = 0;
  for (const ch of raw) {
    if (ch === '〇' || ch === '零') {
      year = year * 10;
    } else if (CN_DIGITS[ch] !== undefined) {
      year = year * 10 + CN_DIGITS[ch];
    } else {
      return null;
    }
  }
  return year >= 1900 && year <= 2200 ? year : null;
}

/** 各格式正则（对归一化后文本执行；允许字间空白——「2026 年 9 月 1 日」写法） */
const PATTERNS: RegExp[] = [
  // 2026年9月1日 / 2026 年 9 月 1 日
  /(?<y>\d{4})\s*年\s*(?<m>\d{1,2})\s*月\s*(?<d>\d{1,2})\s*日/g,
  // 2026.09.01 / 2026-09-01 / 2026/9/1
  /(?<y>\d{4})\s*[./-]\s*(?<m>\d{1,2})\s*[./-]\s*(?<d>\d{1,2})/g,
];

/** 汉字日期：二〇二六年九月一日 / 二〇二六年十月一日（含裸「十/廿/两」段位） */
const CN_SEG = '[零〇一二三四五六七八九十廿两]{1,3}';
const CN_PATTERN = new RegExp(
  `(?<cy>[零〇一二三四五六七八九]{4})年(?:(${CN_SEG})月)?(?:(${CN_SEG})日)?`,
  'g',
);

export interface RawDateHit {
  isoDate: string;
  offset: number;
  length: number;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function isValidYMD(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2200) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 提取原文中所有可识别日期命中 */
export function extractDateHits(text: string): RawDateHit[] {
  const hits: RawDateHit[] = [];

  for (const re of PATTERNS) {
    const regex = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null = regex.exec(text);
    while (m !== null) {
      const g = m.groups as { y: string; m: string; d: string };
      const y = parseInt(g.y, 10);
      const mo = parseInt(g.m, 10);
      const d = parseInt(g.d, 10);
      if (isValidYMD(y, mo, d)) {
        hits.push({ isoDate: `${y}-${pad(mo)}-${pad(d)}`, offset: m.index, length: m[0].length });
      }
      m = regex.exec(text);
    }
  }

  CN_PATTERN.lastIndex = 0;
  let cm: RegExpExecArray | null = CN_PATTERN.exec(text);
  while (cm !== null) {
    // 编号捕获组：cm[1]=具名年份组 cy（具名组同样占编号）、cm[2]=月、cm[3]=日
    const cyRaw = cm.groups?.cy;
    const monthRaw = cm[2] ?? undefined;
    const dayRaw = cm[3] ?? undefined;
    const year = typeof cyRaw === 'string' ? chineseYearToNumber(cyRaw) : null;
    if (year !== null && monthRaw && dayRaw) {
      const mo = cnSectionToNumber(monthRaw);
      const d = cnSectionToNumber(dayRaw);
      if (mo !== null && d !== null && isValidYMD(year, mo, d)) {
        hits.push({
          isoDate: `${year}-${pad(mo)}-${pad(d)}`,
          offset: cm.index,
          length: cm[0].length,
        });
      }
    }
    cm = CN_PATTERN.exec(text);
  }

  return hits.sort((a, b) => a.offset - b.offset);
}

/** 从命中构建候选列表（去重由上游处理） */
export function hitsToCandidates(text: string, hits: RawDateHit[]): FieldCandidate[] {
  return hits.map((h) => ({
    value: h.isoDate,
    snippet: text.slice(Math.max(0, h.offset - 12), h.offset + h.length + 12),
    offset: h.offset,
  }));
}
