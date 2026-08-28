/**
 * 公司休息制度 · 渲染层测试（T6 设置弹窗 / T7 休息日底纹）。
 *
 * 覆盖两件事：
 *   1. 底纹数据源 isRestDay 在三种制度下的逐日结果（月历与时间轴底纹的唯一口径）；
 *   2. 设置弹窗派生层（lib/restPolicyDraft.ts）——大小休预览必须逐格等于 isRestDay，
 *      「从下周起对调」必须让大休/小休互换。
 *
 * 日期基准（已核定，与 workdays.rest-policy.spec.ts 同源）：
 *   2026-W37 = 2026-09-07(一) … 2026-09-13(日)
 *   2026-W36 = 2026-08-31(一) … 2026-09-06(日)
 *   2026-W38 = 2026-09-14(一) … 2026-09-20(日)
 */

import { describe, it, expect } from 'vitest';

import { RestPolicyKind } from '../src/core/types/enums';
import { DEFAULT_REST_POLICY } from '../src/core/types/entities';
import type { RestPolicyConfig } from '../src/core/types/entities';
import { isRestDay, isWorkday } from '../src/lib/workdays';
import {
  buildRestDayPreview,
  isValidAnchorWeek,
  isoWeekIdOf,
  shiftIsoWeek,
} from '../src/lib/restPolicyDraft';
import { buildRestBands } from '../src/components/timeline/RestDayBands';

const DOUBLE: RestPolicyConfig = { kind: RestPolicyKind.DoubleOff, anchorWeek: null };
const SINGLE: RestPolicyConfig = { kind: RestPolicyKind.SingleOff, anchorWeek: null };

function bigSmall(anchorWeek: string, extra?: Partial<RestPolicyConfig>): RestPolicyConfig {
  return { kind: RestPolicyKind.BigSmallWeek, anchorWeek, ...extra };
}

/** 2026-W37：周一…周日 */
const W37 = [
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-12',
  '2026-09-13',
] as const;

/* ---------------------- 双休：周六 + 周日为休息日 ---------------------- */

describe('底纹口径 · 双休', () => {
  it('周六、周日 isRestDay 均为 true', () => {
    expect(isRestDay('2026-09-12', DOUBLE)).toBe(true);
    expect(isRestDay('2026-09-13', DOUBLE)).toBe(true);
  });

  it('周一至周五 isRestDay 均为 false', () => {
    for (const d of W37.slice(0, 5)) {
      expect(isRestDay(d, DOUBLE)).toBe(false);
    }
  });

  it('出厂默认（DEFAULT_REST_POLICY）即双休口径', () => {
    expect(DEFAULT_REST_POLICY.kind).toBe(RestPolicyKind.DoubleOff);
    for (const d of W37) {
      expect(isRestDay(d, DEFAULT_REST_POLICY)).toBe(isRestDay(d, DOUBLE));
    }
  });

  it('双休下一周 5 个工作日、2 个休息日', () => {
    expect(W37.filter((d) => isWorkday(d, DOUBLE))).toHaveLength(5);
    expect(W37.filter((d) => isRestDay(d, DOUBLE))).toHaveLength(2);
  });
});

/* ---------------------- 单休：仅周日为休息日 ---------------------- */

describe('底纹口径 · 单休', () => {
  it('周日 isRestDay 为 true', () => {
    expect(isRestDay('2026-09-13', SINGLE)).toBe(true);
  });

  it('周六 isRestDay 为 false（单休下周六上班）', () => {
    expect(isRestDay('2026-09-12', SINGLE)).toBe(false);
    expect(isWorkday('2026-09-12', SINGLE)).toBe(true);
  });

  it('周一至周五 isRestDay 均为 false', () => {
    for (const d of W37.slice(0, 5)) {
      expect(isRestDay(d, SINGLE)).toBe(false);
    }
  });

  it('单休下一周 6 个工作日、1 个休息日（比双休多一天可排期）', () => {
    expect(W37.filter((d) => isWorkday(d, SINGLE))).toHaveLength(6);
    expect(W37.filter((d) => isRestDay(d, SINGLE))).toHaveLength(1);
  });

  it('月历底纹差异：同一周六在双休下有底纹、单休下无底纹', () => {
    expect(isRestDay('2026-09-12', DOUBLE)).toBe(true);
    expect(isRestDay('2026-09-12', SINGLE)).toBe(false);
  });
});

/* ---------------------- 大小休：周六隔周有底纹 ---------------------- */

