import type { Project, Stage } from '../../core/types/entities';
import { dayjs, totalDaysInclusive, remainingDays } from '../../lib/date';
import {
  pickActiveStage,
  computeProjectPercent,
  computeProjectStatus,
  type ProjectCalendarStatus,
} from '../../lib/progress';
import { COMPLETED_COLOR, NOT_STARTED_COLOR, OVERDUE_COLOR, stageColorOf } from './calendarColors';

/**
 * 月历甘特纯计算层（组件与单测共用，零 DOM 依赖）。
 * 坐标数学复用 lib/date 的口径（铁律 2 / 10）：列=当月日期，pxPerDay 退化为百分比定位。
 */

/** 月历筛选状态键（与 PRD §3.4 文案一一对应） */
export type CalendarFilterStatus = 'in_progress' | 'completed' | 'overdue' | 'not_started';

/** 月历筛选条件（与 useUiStore.calendarFilters 同构） */
export interface CalendarFilters {
  status: Set<CalendarFilterStatus>;
  stage: Set<number>;
}

/** 当月元信息（列数、边界、今日位置） */
export interface CalendarMonthMeta {
  year: number;
  month: number; // 1-12
  monthStart: string; // 'YYYY-MM-01'
  monthEnd: string; // 'YYYY-MM-DD'（末日）
  daysInMonth: number; // 28~31
  label: string; // '2026年9月'
  todayIso: string;
  todayInMonth: boolean;
  todayIdx: number; // 0-based 当日列序号；不在当月为 -1
}

/** 单项目月历行派生结果 */
export interface CalendarEntry {
  project: Project;
  stages: Stage[];
  activeStage: Stage | null;
  status: ProjectCalendarStatus;
  /** 派生「当前进度位置」日期（PRD §4.1） */
  progressDate: string;
  /** 裁切到当月后的色带起止（'YYYY-MM-DD'） */
  bandStart: string;
  bandEnd: string;
  percent: number;
  daysElapsed: number;
  daysRemaining: number;
  /** 用于阶段筛选的「当前阶段序号」：激活阶段 orderIndex / 已完成→9 / 未开始→1 */
  filterStageIndex: number;
  /** 已解析色带填充 hex（来自 calendarColors 镜像） */
  color: string;
  /** 未开始幽灵态（仅画起点小圆，无延伸） */
  isGhost: boolean;
}

/** 空筛选条件（瞬态初值） */
export const EMPTY_FILTERS: CalendarFilters = { status: new Set(), stage: new Set() };

/** 状态筛选中文标签（图例 / 筛选 chip 共用） */
export const STATUS_LABELS: Record<CalendarFilterStatus, string> = {
  in_progress: '进行中',
  completed: '已完成',
  overdue: '逾期',
  not_started: '未开始',
};

/** 由 'YYYY-MM' 构建当月元信息（todayIso 可注入，测试幂等） */
export function buildMonthMeta(calendarMonth: string, todayIso?: string): CalendarMonthMeta {
  const ym = /^(\d{4})-(\d{2})$/.exec(calendarMonth);
  const year = ym ? Number(ym[1]) : dayjs().year();
  const month = ym ? Number(ym[2]) : dayjs().month() + 1;
  const monthStart = `${calendarMonth}-01`;
  const end = dayjs(monthStart).endOf('month');
  const monthEnd = end.format('YYYY-MM-DD');
  const daysInMonth = totalDaysInclusive(monthStart, monthEnd);
  const today = todayIso ?? dayjs().format('YYYY-MM-DD');
  const todayInMonth = today >= monthStart && today <= monthEnd;
  const todayIdx = todayInMonth ? totalDaysInclusive(monthStart, today) - 1 : -1;
  const label = dayjs(monthStart).format('YYYY年M月');
  return { year, month, monthStart, monthEnd, daysInMonth, label, todayIso: today, todayInMonth, todayIdx };
}

/** 整月平移（delta 月，跨年自动进位；‹ › 切换与键盘 ←/→ 复用） */
export function shiftMonth(calendarMonth: string, delta: number): string {
  return dayjs(`${calendarMonth}-01`).add(delta, 'month').format('YYYY-MM');
}

