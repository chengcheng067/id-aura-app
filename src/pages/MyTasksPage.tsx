import { useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { Check } from 'lucide-react';

import { useProjectsStore } from '../store/useProjectsStore';
import { createTaskActions } from '../store/useProjectsStore';
import { useMembersStore } from '../store/useMembersStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useRepos } from '../hooks/useRepos';
import { taskAssigneeIds } from '../hooks/useRoleGuard';
import { Badge } from '../components/common/Badge';
import { remainingDays } from '../lib/date';
import type { Project, Stage, Task } from '../core/types/entities';

type FilterMode = 'by-project' | 'by-time';

/**
 * 我的任务（成员视角，PRD 页面 4）：
 *   仅两项过滤维度：按项目 / 按时间；条目行 = 项目名+阶段图标+待办标题+截止天数；
 *   勾选即完成并写指派流水；右上角小字「只显示与我相关的内容」。
 */
export function MyTasksPage(): JSX.Element {
  const repos = useRepos();
  const currentMemberId = useSettingsStore((s) => s.currentMemberId);
  const members = useMembersStore((s) => s.members);
  const projects = useProjectsStore((s) => s.projects);
  const stages = useProjectsStore((s) => s.stages);
  const allTasks = useProjectsStore((s) => s.tasks);

  const [filter, setFilter] = useState<FilterMode>('by-project');
  const [showDone, setShowDone] = useState(false);

  const me = members.find((m) => m.id === currentMemberId) ?? null;
  // v0.3：参与人包含语义（taskAssigneeIds 回落旧数据 assigneeId）
  const myTasks = useMemo(
    () =>
      currentMemberId
        ? allTasks.filter(
            (t) => taskAssigneeIds(t).includes(currentMemberId) && (showDone || !t.done),
          )
        : [],
    [allTasks, currentMemberId, showDone],
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const actions = createTaskActions(repos);
  const operatorName = me?.name ?? '未知';

  const projectOf = (t: Task): Project | undefined =>
    projects.find((p) => p.id === t.projectId);
  const stageOf = (t: Task): Stage | undefined => stages.find((s) => s.id === t.stageId);

  /** 按时间过滤：按截止日升序分组（逾期/今日/本周/以后） */
  const groupedByTime = useMemo(() => {
    const groups: Record<string, Task[]> = { '已逾期': [], '今天': [], '7 天内': [], '更晚': [] };
    for (const t of myTasks) {
      if (!t.dueDate) {
        groups['更晚'].push(t);
        continue;
      }
      const d = remainingDays(t.dueDate.slice(0, 10), todayIso);
      if (d < 0) groups['已逾期'].push(t);
      else if (d === 0) groups['今天'].push(t);
      else if (d <= 7) groups['7 天内'].push(t);
      else groups['更晚'].push(t);
    }
    return Object.entries(groups).filter(([, rows]) => rows.length > 0);
  }, [myTasks, todayIso]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-display-lg">我的任务</h1>
        <span className="ml-auto text-xs text-mist">只显示与我相关的内容</span>
        <div className="flex overflow-hidden rounded-md border border-sand">
          <button
            type="button"
            onClick={() => setFilter('by-project')}
            className={`px-3 py-1 text-xs ${filter === 'by-project' ? 'bg-pine text-white' : 'bg-paper text-mist hover:bg-sand'}`}
          >
            按项目
          </button>
          <button
            type="button"
            onClick={() => setFilter('by-time')}
            className={`px-3 py-1 text-xs ${filter === 'by-time' ? 'bg-pine text-white' : 'bg-paper text-mist hover:bg-sand'}`}
          >
            按时间
          </button>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-mist">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          显示已完成
        </label>
      </div>

      {/* 未选身份引导（成员看不到首页，不再引导回首页添加成员） */}
      {!currentMemberId && (
        <div className="rounded-md border border-dashed border-sand bg-paper p-8 text-center text-sm leading-6 text-mist">
          请点击右上角「进入身份」输入你的姓名；
          <br />
          若系统还没有管理员，请先让管理员完成首次设置后再进入。
        </div>
      )}

      {/* 空态 */}
      {currentMemberId && myTasks.length === 0 && (
        <div className="rounded-md border border-dashed border-sand bg-paper p-8 text-center text-sm leading-6 text-mist">
          {me ? `${me.name}，目前没有分配给你的待办 🎉` : '未找到该身份。'}
        </div>
      )}

      {/* 按项目 */}
      {currentMemberId && filter === 'by-project' &&
        Object.entries(
          myTasks.reduce<Record<string, Task[]>>((acc, t) => {
            const key = t.projectId;
            (acc[key] ??= []).push(t);
            return acc;
          }, {}),
        ).map(([projectId, rows]) => {
          const p = projects.find((x) => x.id === projectId);
          return (
            <section key={projectId} className="mb-5">
              <h2 className="mb-2 flex items-center gap-2 font-display text-display-md">
                {p ? (
                  // 项目名 → 详情入口：成员可点入受限项目详情（否则成员无任何入口）
                  <Link
                    to={`/project/${p.id}`}
                    className="transition-colors hover:text-pine"
                  >
                    {p.name}
                  </Link>
                ) : (
                  '（未知项目）'
                )}
              </h2>
              <ul className="overflow-hidden rounded-md border border-sand bg-paper shadow-soft">
                {[...rows]
                  .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
                  .map((t) => (
                    <TaskRowView
                      key={t.id}
                      task={t}
                      stage={stageOf(t)}
                      todayIso={todayIso}
                      onToggle={() => void actions.toggleDone(t, operatorName)}
                    />
                  ))}
              </ul>
            </section>
          );
        })}

      {/* 按时间 */}
      {currentMemberId && filter === 'by-time' &&
        groupedByTime.map(([groupLabel, rows]) => (
          <section key={groupLabel} className="mb-5">
            <h2 className="mb-2 font-display text-display-md">
              {groupLabel}
              {groupLabel === '已逾期' && (
                <span className="ml-2 align-middle">
                  <Badge tone="clay">{rows.length} 条</Badge>
                </span>
              )}
            </h2>
            <ul className="overflow-hidden rounded-md border border-sand bg-paper shadow-soft">
              {rows.map((t) => (
                <TaskRowView
                  key={t.id}
                  task={t}
                  stage={stageOf(t)}
                  todayIso={todayIso}
                  onToggle={() => void actions.toggleDone(t, operatorName)}
                />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

function TaskRowView({
  task,
  stage,
  todayIso,
  onToggle,
}: {
  task: Task;
  stage: Stage | undefined;
  todayIso: string;
  onToggle(): void;
}): JSX.Element {
  const days = task.dueDate ? remainingDays(task.dueDate.slice(0, 10), todayIso) : null;
  const overdue = days !== null && days < 0;

  return (
    <li className="flex items-center gap-3 border-b border-sand/60 px-4 py-2.5 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={task.done ? '标记未完成' : '标记完成'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          task.done
            ? 'border-pine bg-pine text-white'
            : 'border-mist/50 text-transparent hover:border-pine'
        }`}
      >
        <Check size={12} />
      </button>

      <span className="min-w-0 flex-1 truncate text-sm">
        <span className={task.done ? 'text-mist line-through' : ''}>{task.title}</span>
      </span>

      {stage && (
        <Badge tone="neutral">
          {['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'][stage.orderIndex - 1]} {stage.name}
        </Badge>
      )}

      {days !== null && (
        <span
          className={`w-16 shrink-0 text-right text-xs tabular-nums ${
            overdue ? 'text-clay' : days <= 3 ? 'text-amber-deep' : 'text-mist'
          }`}
        >
          {overdue ? `逾期${Math.abs(days)}天` : days === 0 ? '今天到期' : `${days} 天`}
        </span>
      )}
    </li>
  );
}

// 保持 Stage 类型引用（上方泛型注释用）
export type { Project, Stage };
