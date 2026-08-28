/**
 * 公司休息制度 · 工作日历算法测试。
 *
 * 日期基准（已核定）：
 *   2026-W37 = 2026-09-07(一) … 2026-09-13(日)
 *   2025-W52 = 2025-12-22(一) … 2025-12-28(日)
 *   2026-W01 = 2025-12-29(一) … 2026-01-04(日)   ← 与 W52 跨年相邻
 *   2026-W02 = 2026-01-05(一) … 2026-01-11(日)
 */

import { describe, it, expect } from 'vitest';

import { dayjs } from '../src/lib/date';
import {
  RestPolicyKind,
  ALL_REST_POLICIES,
  REST_POLICY_LABELS,
  ScheduleBasis,
  ALL_SCHEDULE_BASIS,
  SCHEDULE_BASIS_LABELS,
} from '../src/core/types/enums';
import { DEFAULT_REST_POLICY, DEFAULT_SCHEDULE_BASIS } from '../src/core/types/entities';
import type { RestPolicyConfig } from '../src/core/types/entities';
import {
  isoWeekOffset,
  isRestDay,
  isWorkday,
  snapToWorkday,
  addWorkdays,
  countWorkdays,
  listWorkdays,
} from '../src/lib/workdays';
import {
  isWeekend,
  isBusinessDay,
  addBusinessDays,
  countBusinessDays,
} from '../src/lib/businessdays';

/* ------------------------------ 测试夹具 ------------------------------ */

const DOUBLE: RestPolicyConfig = { kind: RestPolicyKind.DoubleOff, anchorWeek: null };
const SINGLE: RestPolicyConfig = { kind: RestPolicyKind.SingleOff, anchorWeek: null };

function bigSmall(anchorWeek: string, extra?: Partial<RestPolicyConfig>): RestPolicyConfig {
  return { kind: RestPolicyKind.BigSmallWeek, anchorWeek, ...extra };
}

/** 区间内的休息日列表（升序） */
function restDaysInRange(start: string, end: string, policy: RestPolicyConfig): string[] {
  const out: string[] = [];
  const last = dayjs(end);
  let cursor = dayjs(start);
  while (!cursor.isAfter(last)) {
    const iso = cursor.format('YYYY-MM-DD');
    if (isRestDay(iso, policy)) out.push(iso);
    cursor = cursor.add(1, 'day');
  }
  return out;
}

const W37 = ['2026-09-07', '2026-09-13'] as const; // 周一 … 周日

/* --------------------------- isoWeekOffset --------------------------- */

describe('isoWeekOffset：ISO 周序号偏移', () => {
  it('同一周内周一~周日返回同一个值（防「天数差 /7」经典 bug）', () => {
    // 2026-W37 = 09-07(一) … 09-13(日)
    const offsets = [
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ].map((d) => isoWeekOffset(d, '2026-W37'));
    expect(offsets).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(new Set(offsets).size).toBe(1);
  });

  it('同周不同天偏移一致——周六与周日也必须相同', () => {
    expect(isoWeekOffset('2026-09-12', '2026-W37')).toBe(isoWeekOffset('2026-09-13', '2026-W37'));
  });

  it('相邻周相差 1（周内任意一天都成立）', () => {
    expect(isoWeekOffset('2026-09-14', '2026-W37')).toBe(1); // 下周一
    expect(isoWeekOffset('2026-09-20', '2026-W37')).toBe(1); // 下周日
    expect(isoWeekOffset('2026-09-06', '2026-W37')).toBe(-1); // 上周日
  });

  it('跨年不断档：2025-W52 → 2026-W01 → 2026-W02 连续 +1', () => {
    expect(isoWeekOffset('2025-12-27', '2025-W52')).toBe(0);
    expect(isoWeekOffset('2026-01-03', '2025-W52')).toBe(1);
    expect(isoWeekOffset('2026-01-10', '2025-W52')).toBe(2);
    expect(isoWeekOffset('2026-01-17', '2025-W52')).toBe(3);
  });

  it('倒推为负偏移', () => {
    expect(isoWeekOffset('2025-12-20', '2025-W52')).toBe(-1);
    // 2025-09-13(六) 所在 ISO 周的周一为 09-08，距 2025-W52 的周一 12-22 为 15 周
    expect(isoWeekOffset('2025-09-13', '2025-W52')).toBe(-15);
  });

  it('锚点非法时返回 0（不抛错）', () => {
    expect(isoWeekOffset('2026-09-12', 'not-a-week')).toBe(0);
    expect(isoWeekOffset('2026-09-12', '2026-W99')).toBe(0);
  });
});