/** 日期裁剪到 [min, max]（ISO 字符串字典序即时间序，'YYYY-MM-DD' 安全） */
export function clampDate(date: string, min: string, max: string): string {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

/** 当月内 0-based 列序号（越界裁切到 [0, daysInMonth-1]） */
export function dayIndexInMonth(date: string, meta: CalendarMonthMeta): number {
  const raw = totalDaysInclusive(meta.monthStart, clampDate(date, meta.monthStart, meta.monthEnd)) - 1;
  return Math.max(0, Math.min(meta.daysInMonth - 1, raw));
}

/** 色带几何（百分比定位，供 CSS left/width 使用） */
export interface BandGeometry {
  leftPct: number;
  widthPct: number;
  startIdx: number;
  endIdx: number;
  /** 末端点（进度位置）百分比定位 */
  dotLeftPct: number;
}

export function bandGeometry(entry: CalendarEntry, meta: CalendarMonthMeta): BandGeometry {
  const startIdx = dayIndexInMonth(entry.bandStart, meta);
  const endIdx = dayIndexInMonth(entry.bandEnd, meta);
  const days = meta.daysInMonth;
  const leftPct = (startIdx / days) * 100;
  const widthPct = ((endIdx - startIdx + 1) / days) * 100;
  return { leftPct, widthPct, startIdx, endIdx, dotLeftPct: (endIdx / days) * 100 };
}

/**
 * 单项目月历行派生（PRD §4.1 / §4.2 / §4.3）：
 * - 进度日期 progressDate：全部完成→plannedEndAt；未开始→plannedStartAt；
 *   否则 clamp(今天, activeStage.start, activeStage.end)。
 * - 色带裁切到当月边界；逾期以「今天」为下界强提示（覆盖整条色带）。
 * - 颜色：进行中=阶段莫兰迪色；已完成=s9；逾期=clay；未开始=mist 幽灵态。
 * - 百分比：已完成可见阶段 / 可见阶段 × 100（MVP，对齐详情页完成环）。
 */
export function computeCalendarEntry(
  project: Project,
  stages: Stage[],
  meta: CalendarMonthMeta,
): CalendarEntry {
  const visible = stages.filter((s) => s.visible !== false);
  const activeStage = pickActiveStage(stages, meta.todayIso);
  const status = computeProjectStatus(project, stages, meta.todayIso);
  const today = meta.todayIso;

  let progressDate: string;
  if (status === 'completed') progressDate = project.plannedEndAt;
  else if (status === 'not_started') progressDate = project.plannedStartAt;
  else if (activeStage)
    progressDate = clampDate(today, activeStage.startAt.slice(0, 10), activeStage.endAt.slice(0, 10));
  else progressDate = today;

  const bandStart = clampDate(project.plannedStartAt, meta.monthStart, meta.monthEnd);
  // 逾期：以 today 为下界，确保色带延伸到今天（强提示）
  const rawEnd =
    status === 'overdue'
      ? clampDate(maxDate(progressDate, today), meta.monthStart, meta.monthEnd)
      : clampDate(progressDate, meta.monthStart, meta.monthEnd);
  const bandEnd = rawEnd < bandStart ? bandStart : rawEnd;

  const percent = computeProjectPercent(stages);
  const daysElapsed = today >= project.plannedStartAt ? totalDaysInclusive(project.plannedStartAt, today) : 0;
  const daysRemaining = remainingDays(project.plannedEndAt, today);

  const filterStageIndex = activeStage?.orderIndex ?? (status === 'completed' ? 9 : 1);

  let color: string;
  let isGhost = false;
  switch (status) {
    case 'in_progress':
      color = activeStage ? stageColorOf(activeStage.orderIndex, activeStage.colorIndex) : COMPLETED_COLOR;
      break;
    case 'completed':
      color = COMPLETED_COLOR;
      break;
    case 'overdue':
      color = OVERDUE_COLOR;
      break;
    case 'not_started':
      color = NOT_STARTED_COLOR;
      isGhost = true;
      break;
  }

  return {
    project,
    stages,
    activeStage,
    status,
    progressDate,
    bandStart,
    bandEnd,
    percent,
    daysElapsed,
    daysRemaining,
    filterStageIndex,
    color,
    isGhost,
  };
}

/**
 * 月历行级筛选（PRD §3.4）：组间 AND、组内 OR。
 * 状态组非空 → 仅保留 status ∈ 集合；阶段组非空 → 仅保留 filterStageIndex ∈ 集合；
 * 两组均空 → 全部保留。
 */
export function filterEntries(entries: CalendarEntry[], filters: CalendarFilters): CalendarEntry[] {
  const statusOn = filters.status.size > 0;
  const stageOn = filters.stage.size > 0;
  if (!statusOn && !stageOn) return entries;
  return entries.filter((e) => {
    const statusOk = !statusOn || filters.status.has(e.status);
    const stageOk = !stageOn || filters.stage.has(e.filterStageIndex);
    return statusOk && stageOk;
  });
}
