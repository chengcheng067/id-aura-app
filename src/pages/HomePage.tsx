import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { ProjectCard } from '../components/project/ProjectCard';
import { StatCard } from '../components/project/StatCard';
import { ArchiveListRow } from '../components/project/ArchiveListRow';
import { MembersPageSection } from '../components/member/MembersPageSection';
import { ManualFallbackForm } from '../components/contract-wizard/ManualFallbackForm';
import { subscribeManualForm } from '../components/project/NewProjectMenu';
import { MonthlyCalendarView } from '../components/calendar/MonthlyCalendarView';
import { useProjectsStore } from '../store/useProjectsStore';
import { useMembersStore } from '../store/useMembersStore';
import { useUiStore } from '../store/useUiStore';
import { useRoleGuard } from '../hooks/useRoleGuard';
import { computeProjectStatus, currentStageOf } from '../lib/progress';
import { StageStatus } from '../core/types/enums';
import type { Project, Stage, Task } from '../core/types/entities';

/**
 * 首页（严格对齐参考稿 §统计概览行 + §四列 Kanban）：
 *   概览行 = 4 张指标玻璃卡（进行中 / 本周到期 / 逾期风险 / 本月完工，数据全部派生、不伪造趋势）；
 *   主体 = 四列看板（待启动 / 设计中 / 深化中 / 施工中），列头 = 语义色圆点 + 列名 + 数量徽章。
 * 列归属按「当前阶段 orderIndex」分桶：未开始→待启动；①~③→设计中；④~⑥→深化中；⑦~⑨（含全完成）→施工中。
 * 视图开关已上移到 TopBar（参考稿应用栏形态），全局搜索按项目名 / 客户名过滤。
 */