/* --------------------- 三种制度的休息日集合（同一周） --------------------- */

describe('isRestDay：三种制度的休息日集合', () => {
  it('双休：一周休 2 天（周六 + 周日）', () => {
    expect(restDaysInRange(W37[0], W37[1], DOUBLE)).toEqual(['2026-09-12', '2026-09-13']);
    expect(countWorkdays(W37[0], W37[1], DOUBLE)).toBe(5);
  });

  it('单休：一周休 1 天（仅周日），周六上班', () => {
    expect(restDaysInRange(W37[0], W37[1], SINGLE)).toEqual(['2026-09-13']);
    expect(countWorkdays(W37[0], W37[1], SINGLE)).toBe(6);
    expect(isWorkday('2026-09-12', SINGLE)).toBe(true);
  });

  it('大小休·大休周：一周休 2 天（周六 + 周日）', () => {
    // 锚点 = 2026-W37 本身 → offset 0 → 大休周
    expect(restDaysInRange(W37[0], W37[1], bigSmall('2026-W37'))).toEqual([
      '2026-09-12',
      '2026-09-13',
    ]);
    expect(countWorkdays(W37[0], W37[1], bigSmall('2026-W37'))).toBe(5);
  });

  it('大小休·小休周：一周休 1 天（仅周日），周六上班', () => {
    // 锚点 = 2026-W36 → W37 的 offset = 1（奇数）→ 小休周
    expect(restDaysInRange(W37[0], W37[1], bigSmall('2026-W36'))).toEqual(['2026-09-13']);
    expect(countWorkdays(W37[0], W37[1], bigSmall('2026-W36'))).toBe(6);
  });

  it('大小休：周日无论大休小休都休息', () => {
    expect(isRestDay('2026-09-13', bigSmall('2026-W37'))).toBe(true);
    expect(isRestDay('2026-09-13', bigSmall('2026-W36'))).toBe(true);
  });

  it('大小休：周一~周五无论大休小休都上班', () => {
    for (const d of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']) {
      expect(isRestDay(d, bigSmall('2026-W37'))).toBe(false);
      expect(isRestDay(d, bigSmall('2026-W36'))).toBe(false);
    }
  });
});

/* ------------------------- 大小休跨年不断档 ------------------------- */

describe('大小休：跨年不断档', () => {
  const P = bigSmall('2025-W52'); // 2025-W52 为大休周

  it('2025-W52 的周六休息（大休周）', () => {
    expect(isRestDay('2025-12-27', P)).toBe(true);
  });

  it('2026-W01 的周六上班（小休周），交替未因跨年中断', () => {
    expect(isRestDay('2026-01-03', P)).toBe(false);
  });

  it('2026-W02 的周六回到休息（大休周）', () => {
    expect(isRestDay('2026-01-10', P)).toBe(true);
    expect(isRestDay('2026-01-17', P)).toBe(false);
  });

  it('跨年区间的工作日数：连续两周 11 天（5+6）', () => {
    // 2025-12-22(一) … 2026-01-04(日)，W52 大休 5 天 + W01 小休 6 天
    expect(countWorkdays('2025-12-22', '2026-01-04', P)).toBe(11);
  });

  it('跨年区间的休息日恰为 3 天（两周日 + 大休周六）', () => {
    expect(restDaysInRange('2025-12-22', '2026-01-04', P)).toEqual([
      '2025-12-27',
      '2025-12-28',
      '2026-01-04',
    ]);
  });
});

/* ---------------------- 锚点偏移 ±1 周结果相反 ---------------------- */

