import { useEffect, useMemo } from 'react';

import { useNavigate } from 'react-router-dom';

import type { Member, Project, Stage, Task } from '../../core/types/entities';
import { useUiStore } from '../../store/useUiStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { useMembersStore } from '../../store/useMembersStore';
import { useRoleGuard, isRestrictedView, computeRelatedStageIds } from '../../hooks/useRoleGuard';
import { cn } from '../../lib/cn';
import {
  buildMonthMeta,
  shiftMonth,
  computeCalendarEntry,
  filterEntries,
  type CalendarEntry,
  type CalendarMonthMeta,
} from './calendarMath';
import { MonthGridHeader } from './MonthGridHeader';
import { ProjectBandRow } from './ProjectBandRow';
import { CalendarLegend } from './CalendarLegend';
import { CalendarFilters } from './CalendarFilters';

/** 布局常量（与 MonthGridHeader / ProjectBandRow 共用） */
const LEFT_W = 240;
const COL_W = 34;
const ROW_H = 44;

type EmptyKind = 'E1' | 'E2' | 'E3' | 'E4' | null;

/**
 * 月历甘特容器（PRD §2 / §3）：月切换 + 图例 + 筛选 + 网格 + 行渲染 + 空状态。
 * 组合级跨项目视图，零侵入既有看板 / 九阶段时间轴。
 */
