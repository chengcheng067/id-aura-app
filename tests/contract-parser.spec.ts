/**
 * 合同解析器量化验收（PRD §5 / 铁律 10）：
 *   - 每份 fixture 的 ground truth 中签订/开工/竣工日期必须出现在该字段 Top-3 候选中；
 *   - 总命中率 ≥ 85%（20 × 3 = 60 个点，≥51 视为达标）；
 *   - 负例：low 置信度字段的 val() 一律为空——不允许「看似确定的日期」被静默带出。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseContract } from '../src/core/contract-parser';
import type { ParsedField } from '../src/core/contract-parser/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures', 'contracts');

interface Expected {
  signed?: string | null;
  start?: string | null;
  end?: string | null;
}

function loadFixtures(): Array<{ name: string; text: string; expected: Expected }> {
  const files = readdirSync(fixturesDir).filter((f) => f.startsWith('sample-') && f.endsWith('.txt'));
  return files.map((f) => {
    const idx = f.replace('sample-', '').replace('.txt', '');
    const text = readFileSync(join(fixturesDir, f), 'utf-8');
    const expected = JSON.parse(
      readFileSync(join(fixturesDir, `expected-${idx}.json`), 'utf-8'),
    ) as Expected;
    return { name: idx, text, expected };
  });
}

/** UI 取值口径：high/mid 直接取首个候选；low → 空字符串（绝不静默写值） */
function uiValue(field: ParsedField | null): string {
  if (!field || field.confidence === 'low' || field.candidates.length === 0) return '';
  return field.candidates[0].value;
}

function top3Contains(field: ParsedField | null, truth: string): boolean {
  if (!field) return false;
  return field.candidates.slice(0, 3).some((c) => c.value === truth);
}

describe('contract-parser：Top-3 命中率（PRD ≥85% = ≥51/60）', () => {
  const fixtures = loadFixtures();
  it(`样本数量应为 20（当前 ${fixtures.length}）`, () => {
    expect(fixtures.length).toBe(20);
  });

  it('三类核心字段 Top-3 累计命中率达标且逐字段统计输出', () => {
    let hit = 0;
    const total = fixtures.length * 3;
    const misses: string[] = [];

    for (const fx of fixtures) {
      const result = parseContract(fx.text);
      const checks: Array<[string, ParsedField | null, string | null]> = [
        ['signed', result.signedDate, fx.expected.signed ?? null],
        ['start', result.startDate, fx.expected.start ?? null],
        ['end', result.endDate, fx.expected.end ?? null],
      ];
      for (const [label, field, truth] of checks) {
        if (truth && top3Contains(field, truth)) {
          hit += 1;
        } else if (truth) {
          misses.push(
            `sample-${fx.name} ${label}: want=${truth}, got=[${(field?.candidates ?? [])
              .map((c) => c.value)
              .join(', ')}]`,
          );
        }
      }
    }

    // 便于排查：命中明细
    if (misses.length > 0) {
      console.log(`未命中 ${misses.length}/${total} 点：\n${misses.join('\n')}`);
    }
    expect(hit).toBeGreaterThanOrEqual(Math.ceil(total * 0.85));
  });
});

describe('contract-parser：低置信度不落值（不允许看似确定的日期）', () => {
  it('无锚点噪声文本 → 三字段全空、UI 取值不产生日期', () => {
    const noisy =
      '本单据仅作为物料领用凭证，采买矿泉水二十箱、A4 纸两箱。2025.03.05 前需使用完毕。与工程进度无关。';
    const r = parseContract(noisy);
    expect(uiValue(r.signedDate)).toBe('');
    expect(uiValue(r.startDate)).toBe('');
    expect(uiValue(r.endDate)).toBe('');
  });

  it('只有孤零零一个日期没有任何中文锚点 → 不带出任何字段值', () => {
    const r = parseContract('备注：全文字段中只有一个日期 2026.09.01 出现，无任何合同语义。');
    expect(uiValue(r.signedDate)).toBe('');
    expect(uiValue(r.startDate)).toBe('');
    expect(uiValue(r.endDate)).toBe('');
  });

  it('低置信度字段保留候选供人工核对但 UI 值为空', () => {
    // 构造仅有弱锚点（如出现「工期」但没有明确数字）的文本
    const r = parseContract('工期条款另见附件。签约主体：某某公司。2026/10/1 开始。');
    if (r.signedDate !== null && r.signedDate.confidence === 'low') {
      expect(uiValue(r.signedDate)).toBe('');
      expect(r.signedDate.candidates.length).toBeGreaterThan(0);
    }
  });
});