describe('大小休：锚点偏移 ±1 周结果完全相反', () => {
  const SAT = '2026-09-12'; // 2026-W37 的周六

  it('锚点为本周 → 休息；锚点为上周 → 上班', () => {
    expect(isoWeekOffset(SAT, '2026-W37')).toBe(0);
    expect(isoWeekOffset(SAT, '2026-W36')).toBe(1);
    expect(isRestDay(SAT, bigSmall('2026-W37'))).toBe(true);
    expect(isRestDay(SAT, bigSmall('2026-W36'))).toBe(false);
  });

  it('锚点为下周 → 上班（负偏移同样按奇偶交替，不断档）', () => {
    expect(isoWeekOffset(SAT, '2026-W38')).toBe(-1);
    expect(isRestDay(SAT, bigSmall('2026-W38'))).toBe(false);
  });

  it('偏移 ±2 周回到同一结果（周期为 2）', () => {
    expect(isRestDay(SAT, bigSmall('2026-W35'))).toBe(true); // offset +2
    expect(isRestDay(SAT, bigSmall('2026-W39'))).toBe(true); // offset -2
  });

  it('anchorWeek 为 null 时周六按上班处理（不崩、不误判）', () => {
    const noAnchor: RestPolicyConfig = { kind: RestPolicyKind.BigSmallWeek, anchorWeek: null };
    expect(isRestDay(SAT, noAnchor)).toBe(false);
    expect(isRestDay('2026-09-13', noAnchor)).toBe(true); // 周日仍休
  });
});

/* -------------------------- countWorkdays -------------------------- */

describe('countWorkdays：含头尾与符号口径', () => {
  it('单日：工作日 = 1，休息日 = 0', () => {
    expect(countWorkdays('2026-09-07', '2026-09-07', DOUBLE)).toBe(1);
    expect(countWorkdays('2026-09-12', '2026-09-12', DOUBLE)).toBe(0);
  });

  it('倒序区间返回负数（双休）', () => {
    expect(countWorkdays('2026-09-13', '2026-09-07', DOUBLE)).toBe(-5);
  });

  it('倒序区间返回负数（单休，6 个工作日）', () => {
    expect(countWorkdays('2026-09-13', '2026-09-07', SINGLE)).toBe(-6);
  });

  it('倒序区间返回负数（大小休小休周，6 个工作日）', () => {
    expect(countWorkdays('2026-09-13', '2026-09-07', bigSmall('2026-W36'))).toBe(-6);
  });

  it('同日区间：工作日 1 / 休息日 0，与 isWorkday 一致', () => {
    expect(countWorkdays('2026-09-12', '2026-09-12', SINGLE)).toBe(1);
    expect(countWorkdays('2026-09-13', '2026-09-13', SINGLE)).toBe(0);
  });
});

/* -------------------------- snapToWorkday -------------------------- */

describe('snapToWorkday：吸附到最近工作日', () => {
  it('forward：周六（双休休息日）→ 下周一', () => {
    expect(snapToWorkday('2026-09-12', DOUBLE)).toBe('2026-09-14');
    expect(snapToWorkday('2026-09-12', DOUBLE, 'forward')).toBe('2026-09-14');
  });

  it('forward：周日 → 下周一', () => {
    expect(snapToWorkday('2026-09-13', DOUBLE)).toBe('2026-09-14');
  });

  it('backward：周六（双休休息日）→ 上周五', () => {
    expect(snapToWorkday('2026-09-12', DOUBLE, 'backward')).toBe('2026-09-11');
  });

  it('backward：周日连续休息 → 越过周六回到上周五', () => {
    expect(snapToWorkday('2026-09-13', DOUBLE, 'backward')).toBe('2026-09-11');
  });

  it('本身是工作日则原样返回（两个方向都不动）', () => {
    expect(snapToWorkday('2026-09-11', DOUBLE)).toBe('2026-09-11');
    expect(snapToWorkday('2026-09-11', DOUBLE, 'backward')).toBe('2026-09-11');
    // 单休下周六是工作日 → 不吸附
    expect(snapToWorkday('2026-09-12', SINGLE)).toBe('2026-09-12');
  });
});

/* ---------------------------- addWorkdays ---------------------------- */