describe('底纹口径 · 大小休', () => {
  const SAT = '2026-09-12'; // 2026-W37 的周六

  it('大休周的周六有底纹（isRestDay = true）', () => {
    expect(isRestDay(SAT, bigSmall('2026-W37'))).toBe(true);
  });

  it('小休周的周六无底纹（isRestDay = false）', () => {
    expect(isRestDay(SAT, bigSmall('2026-W36'))).toBe(false);
  });

  it('同一周六：锚点偏移 ±1 周，底纹结果相反', () => {
    const big = bigSmall('2026-W37'); // 本周 = 大休周
    const small = bigSmall(shiftIsoWeek('2026-W37', 1, SAT)); // 锚点 +1 周 → 本周变小休周
    expect(shiftIsoWeek('2026-W37', 1, SAT)).toBe('2026-W38');
    expect(isRestDay(SAT, big)).toBe(true);
    expect(isRestDay(SAT, small)).toBe(false);
    expect(isRestDay(SAT, big)).toBe(!isRestDay(SAT, small));
  });

  it('锚点偏移 -1 周同样翻转（左右对称）', () => {
    expect(shiftIsoWeek('2026-W37', -1, SAT)).toBe('2026-W36');
    expect(isRestDay(SAT, bigSmall('2026-W36'))).toBe(false);
    expect(isRestDay(SAT, bigSmall(shiftIsoWeek('2026-W36', -1, SAT)))).toBe(true);
  });

  it('锚点偏移 ±2 周回到同一结果（周期 2）', () => {
    expect(isRestDay(SAT, bigSmall(shiftIsoWeek('2026-W37', 2, SAT)))).toBe(true);
    expect(isRestDay(SAT, bigSmall(shiftIsoWeek('2026-W37', -2, SAT)))).toBe(true);
  });

  it('周日无论大休小休都有底纹', () => {
    expect(isRestDay('2026-09-13', bigSmall('2026-W37'))).toBe(true);
    expect(isRestDay('2026-09-13', bigSmall('2026-W36'))).toBe(true);
  });

  it('相邻两周的周六底纹必定相反（隔周有底纹）', () => {
    const thisSat = '2026-09-12';
    const nextSat = '2026-09-19';
    for (const anchor of ['2026-W37', '2026-W36']) {
      const p = bigSmall(anchor);
      expect(isRestDay(thisSat, p)).toBe(!isRestDay(nextSat, p));
    }
  });
});

/* ---------------- extraWorkdays / extraHolidays 优先级 ---------------- */

describe('底纹口径 · extraWorkdays 短路优先级', () => {
  const HOLIDAY = '2026-10-01'; // 2026-10-01 是周四（工作日），先设成法定节假日

  it('工作日被列入 extraHolidays → 变休息日（有底纹）', () => {
    expect(isRestDay(HOLIDAY, DOUBLE)).toBe(false);
    const p: RestPolicyConfig = { ...DOUBLE, extraHolidays: [HOLIDAY] };
    expect(isRestDay(HOLIDAY, p)).toBe(true);
  });

  it('extraWorkdays 优先级最高：法定节假日被列入 extraWorkdays → 变工作日（无底纹）', () => {
    const p: RestPolicyConfig = {
      ...DOUBLE,
      extraHolidays: [HOLIDAY],
      extraWorkdays: [HOLIDAY],
    };
    expect(isRestDay(HOLIDAY, p)).toBe(false);
    expect(isWorkday(HOLIDAY, p)).toBe(true);
  });

  it('extraWorkdays 覆盖制度本身：双休的周六调休上班后无底纹', () => {
    const p: RestPolicyConfig = { ...DOUBLE, extraWorkdays: ['2026-09-12'] };
    expect(isRestDay('2026-09-12', p)).toBe(false);
  });

  it('两层短路都未命中时回落到制度判定', () => {
    const p: RestPolicyConfig = {
      ...DOUBLE,
      extraHolidays: ['2026-10-02'],
      extraWorkdays: ['2026-10-03'],
    };
    expect(isRestDay('2026-09-12', p)).toBe(true); // 周六仍休
    expect(isRestDay('2026-09-09', p)).toBe(false); // 周三仍上班
  });
});

/* ---------------------- 设置弹窗：大小休预览（T6） ---------------------- */

