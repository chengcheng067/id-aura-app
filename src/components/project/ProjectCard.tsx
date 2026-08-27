import type { Member, Project, Stage, Task } from '../../core/types/entities';
import { PROJECT_TYPE_LABELS, ProjectType } from '../../core/types/enums';
import { useRoleGuard, isRestrictedView, taskAssigneeIds } from '../../hooks/useRoleGuard';
import { Badge } from '../common/Badge';
import { AvatarStack } from '../common/AvatarStack';
import { CountdownNumber } from '../common/CountdownNumber';

/** 当前阶段推演（首页卡片徽章 + 倒计时共用） */
export function currentStageOf(stages: Stage[], todayIso: string): Stage | undefined {
  const visible = stages.filter((s) => s.visible !== false);
  return (
    visible.find(
      (s) =>
        s.status !== 'completed' && todayIso >= s.startAt.slice(0, 10) && todayIso <= s.endAt.slice(0, 10),
    ) ??
    visible
      .filter((s) => s.status !== 'completed')
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .find((s) => s.startAt.slice(0, 10) > todayIso) ??
    visible.sort((a, b) => a.orderIndex - b.orderIndex).at(-1)
  );
}

/** 项目卡片：封面缩略（色块）｜名称+类型｜当前阶段徽章｜倒计时｜负责人头像组｜进度细条 */
export function ProjectCard({
  project,
  stages,
  tasks,
  members,
  todayIso,
  onOpen,
}: {
  project: Project;
  stages: Stage[];
  tasks: Task[];
  members: Member[];
  todayIso: string;
  onOpen(): void;
}): JSX.Element {
  // 防御：非管理员（含未进入身份）不给 clientName / 成员姓名——BUG-1 语义统一为 !isAdmin
  const { role } = useRoleGuard();
  const memberView = isRestrictedView(role);
  const cur = currentStageOf(stages, todayIso);
  const stageMembers = members.filter((m) => m.active && (!cur?.ownerId || m.id === cur.ownerId));
  // v0.3：参与人全集展开（taskAssigneeIds 回落旧数据单值），未完成任务的参与人进入头像组
  const activeMemberIds = new Set(
    tasks
      .filter((t) => cur && t.stageId === cur.id && !t.done)
      .flatMap((t) => taskAssigneeIds(t)),
  );
  const cardMembers = members.filter((m) => activeMemberIds.has(m.id) || (cur?.ownerId && m.id === cur.ownerId));

  const stageTasks = tasks.filter((t) => t.stageId === cur?.id);
  const doneRatio =
    stageTasks.length === 0
      ? null
      : stageTasks.filter((t) => t.done).length / stageTasks.length;

  const overdue = cur ? cur.endAt.slice(0, 10) < todayIso : false;

  void PROJECT_TYPE_LABELS; // 引用位：见下方 Badge

  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-light group flex w-full flex-col rounded-lg border border-sand bg-paper p-4 text-left shadow-soft transition-all hover:shadow-[0_0_20px_rgba(110,168,254,0.08)]"
    >
      <div className="mb-3 flex items-start gap-3">
        {/* 封面色块（coverColor token 名 → 具体色；MVP 用九段色示意） */}
        <span className="h-10 w-1.5 shrink-0 rounded-full bg-pine opacity-70" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-display-md group-hover:text-pine">{project.name}</h3>
          <p className="mt-0.5 text-xs text-mist">
            <Badge>{PROJECT_TYPE_LABELS[project.type as ProjectType] ?? '未分类'}</Badge>
            {!memberView && project.clientName ? ` ${project.clientName}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-0.5 text-[11px] text-mist">当前阶段</p>
          {cur ? (
            <>
              <p className="truncate text-sm">
                <Badge tone="pine">
                  {['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'][cur.orderIndex - 1]}{' '}
                  {cur.name}
                </Badge>
                {overdue && (
                  <span className="ml-2 rounded-full bg-clay-soft px-2 py-0.5 text-[11px] font-medium text-clay-deep">
                    已逾期
                  </span>
                )}
              </p>
              <div className="mt-2">
                <CountdownNumber target={cur.endAt.slice(0, 10)} todayIso={todayIso} />
              </div>
            </>
          ) : (
            <p className="text-sm text-mist">全部阶段已完成 ✓</p>
          )}
        </div>

        <AvatarStack
          members={cardMembers.length > 0 ? cardMembers : stageMembers}
          maskMemberNames={memberView}
        />
      </div>

      {/* 本阶段待办完成度细进度条 */}
      {doneRatio !== null && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full bg-pine transition-all"
            style={{ width: `${Math.round(doneRatio * 100)}%` }}
          />
        </div>
      )}
    </button>
  );
}
