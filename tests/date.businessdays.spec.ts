/**
 * 工作日换算测试（双休口径；节假日表留待后续接入）。
 */

import { describe, it, expect } from 'vitest';

import { isWeekend, isBusinessDay, addBusinessDays, countBusinessDays } from '../src/lib/businessdays';

describe('businessdays：双休判定', () => {
  it('2026-09-05 是周六、2026-09-06 是周日', () => {
    expect(isWeekend('2026-09-05')).toBe(true);
    expect(isWeekend('2026-09-06')).toBe(true);
    expect(isBusinessDay('2026-09-05')).toBe(false);
    expect(isBusinessDay('2026-09-07')).toBe(true); // 周一
  });
});

describe('businessdays：addBusinessDays', () => {
  it('周一 + 5 个工作日 = 下周一（跳过双休）', () => {
    // 2026-09-07 是周一
    expect(addBusinessDays('2026-09-07', 5)).toBe('2026-09-14');
  });

  it('周五 + 1 个工作日 = 下周一', () => {
    // 2026-09-11 是周五
    expect(addBusinessDays('2026-09-11', 1)).toBe('2026-09-14');
  });

  it('N=0 返回当日', () => {
    expect(addBusinessDays('2026-09-12', 0)).toBe('2026-09-12');
  });

  it('跨多个周末（+10 工作日 = 自然 +14 天）', () => {
    expect(addBusinessDays('2026-09-07', 10)).toBe('2026-09-21');
  });
});

describe('businessdays：countBusinessDays（含头尾）', () => {
  it('整周（周一到周日）= 5 个工作日', () => {
    expect(countBusinessDays('2026-09-07', '2026-09-13')).toBe(5);
  });

  it('单日为工作日 = 1，单日为周末 = 0', () => {
    expect(countBusinessDays('2026-09-07', '2026-09-07')).toBe(1);
    expect(countBusinessDays('2026-09-12', '2026-09-12')).toBe(0);
  });

  it('倒序区间返回负数', () => {
    expect(countBusinessDays('2026-09-13', '2026-09-07')).toBe(-5);
  });
});
