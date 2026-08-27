/**
 * 合同解析器边界输入补充测试（QA 补充轮次）：
 *   PRD §5 硬规则——空串/纯乱码/无日期文本必须返回 null 字段或空候选，
 *   绝不允许输出「看似确定的日期」；同时用强正例守住不过度保守的底线。
 *
 * 口径说明：
 *   -「不产生可用日期」断言的是 UI 取值口径（low 档/空候选 → 空字符串）；
 *   - 弱锚点（如工程语境外的『完成』）产出 mid 候选属设计内行为
 *     （向导第二步黄色卡片需人工核对），不算静默写入；
 *   - high 置信度必须存在真实锚点支撑，无锚点输入不得给出 high。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseContract } from '../src/core/contract-parser';
import type { ContractParseResult, ParsedField } from '../src/core/contract-parser/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures', 'contracts');

/** UI 取值口径（与 contract-parser.spec.ts 保持一致）：low 或空候选 → 空串 */
function uiValue(field: ParsedField | null): string {
  if (!field || field.confidence === 'low' || field.candidates.length === 0) return '';
  return field.candidates[0].value;
}

function allFields(r: ContractParseResult): Array<ParsedField | null> {
  return [r.signedDate, r.startDate, r.endDate];
}

/** 无任何合同语义的边界输入：期望「不产生可用日期值」且不出 high */
const EDGE_INPUTS: ReadonlyArray<readonly [string, string]> = [
  ['空字符串', ''],
  ['纯空白字符', '   \n\t　  '],
  ['纯乱码符号', '@#$%^&*()_+~`|{}[]<>?!'],
  ['emoji 与零宽字符', '\u200b\uFEFF🎉🚀💥😀'],
  ['无锚点平淡文字', '这里完全没有与工程合同相关的词汇存在，就是一段平淡无奇的日常描述而已。'],
  ['孤日期无语义', '备注：全文字段中只有一个日期 2026.09.01 出现，无任何上下文语义可循。'],
  ['弱语境噪音单据', '本单据仅作为物料领用凭证。2025.03.05 前需使用完毕。与工程进度无关。'],
  ['仅金额无日期', '合同总金额人民币拾捌万元整，于签约当日一次性付清，不留质保金。'],
  ['乱码夹杂日期', '!@# 鍀磡礓 %^&* 2027/04/12 *&^% 氇醭'],
];

describe('contract-parser 边界输入：绝不输出看似确定的日期（PRD 硬规则）', () => {
  it.each(EDGE_INPUTS)('%s：三字段 UI 取值全为空', (_label, text) => {
    const r = parseContract(text);
    expect(uiValue(r.signedDate)).toBe('');
    expect(uiValue(r.startDate)).toBe('');
    expect(uiValue(r.endDate)).toBe('');
  });

  it.each(EDGE_INPUTS)('%s：不存在无锚点撑腰的 high 置信度', (_label, text) => {
    const r = parseContract(text);
    for (const f of allFields(r)) {
      if (f !== null) {
        expect(f.confidence).not.toBe('high');
      }
    }
  });

  it('空字符串：三字段直接为 null 且有引导人工的警告文案', () => {
    const r = parseContract('');
    expect(r.signedDate).toBeNull();
    expect(r.startDate).toBeNull();
    expect(r.endDate).toBeNull();
    expect(r.durationDays).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('噪声单据中的日期不得泄漏进任何核心字段', () => {
    const r = parseContract('本单据仅作为物料领用凭证。2025.03.05 前需使用完毕。与工程进度无关。');
    expect(r.signedDate).toBeNull();
    expect(r.startDate).toBeNull();
    expect(r.endDate).toBeNull();
  });

  it('「工期」无数字 → 工期条款解析为空且终止日期不为空壳值', () => {
    const r = parseContract('工期条款另见附件。具体条款以后续补充协议为准。');
    expect(r.durationDays).toBeNull();
    expect(r.durationUnit).toBeNull();
    expect(uiValue(r.endDate)).toBe('');
  });

  it('过度保守防线：极短真实签约句仍应命中 high 并取到正确日期', () => {
    const r = parseContract('设计合同。甲乙双方于 2026年9月1日 签订本合同。');
    expect(r.signedDate).not.toBeNull();
    expect(r.signedDate?.confidence).toBe('high');
    expect(uiValue(r.signedDate)).toBe('2026-09-01');
  });

  it('夹具联通性抽检：sample-01 签订日 Top-1 即 ground truth（测试装置自校准）', () => {
    const idx = '01';
    const text = readFileSync(join(fixturesDir, `sample-${idx}.txt`), 'utf-8');
    const expected = JSON.parse(readFileSync(join(fixturesDir, `expected-${idx}.json`), 'utf-8')) as {
      signed?: string;
    };
    const r = parseContract(text);
    expect(r.signedDate?.candidates[0]?.value).toBe(expected.signed ?? '');
  });
});