describe('addWorkdays：按制度加工作日', () => {
  it('n=0 落在休息日时向后吸附（双休周六 → 下周一）', () => {
    expect(addWorkdays('2026-09-12', 0, DOUBLE)).toBe('2026-09-14');
  });

  it('n=0 落在工作日时原样返回', () => {
    expect(addWorkdays('2026-09-11', 0, DOUBLE)).toBe('2026-09-11');
    expect(addWorkdays('2026-09-12', 0, SINGLE)).toBe('2026-09-12'); // 单休周六上班
  });

  it('双休：周五 + 1 = 下周一', () => {
    expect(addWorkdays('2026-09-11', 1, DOUBLE)).toBe('2026-09-14');
  });

  it('单休：周五 + 1 = 周六（单休下周六上班）', () => {
    expect(addWorkdays('2026-09-11', 1, SINGLE)).toBe('2026-09-12');
  });

  it('单休的工期比双休短：同样的 +10 工作日，单休早 3 天完成', () => {
    expect(addWorkdays('2026-09-07', 10, DOUBLE)).toBe('2026-09-21');
    expect(addWorkdays('2026-09-07', 10, SINGLE)).toBe('2026-09-18');
  });

  it('大小休：跨小休周（周六上班）累加比双休快', () => {
    // 锚点 W36 → W37 小休（周六上班）
    expect(addWorkdays('2026-09-07', 6, bigSmall('2026-W36'))).toBe('2026-09-14');
  });

  it('大小休：跨大休周（周六休息）时工期回落', () => {
    // 锚点 W36 → W38 为 offset 2（大休周，周六休息）→ 第 11 个工作日跳过周六周日
    expect(addWorkdays('2026-09-07', 11, bigSmall('2026-W36'))).toBe('2026-09-21');
  });
});

/* ------------------ extraHolidays / extraWorkdays 优先级 ------------------ */

describe('extraHolidays / extraWorkdays：优先级短路', () => {
  it('extraHolidays 命中即休息（单休下的周六被放假）', () => {
    const p: RestPolicyConfig = { ...SINGLE, extraHolidays: ['2026-09-12'] };
    expect(isRestDay('2026-09-12', p)).toBe(true);
    expect(countWorkdays('2026-09-07', '2026-09-13', p)).toBe(5);
  });

  it('extraWorkdays 命中即上班（双休下的周六被调休）', () => {
    const p: RestPolicyConfig = { ...DOUBLE, extraWorkdays: ['2026-09-12'] };
    expect(isRestDay('2026-09-12', p)).toBe(false);
    expect(countWorkdays('2026-09-07', '2026-09-13', p)).toBe(6);
  });

  it('extraWorkdays 优先级高于 extraHolidays（同一天同时命中 → 上班）', () => {
    const p: RestPolicyConfig = {
      ...DOUBLE,
      extraHolidays: ['2026-09-13'],
      extraWorkdays: ['2026-09-13'],
    };
    expect(isRestDay('2026-09-13', p)).toBe(false);
    expect(isWorkday('2026-09-13', p)).toBe(true);
  });

  it('extraWorkdays 优先级高于制度本身（周日调休上班）', () => {
    const p: RestPolicyConfig = { ...DOUBLE, extraWorkdays: ['2026-09-13'] };
    expect(isRestDay('2026-09-13', p)).toBe(false);
  });

  it('extraHolidays 可让大小休的小休周六放假', () => {
    const p = bigSmall('2026-W36', { extraHolidays: ['2026-09-12'] });
    expect(isRestDay('2026-09-12', p)).toBe(true);
  });

  it('空数组 / 缺省字段不影响常规判定', () => {
    expect(isRestDay('2026-09-12', { ...DOUBLE, extraHolidays: [], extraWorkdays: [] })).toBe(true);
    expect(isRestDay('2026-09-12', SINGLE)).toBe(false);
  });
});

/* ---------------------------- listWorkdays ---------------------------- */

