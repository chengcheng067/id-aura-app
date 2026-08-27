/**
 * 九阶段切分算法测试（架构 §3.3 必测四类）：
 *   均匀案例 / 除不尽（残差归施工图深化） / 锚点钉住 / 约束违反报错。
 */

import { describe, it, expect } from 'vitest';

import { previewSplit, addDaysIso } from '../src/core/template/split';
import { getTemplateStages } from '../src/core/template/nine-stages';
import { ChangxiaError } from '../src/core/types/enums';

describe('stage-split：均匀可整除案例', () => {
  it('100 天项目按默认占比切分，Σ段长=100 且连续无缝', () => {
    const drafts = previewSplit({ startAt: '2026-03-01', endAt: addDaysIso('2026-03-01', 99) });
    expect(drafts).toHaveLength(9);

    const total = drafts.reduce((acc, d) => acc + (dayCount(d.startAt, d.endAt)), 0);
    expect(total).toBe(100);

    // 连续性：下一段开始 = 上一段结束的次日
    for (let i = 1; i < drafts.length; i += 1) {
      expect(drafts[i].startAt).toBe(addDaysIso(drafts[i - 1].endAt, 1));
    }
    // 首尾
    expect(drafts[0].startAt).toBe('2026-03-01');
    expect(drafts[8].endAt).toBe('2026-06-08');
  });
});

describe('stage-split：除不尽（rounding 残差归施工图深化段）', () => {
  it('37 天项目：最大段吸收残差且各段至少 1 天', () => {
    const drafts = previewSplit({ startAt: '2026-01-01', endAt: '2026-02-06' }); // 37 天
    const lens = drafts.map((d) => dayCount(d.startAt, d.endAt));
    expect(lens.reduce((a, b) => a + b, 0)).toBe(37);
    for (const len of lens) expect(len).toBeGreaterThanOrEqual(1);

    // 残差吸收段（orderIndex=6 施工图深化）应 >= 其理论占比向下取整
    const theory = Math.floor((37 * 22) / 100); // = 8
    expect(lens[5]).toBeGreaterThanOrEqual(theory);
  });

  it('极短工期（10 天）：每段仍 1 天并保持 Σ==10', () => {
    const drafts = previewSplit({ startAt: '2026-05-01', endAt: '2026-05-10' });
    const total = drafts.reduce((acc, d) => acc + dayCount(d.startAt, d.endAt), 0);
    expect(total).toBe(10);
    drafts.forEach((d) => expect(dayCount(d.startAt, d.endAt)).toBeGreaterThanOrEqual(1));
  });
});

describe('stage-split：pinned 锚点钉住', () => {
  it('钉住竣工验收具体日期 → 交付段结束日与锚点一致，前后重切无缝', () => {
    const pinEnd = '2026-09-20';
    const drafts = previewSplit({
      startAt: '2026-07-01',
      endAt: '2026-11-30',
      overrides: { 8: { pinnedEndAt: pinEnd } },
    });
    const delivery = drafts.find((d) => d.orderIndex === 8);
    expect(delivery?.endAt).toBe(pinEnd);
    // 总天数守恒
    const total = drafts.reduce((acc, d) => acc + dayCount(d.startAt, d.endAt), 0);
    expect(total).toBe(dayCount('2026-07-01', '2026-11-30'));
    // 连续性保持
    for (let i = 1; i < drafts.length; i += 1) {
      expect(drafts[i].startAt).toBe(addDaysIso(drafts[i - 1].endAt, 1));
    }
  });

  it('钉住开工日期为测量段起点', () => {
    const drafts = previewSplit({
      startAt: '2026-06-01',
      endAt: '2026-06-30',
      overrides: { 2: { pinnedStartAt: '2026-06-10' } },
    });
    const measure = drafts.find((d) => d.orderIndex === 2);
    expect(measure?.startAt).toBe('2026-06-10');
  });

  it('锚点越界 → 报 Conflict', () => {
    expect(() =>
      previewSplit({
        startAt: '2026-07-01',
        endAt: '2026-08-31',
        overrides: { 8: { pinnedEndAt: '2026-12-31' } },
      }),
    ).toThrowError(/超出.*工期|工期范围/);
  });
});

describe('stage-split：约束违反报错', () => {
  it('截止早于开始 → 报 Validation', () => {
    expect(() => previewSplit({ startAt: '2026-05-10', endAt: '2026-05-01' })).toThrowError(
      ChangxiaError,
    );
  });

  it('非法日期字符串 → 报 Validation', () => {
    expect(() => previewSplit({ startAt: 'not-a-date', endAt: '2026-05-01' })).toThrowError(
      /无效/,
    );
  });

  it('draft 全部 not_started 且默认清单来自模板 JSON（铁律 9 单一来源）', () => {
    const tpl = getTemplateStages();
    const drafts = previewSplit({ startAt: '2026-04-01', endAt: '2026-07-30' });
    drafts.forEach((d) => {
      expect(d.status).toBe('not_started');
      const tplStage = tpl.find((t) => t.orderIndex === d.orderIndex);
      expect(d.name).toBe(tplStage?.name);
      expect(d.defaultTasks).toEqual(tplStage?.defaultTasks);
    });
  });
});

/** 含头尾天数 */
function dayCount(startIso: string, endIso: string): number {
  return (
    Math.round(
      (new Date(`${endIso}T00:00:00Z`).getTime() - new Date(`${startIso}T00:00:00Z`).getTime()) /
        86400000,
    ) + 1
  );
}
