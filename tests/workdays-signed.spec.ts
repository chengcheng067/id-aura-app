/**
 * T5 拖拽改期按工作日顺延 · 纯函数测试。
 *
 * 覆盖 lib/workdays 新增的两个纯函数（有符号加工作日 / 方向感知吸附位移），
 * 以及磁吸联动用到的「工作日序号差」语义（countWorkdays 相对基准差）。
 *
 * 日期基准（已核定，与 workdays.rest-policy.spec.ts 一致）：
 *   2026-W37 = 2026-09-07(一) … 2026-09-13(日)
 *   2026-09-07 周一 / 09-10 周四 / 09-11 周五 / 09-12 周六 / 09-13 周日 / 09-14 下周一
 */

import { describe, it, expect } from 'vitest';

import { RestPolicyKind } from '../src/core/types/enums';
import type { RestPolicyConfig } from '../src/core/types/entities';
import {
  addWorkdays,
  addWorkdaysSigned,
  snapShiftDate,
  snapToWorkday,
  countWorkdays,
} from '../src/lib/workdays';

const DOUBLE: RestPolicyConfig = { kind: RestPolicyKind.DoubleOff, anchorWeek: null };
const SINGLE: RestPolicyConfig = { kind: RestPolicyKind.SingleOff, anchorWeek: null };

describe('addWorkdaysSigned：有符号加工作日', () => {
  it('n>=0 与 addWorkdays 逐例一致（双休）', () => {
    for (const [d, n] of [
      ['2026-09-11', 0],
      ['2026-09-11', 1],
      ['2026-09-11', 3],
      ['2026-09-12', 1], // 起点休息日（周六）：先向前吸附再 +1
      ['2026-09-07', 5],
    ] as Array<[string, number]>) {
      expect(addWorkdaysSigned(d, n, DOUBLE)).toBe(addWorkdays(d, n, DOUBLE));
    }
  });

  it('n<0：缩短跨周末正确（周五 -1 → 周四）', () => {
    expect(addWorkdaysSigned('2026-09-11', -1, DOUBLE)).toBe('2026-09-10');
    expect(addWorkdaysSigned('2026-09-14', -1, DOUBLE)).toBe('2026-09-11'); // 周一 -1 → 上周五
  });

  it('n<0 多步：周五 -2 → 周三', () => {
    expect(addWorkdaysSigned('2026-09-11', -2, DOUBLE)).toBe('2026-09-09');
  });

  it('n<0 起点休息日：先向前吸附再减（周日 -1 → 上周四）', () => {
    // 2026-09-13 周日 → backward 吸到 09-11 周五，-1 → 09-10 周四
    expect(addWorkdaysSigned('2026-09-13', -1, DOUBLE)).toBe('2026-09-10');
  });

  it('单休（仅周日休）：周六 +1 → 下周一', () => {
    // 周六上班，+1 落在周日（休）→ 继续 +1 到周一
    expect(addWorkdaysSigned('2026-09-12', 1, SINGLE)).toBe('2026-09-14');
  });
});

describe('snapShiftDate：方向感知吸附位移', () => {
  it('正 delta 落休息日 → 向后吸附（周五 +1 → 下周一）', () => {
    expect(snapShiftDate('2026-09-11', 1, DOUBLE)).toBe('2026-09-14');
  });

  it('负 delta 落休息日 → 向前吸附（周一 -1 → 上周五），不回卷', () => {
    // 若一律 forward 会吸回 09-14，这里断言 09-11 证明方向感知
    expect(snapShiftDate('2026-09-14', -1, DOUBLE)).toBe('2026-09-11');
  });

  it('负 delta 再落休息日 → 继续向前（周二 -2 → 上周五）', () => {
    expect(snapShiftDate('2026-09-08', -2, DOUBLE)).toBe('2026-09-04');
  });

  it('delta=0：起始日落在休息日则吸附', () => {
    expect(snapShiftDate('2026-09-12', 0, DOUBLE)).toBe(snapToWorkday('2026-09-12', DOUBLE, 'forward'));
    expect(snapShiftDate('2026-09-08', 0, DOUBLE)).toBe('2026-09-08'); // 工作日原样
  });

  it('位移落在工作日 → 原样返回', () => {
    expect(snapShiftDate('2026-09-08', 2, DOUBLE)).toBe('2026-09-10');
  });
});

describe('磁吸联动：工作日序号差（countWorkdays 相对基准差）', () => {
  const BASE = '2026-09-07'; // 周一，恒 ≤ 被拖阶段起止

  it('周五拖到下周一 = 顺延 1 个工作日', () => {
    const oldEnd = '2026-09-11';
    const newEnd = '2026-09-14';
    expect(countWorkdays(BASE, newEnd, DOUBLE) - countWorkdays(BASE, oldEnd, DOUBLE)).toBe(1);
  });

  it('周五拖到周三 = 提前 2 个工作日', () => {
    const oldEnd = '2026-09-11';
    const newEnd = '2026-09-09';
    expect(countWorkdays(BASE, newEnd, DOUBLE) - countWorkdays(BASE, oldEnd, DOUBLE)).toBe(-2);
  });

  it('不变（同日）= 0', () => {
    expect(countWorkdays(BASE, '2026-09-11', DOUBLE) - countWorkdays(BASE, '2026-09-11', DOUBLE)).toBe(0);
  });

  it('含头尾语义：同一天序号差为 0 而非 1', () => {
    expect(countWorkdays('2026-09-11', '2026-09-11', DOUBLE)).toBe(1); // 自身=1
    expect(countWorkdays(BASE, '2026-09-11', DOUBLE) - countWorkdays(BASE, '2026-09-11', DOUBLE)).toBe(0);
  });
});