export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const projects = useProjectsStore((s) => s.projects);
  const stages = useProjectsStore((s) => s.stages);
  const tasks = useProjectsStore((s) => s.tasks);
  const members = useMembersStore((s) => s.members);
  const { isAdmin } = useRoleGuard();
  const homeViewMode = useUiStore((s) => s.homeViewMode);
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const selectedProjectId = useUiStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useUiStore((s) => s.setSelectedProjectId);

  // 手动建档显隐：本地 state + 订阅顶栏菜单广播
  const [manualOpen, setManualOpen] = useState(false);
  useEffect(() => subscribeManualForm(setManualOpen), []);

  const today = new Date();
  const todayIso = localIso(today);
  const active = projects.filter((p) => p.status === 'active');
  const archived = projects.filter((p) => p.status !== 'active');

  const stagesOf = (p: Project): Stage[] => stages.filter((s) => s.projectId === p.id);
  const tasksOf = (p: Project): Task[] => tasks.filter((t) => t.projectId === p.id);

  // 全局搜索：项目名 / 客户名（成员受限视图不按客户名搜，避免绕过脱敏）
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? active.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (isAdmin && (p.clientName ?? '').toLowerCase().includes(q)),
      )
    : active;

  // 四列分桶
  const buckets = groupByColumn(filtered, stagesOf, todayIso);

  // 指标卡（全部派生自 stages / projects，无历史趋势数据则不显示趋势）
  const weekStart = startOfWeekIso(today);
  const weekEnd = endOfWeekIso(today);
  const monthPrefix = todayIso.slice(0, 7);
  const visibleStages = stages.filter((s) => s.visible !== false);
  const dueThisWeek = visibleStages.filter(
    (s) =>
      s.status !== StageStatus.Completed &&
      s.endAt.slice(0, 10) >= weekStart &&
      s.endAt.slice(0, 10) <= weekEnd,
  ).length;
  const overdueCount = active.filter(
    (p) => computeProjectStatus(p, stagesOf(p), todayIso) === 'overdue',
  ).length;
  const doneThisMonth = visibleStages.filter(
    (s) => s.status === StageStatus.Completed && s.endAt.slice(0, 7) === monthPrefix,
  ).length;

  const openProject = (id: string): void => {
    setSelectedProjectId(id);
    navigate(`/project/${id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {homeViewMode === 'calendar' ? (
        <MonthlyCalendarView onManual={() => setManualOpen(true)} />
      ) : (
        <>
          {/* 统计概览行（参考稿 §统计概览行） */}
          <section className="flex flex-col gap-5 sm:flex-row">
            <StatCard icon="▣" tone="pine" value={active.length} label="进行中项目" trend={null} />
            <StatCard icon="▢" tone="amber" value={dueThisWeek} label="本周到期任务" trend={null} />
            <StatCard icon="▲" tone="clay" value={overdueCount} label="逾期风险" trend={null} />
            <StatCard icon="✓" tone="sage" value={doneThisMonth} label="本月完工" trend={null} />
          </section>

          {/* 四列看板 */}
          {active.length === 0 ? (
            <EmptyState onManual={() => setManualOpen(true)} />
          ) : filtered.length === 0 ? (
            <div className="glass-light rounded-[16px] border border-dashed border-sand p-10 text-center">
              <p className="font-display text-display-md text-mist">没有匹配「{searchQuery}」的项目</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-3 rounded-md border border-pine px-4 py-2 text-sm text-pine hover:bg-pine-soft"
              >
                清除搜索
              </button>
            </div>
          ) : (
            <section className="flex gap-5 overflow-x-auto pb-2">
              {KANBAN_COLUMNS.map((col) => {
                const items = buckets[col.key];
                return (
                  <div
                    key={col.key}
                    className="glass-light flex min-w-[300px] flex-1 flex-col gap-3.5 rounded-[20px] border border-sand p-4"
                  >
                    {/* 列头：语义色圆点 + 列名 + 数量徽章 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${col.dot}`} aria-hidden />
                        <span className="text-sm font-semibold text-ink">{col.label}</span>
                      </div>
                      <span
                        className={`rounded-[10px] px-2.5 py-0.5 text-[12px] font-medium ${col.chip}`}
                      >
                        {items.length}
                      </span>
                    </div>

                    {/* 卡片列表 */}
                    <div className="flex flex-col gap-3">
                      {items.map((p) => (
                        <ProjectCard
                          key={p.id}
                          project={p}
                          stages={stagesOf(p)}
                          tasks={tasksOf(p)}
                          members={members}
                          todayIso={todayIso}
                          selected={selectedProjectId === p.id}
                          onOpen={() => openProject(p.id)}
                        />
                      ))}
                      {items.length === 0 && (
                        <p className="px-1 py-2 text-xs text-mist">暂无项目</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}

      {/* 手动建档兜底（顶栏菜单或空态触发） */}
      <ManualFallbackForm open={manualOpen} onClose={() => setManualOpen(false)} />

      {/* 成员管理（权限矩阵 #5：仅 admin；路由守卫已把成员重定向出首页，这里双保险） */}
      {isAdmin && <MembersPageSection />}

      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-display-md text-mist">已归档 · {archived.length}</h2>
          <div className="glass-light rounded-[16px] border border-sand px-3 py-1 shadow-soft">
            {archived.map((p) => (
              <ArchiveListRow key={p.id} project={p} onOpen={() => openProject(p.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------ 列定义与分桶 ------------------------------ */

type ColumnKey = 'todo' | 'design' | 'deepen' | 'build';

const KANBAN_COLUMNS: ReadonlyArray<{
  key: ColumnKey;
  label: string;
  dot: string;
  chip: string;
}> = [
  { key: 'todo', label: '待启动', dot: 'bg-mist', chip: 'bg-sand text-mist' },
  { key: 'design', label: '设计中', dot: 'bg-pine', chip: 'bg-pine-soft text-pine' },
  { key: 'deepen', label: '深化中', dot: 'bg-amber', chip: 'bg-amber-soft text-amber' },
  { key: 'build', label: '施工中', dot: 'bg-stage-s1', chip: 'bg-stage-s1/15 text-stage-s1' },
];

/**
 * 项目 → 看板列：
 *   未开始 → 待启动；当前阶段 ①~③ → 设计中；④~⑥ → 深化中；⑦~⑨ 及全部完成 → 施工中。
 */
function columnOf(status: ReturnType<typeof computeProjectStatus>, orderIndex: number): ColumnKey {
  if (status === 'not_started') return 'todo';
  if (status === 'completed') return 'build';
  if (orderIndex <= 3) return 'design';
  if (orderIndex <= 6) return 'deepen';
  return 'build';
}

function groupByColumn(
  projects: Project[],
  stagesOf: (p: Project) => Stage[],
  todayIso: string,
): Record<ColumnKey, Project[]> {
  const out: Record<ColumnKey, Project[]> = { todo: [], design: [], deepen: [], build: [] };
  for (const p of projects) {
    const st = stagesOf(p);
    const status = computeProjectStatus(p, st, todayIso);
    const idx = currentStageOf(st, todayIso)?.orderIndex ?? 9;
    out[columnOf(status, idx)].push(p);
  }
  return out;
}

/* ------------------------------ 日期工具（本地时区，避免 UTC 偏移） ------------------------------ */

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 本周一（周一为一周起点） */
function startOfWeekIso(d: Date): string {
  const day = (d.getDay() + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - day);
  return localIso(s);
}

/** 本周日 */
function endOfWeekIso(d: Date): string {
  const day = (d.getDay() + 6) % 7;
  const e = new Date(d);
  e.setDate(d.getDate() + (6 - day));
  return localIso(e);
}

/* ------------------------------ 空状态 ------------------------------ */

function EmptyState({ onManual }: { onManual(): void }): JSX.Element {
  return (
    <div className="glass-light rounded-[16px] border border-dashed border-sand p-10 text-center">
      <p className="font-display text-display-md text-mist">还没有进行中的项目</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-mist">
        用顶部「新建项目 → 导入合同建档」粘贴合同文本试试；扫描件识别不了？任何情况下都可以先手动建档。
      </p>
      <p className="mx-auto mt-3 max-w-md rounded-[16px] bg-cream px-4 py-3 text-xs leading-5 text-mist">
        你的数据自动保存在本机浏览器中，关闭浏览器不会丢失；如需换电脑或留档，点击顶栏「保存备份」导出文件，随时可再恢复。
      </p>
      <button
        type="button"
        onClick={onManual}
        className="mt-4 rounded-md border border-pine px-4 py-2 text-sm text-pine hover:bg-pine-soft"
      >
        直接手动建档
      </button>
    </div>
  );
}