export function MonthlyCalendarView({ onManual }: { onManual?(): void }): JSX.Element {
  const navigate = useNavigate();
  const calendarMonth = useUiStore((s) => s.calendarMonth);
  const setCalendarMonth = useUiStore((s) => s.setCalendarMonth);
  const filters = useUiStore((s) => s.calendarFilters);
  const toggleStatus = useUiStore((s) => s.toggleCalendarStatusFilter);
  const toggleStage = useUiStore((s) => s.toggleCalendarStageFilter);
  const clearFilters = useUiStore((s) => s.clearCalendarFilters);

  const projects = useProjectsStore((s) => s.projects);
  const stages = useProjectsStore((s) => s.stages);
  const tasks = useProjectsStore((s) => s.tasks);
  const members = useMembersStore((s) => s.members);

  const { role, currentMember } = useRoleGuard();
  const memberView = isRestrictedView(role);

  const meta: CalendarMonthMeta = useMemo(() => buildMonthMeta(calendarMonth), [calendarMonth]);

  const active = useMemo(() => projects.filter((p) => p.status === 'active'), [projects]);

  // 成员受限视图：仅保留「成员有相关阶段」的项目（R2：成员按相关阶段集合过滤行）
  const currentMemberId = currentMember?.id ?? null;
  const stagesOf = (p: Project): Stage[] => stages.filter((s) => s.projectId === p.id);
  const tasksOf = (p: Project): Task[] => tasks.filter((t) => t.projectId === p.id);

  const baseEntries: CalendarEntry[] = useMemo(() => {
    return active
      .filter((p) => p.plannedStartAt <= meta.monthEnd && p.plannedEndAt >= meta.monthStart)
      .filter((p) => {
        if (!memberView) return true;
        const ids = computeRelatedStageIds({
          memberView: true,
          currentMemberId,
          stages: stagesOf(p),
          tasks: tasksOf(p),
        });
        if (!ids) return true;
        return p
          .id
          ? stagesOf(p).some((s) => ids.has(s.id))
          : false;
      })
      .map((p) => computeCalendarEntry(p, stagesOf(p), meta));
  }, [active, meta, memberView, currentMemberId, stages, tasks]);

  const finalEntries = useMemo(() => filterEntries(baseEntries, filters), [baseEntries, filters]);

  // 空状态判定（PRD §3.6，优先级 E3 > E2/E4 > E1）
  const emptyKind: EmptyKind = useMemo(() => {
    if (active.length === 0) return 'E1';
    if (baseEntries.length === 0) return memberView ? 'E4' : 'E2';
    if (finalEntries.length === 0) return 'E3';
    return null;
  }, [active.length, baseEntries.length, finalEntries.length, memberView]);

  // 键盘 ←/→ 整月切换（与旧时间轴方向一致；输入框聚焦时不拦截）
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCalendarMonth(shiftMonth(calendarMonth, -1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCalendarMonth(shiftMonth(calendarMonth, 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [calendarMonth, setCalendarMonth]);

  const thisMonth = ((): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const open = (projectId: string): void => navigate(`/project/${projectId}`);

  return (
    <div className="space-y-4">
      {/* 月切换控件 + 密度占位（P2） */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}
            aria-label="上个月"
            className="rounded-md border border-sand bg-paper px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-sand"
          >
            ‹
          </button>
          <h2 className="min-w-[120px] text-center font-display text-display-md text-ink">{meta.label}</h2>
          <button
            type="button"
            onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}
            aria-label="下个月"
            className="rounded-md border border-sand bg-paper px-2.5 py-1.5 text-sm text-ink transition-colors hover:bg-sand"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setCalendarMonth(thisMonth)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors',
              calendarMonth === thisMonth
                ? 'border-pine bg-pine-soft text-pine-deep'
                : 'border-sand bg-paper text-mist hover:bg-sand hover:text-ink',
            )}
          >
            今天
          </button>
        </div>

        {/* 密度切换占位（P2：仅预留控件位，不实现缩放） */}
        <span
          title="周/日 密度切换（P2 敬请期待）"
          className="cursor-default select-none rounded-md border border-sand bg-paper px-3 py-1.5 text-xs text-mist"
        >
          周/日 ▾
        </span>
      </div>

      {/* 图例 */}
      <CalendarLegend />

      {/* 筛选 */}
      <CalendarFilters
        filters={filters}
        onToggleStatus={toggleStatus}
        onToggleStage={toggleStage}
        onClear={clearFilters}
      />

      {/* 网格 / 空状态 */}
      {emptyKind ? (
        <EmptyState kind={emptyKind} monthLabel={meta.label} onClear={clearFilters} onManual={onManual} />
      ) : (
        <div className="glass-medium overflow-x-auto rounded-lg border border-sand bg-paper shadow-soft">
          <div style={{ width: LEFT_W + meta.daysInMonth * COL_W, minWidth: '100%' }}>
            <MonthGridHeader meta={meta} colWidth={COL_W} leftWidth={LEFT_W} />
            {finalEntries.map((entry) => (
              <ProjectBandRow
                key={entry.project.id}
                entry={entry}
                meta={meta}
                colWidth={COL_W}
                leftWidth={LEFT_W}
                rowHeight={ROW_H}
                isAdmin={!memberView}
                members={members}
                onOpen={open}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 四类空状态（PRD §3.6） */
function EmptyState({
  kind,
  monthLabel,
  onClear,
  onManual,
}: {
  kind: EmptyKind;
  monthLabel: string;
  onClear(): void;
  onManual?(): void;
}): JSX.Element {
  const config: Record<Exclude<EmptyKind, null>, { title: string; desc: string; cta?: 'clear' | 'manual' }> = {
    E1: {
      title: '还没有进行中的项目',
      desc: '用顶部「新建项目 → 导入合同建档」粘贴合同文本试试；任何情况下都可以先手动建档。',
      cta: 'manual',
    },
    E2: {
      title: `${monthLabel} 暂无进行中的项目`,
      desc: '当前月份没有跨月推进的项目，换个时间段看看，或检查项目计划日期。',
    },
    E3: {
      title: '没有符合筛选条件的项目',
      desc: '试着放宽状态或阶段筛选条件。',
      cta: 'clear',
    },
    E4: {
      title: '该项目的阶段与你无关',
      desc: '你当前身份下没有可查看的相关阶段，请先进入对应身份。',
    },
  };

  const c = config[kind as Exclude<EmptyKind, null>];

  return (
    <div className="glass-light rounded-lg border border-dashed border-sand p-10 text-center">
      <p className="font-display text-display-md text-mist">{c.title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-mist">{c.desc}</p>
      {c.cta === 'clear' && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 rounded-md border border-pine px-4 py-2 text-sm text-pine hover:bg-pine-soft"
        >
          清除筛选
        </button>
      )}
      {c.cta === 'manual' && (
        <button
          type="button"
          onClick={() => onManual?.()}
          className="mt-4 rounded-md border border-pine px-4 py-2 text-sm text-pine hover:bg-pine-soft"
        >
          直接手动建档
        </button>
      )}
    </div>
  );
}
