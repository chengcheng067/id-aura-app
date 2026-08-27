/**
 * 付款条款句式挖掘：将「X% 于 Y 条件达成后支付」的条件短语映射至九阶段，
 * 仅产 stageHint 佐证线索，不强写阶段边界（PRD 待确认 6：本期不做回款表）。
 */

import type { PaymentClauseHint } from './types';

/** 触发词 → 九阶段 orderIndex 映射（源自 PRD §5.1 付款节点示例） */
const STAGE_HINT_MAP: ReadonlyArray<{ keywords: string[]; orderIndex: number; name: string }> = [
  { keywords: ['签订'], orderIndex: 1, name: '提案' },
  { keywords: ['测量完成', '进场后', '开工'], orderIndex: 2, name: '测量' },
  { keywords: ['方案确认', '平面方案', '平面确认'], orderIndex: 3, name: '平面方案' },
  { keywords: ['模型确认', 'SU 确认', '建模'], orderIndex: 4, name: 'SU 建模' },
  { keywords: ['效果图确认', '效果确认', '渲染确认'], orderIndex: 5, name: '效果图' },
  { keywords: ['施工图', '图纸会审'], orderIndex: 6, name: '施工图深化' },
  { keywords: ['材料下单', '选样定版', '材料确认'], orderIndex: 7, name: '材料表' },
  { keywords: ['竣工验收合格', '竣工验收', '验收合格后'], orderIndex: 8, name: '交付' },
  { keywords: ['质保金', '完工后', '一年后'], orderIndex: 9, name: '实景' },
];

const CLAUSE_PATTERN =
  /(?<text>[^。\n]{0,40}?(?<pct>\d{1,2}(?:\.\d+)?)\s*%[^。\n]{0,60}(?:支付|付清|支付完毕)[^。\n]{0,20})/g;

export function extractPaymentClauses(text: string): PaymentClauseHint[] {
  const out: PaymentClauseHint[] = [];
  const regex = new RegExp(CLAUSE_PATTERN.source, CLAUSE_PATTERN.flags);
  let m: RegExpExecArray | null = regex.exec(text);
  while (m !== null) {
    const g = m.groups as { text: string; pct: string };
    const clauseText: string = g.text;
    let matchedKeyword: string | null = null;
    let hintOrderIndex: number | null = null;
    let hintName: string | null = null;
    for (const mapping of STAGE_HINT_MAP) {
      const kw = mapping.keywords.find((k) => clauseText.includes(k));
      if (kw) {
        matchedKeyword = kw;
        hintOrderIndex = mapping.orderIndex;
        hintName = mapping.name;
        break;
      }
    }
    out.push({
      text: clauseText.trim(),
      percent: parseFloat(g.pct),
      stageHintOrderIndex: hintOrderIndex,
      stageHintName: hintName,
      matchedKeyword,
    });
    m = regex.exec(text);
  }
  return out;
}
