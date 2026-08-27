/**
 * 锚点正则组 + 命中上下文窗口截取。
 * 关键词清单来自 PRD §5.2：签订/开工/进场/竣工/完工/验收/工期/日内/日历天/工作日。
 */

import type { FieldCandidate } from './types';

/** 归一化：全角→半角、去空白、统一标点 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[ \t]+/g, (m) => m)
    .replace(/\r\n?/g, '\n')
    .replace(/[，、；]/g, (m) => m)
    .replace(/．/g, '.')
    .replace(/－/g, '-')
    .replace(/—/g, '-');
}

/** 锚点关键词 → 匹配权重（强度因子供 confidence 打分用） */
export const ANCHOR_PATTERNS: ReadonlyArray<{
  key: string;
  weight: number;
  regex: RegExp;
}> = [
  { key: '签订', weight: 1.0, regex: /签订/g },
  { key: '签署', weight: 1.0, regex: /签署/g },
  { key: '订立', weight: 0.95, regex: /订立/g },
  { key: '立约', weight: 0.9, regex: /立约/g },
  { key: '开工', weight: 1.0, regex: /开工/g },
  { key: '进场', weight: 0.9, regex: /进场/g },
  { key: '竣工', weight: 1.0, regex: /竣工/g },
  { key: '完工', weight: 0.9, regex: /完工/g },
  { key: '验收', weight: 0.85, regex: /验收/g },
  { key: '完成', weight: 0.8, regex: /完成/g },
  { key: '工期', weight: 0.95, regex: /工期/g },
  { key: '日内', weight: 0.7, regex: /(\d+)\s*个?(?:自然|日历)?日内/g },
  { key: '日历天', weight: 0.9, regex: /(\d+)\s*个?\s*日历天/g },
  { key: '工作日', weight: 0.9, regex: /(\d+)\s*个?\s*工作日/g },
];

/** 截取命中位置前后各 window 字符的上下文片段 */
export function extractSnippet(text: string, start: number, end: number, window = 24): string {
  const s = Math.max(0, start - window);
  const e = Math.min(text.length, end + window);
  const prefix = s > 0 ? '…' : '';
  const suffix = e < text.length ? '…' : '';
  return `${prefix}${text.slice(s, e).replace(/\n+/g, ' ')}${suffix}`;
}

/** 找出锚点在文本中的所有命中位置 */
export function findAnchors(
  text: string,
  keys: readonly string[],
): Array<{ key: string; index: number; length: number }> {
  const out: Array<{ key: string; index: number; length: number }> = [];
  for (const p of ANCHOR_PATTERNS) {
    if (!keys.includes(p.key)) continue;
    const re = new RegExp(p.regex.source, p.regex.flags);
    let m: RegExpExecArray | null = re.exec(text);
    while (m !== null) {
      out.push({ key: p.key, index: m.index, length: m[0].length });
      m = re.exec(text);
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** 从候选数组生成去重后的 FieldCandidate 列表（按出现顺序） */
export function dedupeCandidates(items: FieldCandidate[]): FieldCandidate[] {
  const seen = new Set<string>();
  const out: FieldCandidate[] = [];
  for (const c of items) {
    const sig = `${c.value}|${c.offset}`;
    if (!seen.has(sig)) {
      seen.add(sig);
      out.push(c);
    }
  }
  return out;
}
