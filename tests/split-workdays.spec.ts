import { describe, expect, it } from 'vitest';

import { previewSplit } from '../src/core/template/split';
import { addWorkdays, countWorkdays, isRestDay } from '../src/lib/workdays';
import { DEFAULT_REST_POLICY } from '../src/core/types/entities';
import { RestPolicyKind, ScheduleBasis } from '../src/core/types/enums';
import type { RestPolicyConfig } from '../src/core/types/entities';

/** 2026-09-07 是周一；2026-11-29 是周日，跨度约 12 周 */
const START = '2026-09-07';
const END = '2026-11-29';

/** 单休（仅周日休）策略 */
const SINGLE_OFF: RestPolicyConfig = { kind: RestPolicyKind.SingleOff, anchorWeek: null };

/** 大小休（2026-W37 为大休周）策略：锚点周为大休周 */
const BIG_SMALL: RestPolicyConfig = { kind: RestPolicyKind.BigSmallWeek, anchorWeek: '2026-W37' };

describe('previewSplit 工作日口径（T4）', () => {
  it('不传 scheduleBasis = 自然日，与显式 Calendar 逐字节一致', () => {
    const defaults = previewSplit({ startAt: START, endAt: END });
    const explicit = previewSplit({ startAt: START, endAt: END, scheduleBasis: ScheduleBasis.Calendar });
    expect(explicit).toEqual(defaults);
  });

  it('Workday + 双休：所有阶段起止均不落在休息日', () => {
    const drafts = previewSplit({
      startAt: START,
      endAt: END,
      scheduleBasis: ScheduleBasis.Workday,
      restPolicy: DEFAULT_REST_POLICY,
    });
    expect(drafts.length).toBe(9);
    for (const d of drafts) {
      expect(isRestDay(d.startAt, DEFAULT_REST_POLICY)).toBe(false);
      expect(isRestDay(d.endAt, DEFAULT_REST_POLICY)).toBe(false);
    }
  });

  it('Workday：各段工作日数之和 == 区间总工作日数（Σ守恒）', () => {
    const drafts = previewSplit({
      startAt: START,
      endAt: END,
      scheduleBasis: ScheduleBasis.Workday,
      restPolicy: DEFAULT_REST_POLICY,
    });
    const sum = drafts.reduce(
      (acc, d) => acc + countWorkdays(d.startAt, d.endAt, DEFAULT_REST_POLICY),
      0,
    );
    const total = countWorkdays(START, END, DEFAULT_REST_POLICY);
    expect(sum).toBe(total);
  });

  it('Workday：段与段在工作日轴上连续（上段结束后第 1 个工作日 == 下段开始）', () => {
    const drafts = previewSplit({
      startAt: START,
      endAt: END,
      scheduleBasis: ScheduleBasis.Workday,
      restPolicy: DEFAULT_REST_POLICY,
    });
    for (let i = 1; i < drafts.length; i += 1) {
      const nextWorkdayAfterPrevEnd = addWorkdays(drafts[i - 1].endAt, 1, DEFAULT_REST_POLICY);
      expect(drafts[i].startAt).toBe(nextWorkdayAfterPrevEnd);
    }
  });

  it('Workday + 单休：边界落在工作日（周日除外，周六可上班）', () => {
    const drafts = previewSplit({
      startAt: START,
      endAt: END,
      scheduleBasis: ScheduleBasis.Workday,
      restPolicy: SINGLE_OFF,
    });
    for (const d of drafts) {
      expect(isRestDay(d.startAt, SINGLE_OFF)).toBe(false);
      expect(isRestDay(d.endAt, SINGLE_OFF)).toBe(false);
    }
  });

  it('Workday + 大小休：边界落在工作日', () => {
    const drafts = previewSplit({
      startAt: START,
      endAt: END,
      scheduleBasis: ScheduleBasis.Workday,
      restPolicy: BIG_SMALL,
    });
    for (const d of drafts) {
      expect(isRestDay(d.startAt, BIG_SMALL)).toBe(false);
      expect(isRestDay(d.endAt, BIG_SMALL)).toBe(false);
    }
  });

  it('极端工期：区间全为周末（无任何工作日）→ 抛 Validation', () => {
    // 2026-09-05 周六 → 2026-09-06 周日
    expect(() =>
      previewSplit({
        startAt: '2026-09-05',
        endAt: '2026-09-06',
        scheduleBasis: ScheduleBasis.Workday,
        restPolicy: DEFAULT_REST_POLICY,
      }),
    ).toThrow('没有任何工作日');
  });

  it('极端工期：仅 1 个工作日 + 9 段 → 抛「总工期过短」而非产出无效数据', () => {
    // 2026-09-07 周一 → 2026-09-07 周一（单日工作日，9 段每段至少 1 天不满足）
    expect(() =>
      previewSplit({
        startAt: '2026-09-07',
        endAt: '2026-09-07',
        scheduleBasis: ScheduleBasis.Workday,
        restPolicy: DEFAULT_REST_POLICY,
      }),
    ).toThrow(/总工期过短|至少 1 天/);
  });

  it('工作日切分不超出计划结束日：跳过周末后末段 endAt ≤ END', () => {
    const workday = previewSplit({ startAt: START, endAt: END, scheduleBasis: ScheduleBasis.Workday });
    const last = workday[workday.length - 1];
    // plannedEndAt（周日）固定时，60 个工作日排完落在周五，早于计划结束日
    expect(last.endAt <= END).toBe(true);
    // 且末段 endAt 必须是工作日
    expect(isRestDay(last.endAt, DEFAULT_REST_POLICY)).toBe(false);
  });

  it('自然日口径下阶段数可 < 9（子集与工作日正交）', () => {
    const drafts = previewSplit({
      startAt: START,
      endAt: END,
      scheduleBasis: ScheduleBasis.Calendar,
      stageItems: undefined,
    });
    expect(drafts.length).toBe(9);
  });
});