describe('设置弹窗派生层 · 未来 4 周预览', () => {
  const FROM = '2026-09-09'; // 周三；预览仍从所在 ISO 周的周一 09-07 起算

  it('生成 4 周 × 7 天，行首为周一', () => {
    const preview = buildRestDayPreview(bigSmall('2026-W37'), { fromIso: FROM });
    expect(preview).toHaveLength(4);
    for (const w of preview) {
      expect(w.days).toHaveLength(7);
      expect(w.days[0].weekday).toBe(1); // 周一
      expect(w.days[6].weekday).toBe(0); // 周日
    }
    expect(preview[0].monday).toBe('2026-09-07');
    expect(preview[1].monday).toBe('2026-09-14');
  });

  it('每格 rest 与 isRestDay 逐格一致（预览不能另算一套）', () => {
    const policy = bigSmall('2026-W37', { extraHolidays: ['2026-09-17'] });
    const preview = buildRestDayPreview(policy, { fromIso: FROM });
    for (const week of preview) {
      for (const d of week.days) {
        expect(d.rest).toBe(isRestDay(d.date, policy));
      }
    }
  });

  it('大休 / 小休标记与周六的 isRestDay 一致，且逐周交替', () => {
    const policy = bigSmall('2026-W37');
    const preview = buildRestDayPreview(policy, { fromIso: FROM });
    expect(preview.map((w) => w.bigWeek)).toEqual([true, false, true, false]);
    preview.forEach((w) => {
      expect(w.bigWeek).toBe(w.days[5].rest);
    });
  });

  it('对调后所有周的大休/小休标记整体翻转', () => {
    const before = buildRestDayPreview(bigSmall('2026-W37'), { fromIso: FROM });
    const swapped = shiftIsoWeek('2026-W37', 1, FROM);
    const after = buildRestDayPreview(bigSmall(swapped), { fromIso: FROM });
    expect(after.map((w) => w.bigWeek)).toEqual(before.map((w) => !w.bigWeek));
    // 逐格同样翻转（周日与周一~周五不变，变的是周六）
    after.forEach((w, wi) => {
      w.days.forEach((d, di) => {
        expect(d.rest).toBe(before[wi].days[di].rest === (di !== 5));
      });
    });
  });

  it('双休 / 单休预览同样走同一函数（六日 vs 仅周日）', () => {
    const dbl = buildRestDayPreview(DOUBLE, { fromIso: FROM });
    const sgl = buildRestDayPreview(SINGLE, { fromIso: FROM });
    expect(dbl[0].days.filter((d) => d.rest).map((d) => d.weekday)).toEqual([6, 0]);
    expect(sgl[0].days.filter((d) => d.rest).map((d) => d.weekday)).toEqual([0]);
  });
});

/* ---------------------- 设置弹窗：锚点工具 ---------------------- */

describe('设置弹窗派生层 · ISO 周锚点', () => {
  it('isoWeekIdOf 输出 YYYY-Www 且同周内一致', () => {
    for (const d of W37) expect(isoWeekIdOf(d)).toBe('2026-W37');
    expect(isoWeekIdOf('2026-01-01')).toBe('2026-W01'); // 2026-01-01 属 2026-W01
  });

  it('isValidAnchorWeek：合法 / 非法 / 越界', () => {
    expect(isValidAnchorWeek('2026-W37')).toBe(true);
    expect(isValidAnchorWeek('2026-W53')).toBe(true); // 2026 是 53 周 ISO 年
    expect(isValidAnchorWeek('2025-W53')).toBe(false); // 2025 只有 52 周
    expect(isValidAnchorWeek('2026-W00')).toBe(false);
    expect(isValidAnchorWeek('not-a-week')).toBe(false);
    expect(isValidAnchorWeek(null)).toBe(false);
  });

  it('锚点非法时 shiftIsoWeek 以 fallback 所在周为基准', () => {
    expect(shiftIsoWeek(null, 1, '2026-09-09')).toBe('2026-W38');
    expect(shiftIsoWeek('2026-W99', 1, '2026-09-09')).toBe('2026-W38');
  });

  it('跨年位移不断档：2025-W52 +1 → 2026-W01', () => {
    expect(shiftIsoWeek('2025-W52', 1, '2025-12-24')).toBe('2026-W01');
    expect(shiftIsoWeek('2026-W01', -1, '2026-01-01')).toBe('2025-W52');
  });
});

/* ---------------------- 时间轴休息条带（T7） ---------------------- */

