import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { ProjectCard } from '../components/project/ProjectCard';
import { ArchiveListRow } from '../components/project/ArchiveListRow';
import { MembersPageSection } from '../components/member/MembersPageSection';
import { ManualFallbackForm } from '../components/contract-wizard/ManualFallbackForm';
import { subscribeManualForm } from '../components/project/NewProjectMenu';
import { MonthlyCalendarView } from '../components/calendar/MonthlyCalendarView';
import { useProjectsStore } from '../store/useProjectsStore';
import { useMembersStore } from '../store/useMembersStore';
import { useUiStore } from '../store/useUiStore';
import { useRoleGuard } from '../hooks/useRoleGuard';
import { cn } from '../lib/cn';
import type { Project, Stage, Task } from '../core/types/entities';

/**
 * 首页·项目列表：
 *   进行中卡片网格（当前阶段徽章 + 倒计时 + 头像组 + 待办进度）
 *   已归档收敛列表、成员管理区（仅管理员——路由守卫双保险）、手动建档兜底表单。
 */
export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const projects = useProjectsStore((s) => s.projects);
  const stages = useProjectsStore((s) => s.stages);
  const tasks = useProjectsStore((s) => s.tasks);
  const members = useMembersStore((s) => s.members);
  const { isAdmin } = useRoleGuard();
  const homeViewMode = useUiStore((s) => s.homeViewMode);
  const setHomeViewMode = useUiStore((s) => s.setHomeViewMode);

  // 手动建档显隐：本地 state + 订阅顶栏菜单广播
  const [manualOpen, setManualOpen] = useState(false);
  useEffect(() => subscribeManualForm(setManualOpen), []);

  const todayIso = new Date().toISOString().slice(0, 10);
  const active = projects.filter((p) => p.status === 'active');
  const archived = projects.filter((p) => p.status !== 'active');

  const stagesOf = (p: Project): Stage[] => stages.filter((s) => s.projectId === p.id);
  const tasksOf = (p: Project): Task[] => tasks.filter((t) => t.projectId === p.id);

  return (
    <div className="space-y-8">
      {/* 视图开关：[看板 | 月历]（形态对齐参考稿 看板/时间轴 toggle，瞬态存 useUiStore） */}
      <div className="flex items-center justify-between">
        <ViewModeToggle mode={homeViewMode} onChange={setHomeViewMode} />
        {homeViewMode === 'kanban' && (
          <span className="text-xs text-mist">{todayIso}</span>
        )}
      </div>

      {homeViewMode === 'calendar' ? (
        <MonthlyCalendarView onManual={() => setManualOpen(true)} />
      ) : (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-display-md">进行中 · {active.length}</h2>
          </div>

          {active.length === 0 ? (
            <EmptyState onManual={() => setManualOpen(true)} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {active.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  stages={stagesOf(p)}
                  tasks={tasksOf(p)}
                  members={members}
                  todayIso={todayIso}
                  onOpen={() => navigate(`/project/${p.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 手动建档兜底（顶栏菜单或空态触发） */}
      <ManualFallbackForm open={manualOpen} onClose={() => setManualOpen(false)} />

      {/* 成员管理（权限矩阵 #5：仅 admin；路由守卫已把成员重定向出首页，这里双保险） */}
      {isAdmin && <MembersPageSection />}

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-display-md text-mist">已归档 · {archived.length}</h2>
          <div className="glass-light rounded-lg border border-sand bg-paper px-3 py-1 shadow-soft">
            {archived.map((p) => (
              <ArchiveListRow key={p.id} project={p} onOpen={() => navigate(`/project/${p.id}`)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState({ onManual }: { onManual(): void }): JSX.Element {
  return (
    <div className="glass-light rounded-lg border border-dashed border-sand p-10 text-center">
      <p className="font-display text-display-md text-mist">还没有进行中的项目</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-mist">
        用顶部「新建项目 → 导入合同建档」粘贴合同文本试试；扫描件识别不了？任何情况下都可以先手动建档。
      </p>
      <p className="mx-auto mt-3 max-w-md rounded-lg bg-cream px-4 py-3 text-xs leading-5 text-mist">
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

/** [看板 | 月历] 视图开关（形态对齐参考稿 看板/时间轴 toggle） */
function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: 'kanban' | 'calendar';
  onChange(mode: 'kanban' | 'calendar'): void;
}): JSX.Element {
  const opts: Array<{ key: 'kanban' | 'calendar'; label: string }> = [
    { key: 'kanban', label: '看板' },
    { key: 'calendar', label: '月历' },
  ];
  return (
    <div
      role="tablist"
      aria-label="首页视图切换"
      className="inline-flex overflow-hidden rounded-md border border-sand bg-paper text-sm"
    >
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={mode === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'px-4 py-1.5 transition-colors',
            mode === o.key ? 'bg-pine text-white' : 'text-mist hover:bg-sand hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
