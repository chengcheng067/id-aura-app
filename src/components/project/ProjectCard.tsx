import type { Member, Project, Stage, Task } from '../../core/types/entities';
import { PROJECT_TYPE_LABELS, ProjectType } from '../../core/types/enums';
import { useRoleGuard, isRestrictedView, taskAssigneeIds } from '../../hooks/useRoleGuard';
import { currentStageOf, computeProjectPercent, computeProjectStatus } from '../../lib/progress';
import { AvatarStack } from '../common/AvatarStack';
import { cn } from '../../lib/cn';

/**
 * 项目卡片（严格对齐参考稿 §卡片）：
 *   glass / 圆角16 / padding16 / gap12；
 *   信息架构 = 项目名(15/600) → 客户(12 次级) → 阶段 tag(圆角8) → 进度(6px 细条 + 百分比) →
 *   footer(截止日 12/500 + 成员头像组 26px)。
 * 状态语义色（进行中 pine / 逾期 clay / 完成 stage.s1 / 未开始 mist）全部走 token，禁止裸 hex。
 * 选中态 = 参考稿蓝紫描边 + 双层光晕 + 亮底（最近打开的项目）。
 */

const CIRCLED = '①②③④⑤⑥⑦⑧⑨';

/** 状态 → 语义色 token（tag 文字 / tag 底 / 进度条填充 / 日期文字） */
const STATUS_TONE = {
  in_progress: { text: 'text-pine', soft: 'bg-pine-soft', fill: 'bg-pine' },
  completed: { text: 'text-stage-s1', soft: 'bg-stage-s1/15', fill: 'bg-stage-s1' },
  overdue: { text: 'text-clay', soft: 'bg-clay-soft', fill: 'bg-clay' },
  not_started: { text: 'text-mist', soft: 'bg-sand', fill: 'bg-mist' },
} as const;

function daysBetween(fromIso: string, toIso: string): number {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / MS);
}

export function ProjectCard({
  project,
  stages,
  tasks,
  members,
  todayIso,
  selected = false,
  onOpen,
}: {
  project: Project;
  stages: Stage[];
  tasks: Task[];
  members: Member[];
  todayIso: string;
  selected?: boolean;
  onOpen(): void;
}): JSX.Element {
  const { role } = useRoleGuard();
  const memberView = isRestrictedView(role);

  const cur = currentStageOf(stages, todayIso);
  const percent = computeProjectPercent(stages);
  const status = computeProjectStatus(project, stages, todayIso);
  const tone = STATUS_TONE[status];

  // 参与人：当前阶段未完成任务的执行人 + 阶段负责人（沿用 v0.3 口径，成员受限时mask姓名）
  const stageMembers = members.filter((m) => m.active && (!cur?.ownerId || m.id === cur.ownerId));
  const activeMemberIds = new Set(
    tasks
      .filter((t) => cur && t.stageId === cur.id && !t.done)
      .flatMap((t) => taskAssigneeIds(t)),
  );
  const cardMembers = members.filter(
    (m) => activeMemberIds.has(m.id) || (cur?.ownerId && m.id === cur.ownerId),
  );

  const stageLabel = cur ? `${CIRCLED[cur.orderIndex - 1] ?? cur.orderIndex} ${cur.name}` : '全部完成';
  const dueIso = cur?.endAt.slice(0, 10) ?? project.plannedEndAt;
  const dueMd = dueIso.slice(5).replace('-', '-');
  const overdueDays = daysBetween(dueIso, todayIso);
  const dueText = overdueDays > 0 ? `逾期 ${overdueDays} 天` : `${dueMd} 到期`;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group flex w-full flex-col gap-3 rounded-[16px] border p-4 text-left backdrop-blur-[10px] transition-all',
        'shadow-[0_4px_24px_rgba(0,0,0,0.42)] hover:shadow-glow-card-hover',
        selected
          ? 'border-[rgba(110,168,254,0.6)] shadow-[0_0_0_1px_rgba(110,168,254,0.28),0_8px_32px_rgba(110,168,254,0.24)]'
          : 'border-sand glass-medium',
      )}
      style={selected ? { background: 'rgba(80,82,90,0.94)' } : undefined}
    >
      {/* 标题行 */}
      <div className="flex w-full items-start justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-display text-md font-semibold text-ink group-hover:text-pine">
          {project.name}
        </span>
        <span className="shrink-0 text-[12px] text-mist" aria-hidden>
          ⋯
        </span>
      </div>

      {/* 客户（成员受限视图隐藏，沿用既有语义） */}
      <span className="w-full truncate text-[12px] text-mist">
        {PROJECT_TYPE_LABELS[project.type as ProjectType] ?? '未分类'}
        {!memberView && project.clientName ? ` · ${project.clientName}` : ''}
      </span>

      {/* 阶段 tag */}
      <span
        className={cn(
          'inline-flex max-w-full items-center truncate rounded-[8px] px-2.5 py-1 text-[12px] font-medium',
          tone.soft,
          tone.text,
        )}
      >
        {stageLabel}
      </span>

      {/* 进度（6px 细条 + 百分比，口径 = 已完成可见阶段 / 可见阶段总数） */}
      <div className="flex w-full flex-col gap-1.5">
        <div className="flex w-full items-center justify-between text-[12px]">
          <span className="text-mist">进度</span>
          <span className={cn('font-medium', tone.text)}>{Math.round(percent)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-[6px] bg-sand">
          <div
            className={cn('h-full rounded-[6px] transition-all', tone.fill)}
            style={{ width: `${Math.max(percent, 2)}%` }}
          />
        </div>
      </div>

      {/* footer：截止日 + 成员头像组 */}
      <div className="flex w-full items-center justify-between gap-2">
        <span className={cn('flex items-center gap-1.5 text-[12px] font-medium', status === 'overdue' ? 'text-clay' : 'text-mist')}>
          <span aria-hidden>▦</span>
          {dueText}
        </span>
        <AvatarStack
          members={cardMembers.length > 0 ? cardMembers : stageMembers}
          maskMemberNames={memberView}
        />
      </div>
    </button>
  );
}