describe('listWorkdays：区间工作日列表', () => {
  it('双休整周返回 5 天，且不含周末', () => {
    const list = listWorkdays('2026-09-07', '2026-09-13', DOUBLE);
    expect(list).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
  });

  it('单休整周返回 6 天（含周六）', () => {
    const list = listWorkdays('2026-09-07', '2026-09-13', SINGLE);
    expect(list).toHaveLength(6);
    expect(list).toContain('2026-09-12');
    expect(list).not.toContain('2026-09-13');
  });

  it('结果与 countWorkdays 条数一致（三种制度）', () => {
    for (const p of [DOUBLE, SINGLE, bigSmall('2026-W37'), bigSmall('2026-W36')]) {
      expect(listWorkdays('2026-09-07', '2026-10-07', p)).toHaveLength(
        countWorkdays('2026-09-07', '2026-10-07', p),
      );
    }
  });

  it('结果严格升序（跨月区间）', () => {
    const list = listWorkdays('2026-09-25', '2026-10-10', bigSmall('2026-W36'));
    expect(list.length).toBeGreaterThan(0);
    const sorted = [...list].sort();
    expect(list).toEqual(sorted);
  });

  it('倒序区间（end<start）返回空数组', () => {
    expect(listWorkdays('2026-09-13', '2026-09-07', DOUBLE)).toEqual([]);
  });

  it('单日区间：工作日 1 条 / 休息日 0 条', () => {
    expect(listWorkdays('2026-09-07', '2026-09-07', DOUBLE)).toEqual(['2026-09-07']);
    expect(listWorkdays('2026-09-13', '2026-09-13', DOUBLE)).toEqual([]);
  });
});

/* --------------- 与 businessdays 双休口径的一致性（回归护栏） --------------- */

describe('回归护栏：双休口径与 businessdays.ts 完全一致', () => {
  const samples = [
    '2026-09-05',
    '2026-09-06',
    '2026-09-07',
    '2026-09-11',
    '2026-09-12',
    '2026-09-13',
    '2026-09-14',
    '2026-01-01',
    '2026-12-31',
  ];

  it('isWeekend 等价于 DEFAULT 策略下的 isRestDay', () => {
    for (const d of samples) {
      expect(isWeekend(d)).toBe(isRestDay(d, DEFAULT_REST_POLICY));
    }
  });

  it('isBusinessDay 等价于 DEFAULT 策略下的 isWorkday', () => {
    for (const d of samples) {
      expect(isBusinessDay(d)).toBe(isWorkday(d, DEFAULT_REST_POLICY));
    }
  });

  it('countBusinessDays 等价于 DEFAULT 策略下的 countWorkdays（含倒序）', () => {
    const ranges: Array<[string, string]> = [
      ['2026-09-07', '2026-09-13'],
      ['2026-09-07', '2026-09-07'],
      ['2026-09-12', '2026-09-12'],
      ['2026-09-13', '2026-09-07'],
      ['2026-01-01', '2026-03-31'],
    ];
    for (const [a, b] of ranges) {
      expect(countBusinessDays(a, b)).toBe(countWorkdays(a, b, DEFAULT_REST_POLICY));
    }
  });

  it('addBusinessDays 等价于 DEFAULT 策略下的 addWorkdays（N>0）', () => {
    for (const n of [1, 5, 10, 30]) {
      expect(addBusinessDays('2026-09-07', n)).toBe(addWorkdays('2026-09-07', n, DEFAULT_REST_POLICY));
    }
  });

  it('addBusinessDays(N=0) 保留历史语义：不吸附，原样返回当日', () => {
    expect(addBusinessDays('2026-09-12', 0)).toBe('2026-09-12');
  });
});

/* ------------------------- 枚举与默认配置 ------------------------- */

describe('休息制度枚举与默认配置', () => {
  it('三种制度枚举值与文案齐备', () => {
    expect(ALL_REST_POLICIES).toHaveLength(3);
    expect(REST_POLICY_LABELS[RestPolicyKind.DoubleOff]).toBe('双休');
    expect(REST_POLICY_LABELS[RestPolicyKind.SingleOff]).toBe('单休');
    expect(REST_POLICY_LABELS[RestPolicyKind.BigSmallWeek]).toBe('大小休');
  });

  it('每个枚举值都有文案', () => {
    for (const k of ALL_REST_POLICIES) {
      expect(REST_POLICY_LABELS[k]).toBeTruthy();
    }
  });

  it('出厂默认为双休且无锚点', () => {
    expect(DEFAULT_REST_POLICY.kind).toBe(RestPolicyKind.DoubleOff);
    expect(DEFAULT_REST_POLICY.anchorWeek).toBeNull();
  });

  it('默认策略下周六周日休息、周一上班', () => {
    expect(isRestDay('2026-09-12', DEFAULT_REST_POLICY)).toBe(true);
    expect(isRestDay('2026-09-13', DEFAULT_REST_POLICY)).toBe(true);
    expect(isRestDay('2026-09-14', DEFAULT_REST_POLICY)).toBe(false);
  });
});