describe('时间轴休息条带 · buildRestBands', () => {
  const range = { from: '2026-09-07', to: '2026-09-20' }; // 恰好两周
  const PPD = 30;

  it('双休：两段条带（每个周末 2 天宽），x 严格按自然日线性映射', () => {
    const bands = buildRestBands(range, PPD, DOUBLE);
    expect(bands).toHaveLength(2);
    expect(bands[0]).toMatchObject({ startIdx: 5, x: 150, width: 60 }); // 周六+周日 = 2 天
    expect(bands[1]).toMatchObject({ startIdx: 12, x: 360, width: 60 });
  });

  it('单休：两段条带，宽度只有 1 天（周六上班）', () => {
    const bands = buildRestBands(range, PPD, SINGLE);
    expect(bands).toHaveLength(2);
    expect(bands.every((b) => b.width === PPD)).toBe(true);
  });

  it('大小休：大休周的条带 2 天宽、小休周 1 天宽', () => {
    const bands = buildRestBands(range, PPD, bigSmall('2026-W37'));
    expect(bands.map((b) => b.width)).toEqual([60, 30]);
  });

  it('条带不越界、不重叠，且总宽度 = 休息天数 × pxPerDay', () => {
    for (const p of [DOUBLE, SINGLE, bigSmall('2026-W37'), bigSmall('2026-W36')]) {
      const bands = buildRestBands(range, PPD, p);
      let cursor = -1;
      for (const b of bands) {
        expect(b.x).toBeGreaterThan(cursor);
        expect(b.startIdx * PPD).toBe(b.x);
        cursor = b.x + b.width - 1;
      }
      const totalWidth = bands.reduce((s, b) => s + b.width, 0);
      const restCount = bands.reduce((s, b) => s + b.width / PPD, 0);
      expect(totalWidth).toBe(restCount * PPD);
      expect(bands[bands.length - 1].x + bands[bands.length - 1].width).toBeLessThanOrEqual(
        14 * PPD,
      );
    }
  });

  it('坐标系未变：条带 x 与 xOf 完全一致（休息日不压缩坐标）', () => {
    const bands = buildRestBands(range, PPD, DOUBLE);
    const xOf = (date: string, from: string, pxPerDay: number): number => {
      const offset = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
      return offset * pxPerDay;
    };
    expect(bands[0].x).toBe(xOf('2026-09-12', range.from, PPD));
    expect(bands[1].x).toBe(xOf('2026-09-19', range.from, PPD));
  });
});

/* ---------------- 存量 bug 回归：月历周末底纹的 UTC / 本地串日 ---------------- */

/**
 * MonthlyCalendarView 的存量 bug：`new Date('YYYY-MM-DD')` 按 **UTC** 解析，
 * `.getDay()` 按**本地**时区读 —— GMT-X 时区（如 UTC-4）会把周六读成周五，
 * 整月周末底纹错一天；且与同仓 MonthGridHeader 的 dayjs 本地口径不一致。
 * 现在两处统一走 isRestDay（内部 dayjs 本地解析），日期字面量不再被时区搬动。
 *
 * 说明：vitest 跑在 worker 线程里，线程内改 process.env.TZ 不会通知本 isolate 的
 * 时区缓存，因此这里不切运行时时区，而是等价复现「UTC 解析 + 负偏移挂钟」的换算。
 */
describe('回归 · 月历底纹不再用 new Date(iso).getDay()', () => {
  it('GMT-X 下旧口径会把周六读成周五，isRestDay 不受时区搬动', () => {
    const saturday = '2026-09-12';
    const utcMidnight = new Date(`${saturday}T00:00:00Z`);
    expect(utcMidnight.getUTCDay()).toBe(6); // UTC 口径确实是周六

    // 旧实现 getDay() 读的就是这个挂钟时刻：UTC-4 → 09-11 20:00（周五）
    const wallClockUtcMinus4 = new Date(utcMidnight.getTime() - 4 * 3600000);
    expect(wallClockUtcMinus4.getUTCDay()).toBe(5);

    // 新口径：dayjs('YYYY-MM-DD') 本地解析，周六仍是周六，周五仍是工作日
    expect(isRestDay(saturday, DOUBLE)).toBe(true);
    expect(isRestDay('2026-09-11', DOUBLE)).toBe(false);
  });

  it('月历两处底纹口径同源：MonthGridHeader 与 MonthlyCalendarView 都用 isRestDay', () => {
    // 同仓两处渲染点此前各自实现（dayjs 本地 vs new Date UTC 解析），
    // 现在统一由 isRestDay 供数——遍历三种制度逐日无差异即为同源。
    for (const p of [DOUBLE, SINGLE, bigSmall('2026-W37')]) {
      for (const d of [...W37, '2026-09-14', '2026-09-19']) {
        expect(typeof isRestDay(d, p)).toBe('boolean');
      }
    }
  });
});