/* --------------------- 排期基准（项目级）与休息制度正交 --------------------- */

describe('排期基准：枚举与默认配置', () => {
  it('两个枚举值：Calendar=calendar、Workday=workday', () => {
    expect(ScheduleBasis.Calendar).toBe('calendar');
    expect(ScheduleBasis.Workday).toBe('workday');
  });

  it('文案为「按自然日 / 按工作日」', () => {
    expect(SCHEDULE_BASIS_LABELS[ScheduleBasis.Calendar]).toBe('按自然日');
    expect(SCHEDULE_BASIS_LABELS[ScheduleBasis.Workday]).toBe('按工作日');
  });

  it('ALL_SCHEDULE_BASIS 含两项且每项都有文案', () => {
    expect(ALL_SCHEDULE_BASIS).toHaveLength(2);
    expect(ALL_SCHEDULE_BASIS).toContain(ScheduleBasis.Calendar);
    expect(ALL_SCHEDULE_BASIS).toContain(ScheduleBasis.Workday);
    for (const b of ALL_SCHEDULE_BASIS) {
      expect(SCHEDULE_BASIS_LABELS[b]).toBeTruthy();
    }
  });

  it('硬约束：出厂默认排期基准为自然日（Calendar）', () => {
    expect(DEFAULT_SCHEDULE_BASIS).toBe(ScheduleBasis.Calendar);
    expect(DEFAULT_SCHEDULE_BASIS).not.toBe(ScheduleBasis.Workday);
  });
});

describe('排期基准与休息制度正交（项目级 ≠ 公司级）', () => {
  it('scheduleBasis 不属于 RestPolicyConfig', () => {
    expect(Object.keys(DEFAULT_REST_POLICY)).not.toContain('scheduleBasis');
    expect('scheduleBasis' in DEFAULT_REST_POLICY).toBe(false);
  });

  it('休息日判定 API 不消费排期基准（arity 恒为 2）', () => {
    // isRestDay(date, policy) —— 没有 scheduleBasis 位，二者才是正交的
    expect(isRestDay.length).toBe(2);
    expect(isWorkday.length).toBe(2);
  });

  it('切换排期基准不改变任何一天的休息判定', () => {
    const policy = bigSmall('2026-W36'); // W37 为小休周，周六上班
    const sample = ['2026-09-07', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'];
    // 排期基准只决定「工期 N 天」的口径，不改变「哪天休息」
    const perBasis = ALL_SCHEDULE_BASIS.map((basis) => ({
      basis,
      verdicts: sample.map((d) => isRestDay(d, policy)),
    }));
    expect(perBasis[0].verdicts).toEqual([false, false, false, true, false]);
    expect(perBasis[1].verdicts).toEqual(perBasis[0].verdicts); // 两种基准结果逐项相同
  });

  it('两种基准都能与任意休息制度组合，且工作日计数只随制度变化', () => {
    const expectedByKind: Record<RestPolicyKind, number> = {
      [RestPolicyKind.DoubleOff]: 5,
      [RestPolicyKind.SingleOff]: 6,
      [RestPolicyKind.BigSmallWeek]: 6, // anchorWeek=null → 周六按上班
    };
    for (const basis of ALL_SCHEDULE_BASIS) {
      expect(basis in SCHEDULE_BASIS_LABELS).toBe(true);
      for (const kind of ALL_REST_POLICIES) {
        const policy: RestPolicyConfig = { kind, anchorWeek: null };
        expect(countWorkdays('2026-09-07', '2026-09-13', policy)).toBe(expectedByKind[kind]);
      }
    }
  });
});
