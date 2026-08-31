import { useEffect, useRef, useState } from 'react';
import { CalendarRange, MoreHorizontal, Archive } from 'lucide-react';

import type { Member, Project, Stage, Task } from '../../core/types/entities';
import { PROJECT_TYPE_LABELS, ProjectType } from '../../core/types/enums';
import { useRoleGuard, isRestrictedView, taskAssigneeIds } from '../../hooks/useRoleGuard';
import { currentStageOf, computeProjectPercent, computeProjectStatus } from '../../lib/progress';
import { useRepos } from '../../hooks/useRepos';
import { createProjectActions } from '../../store/useProjectsStore';
import { useNavigate } from 'react-router-dom';
import { appPath } from '../../config/env';
import { AvatarStack } from '../common/AvatarStack';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Modal } from '../common/Modal';
import { cn } from '../../lib/cn';

/**
 * 项目卡片（严格对齐参考稿 §卡片）：
 *   glass / 圆角16 / padding16 / gap12；
 *   信息架构 = 项目名(15/600) → 客户(12 次级) → 阶段 tag(圆角8) → 进度(6px 细条 + 百分比) →
 *   footer(截止日 12/500 + 成员头像组 26px)。
 * 状态语义色（进行中 pine / 逾期 clay / 完成 stage.s1 / 未开始 mist）全部走 token，禁止裸 hex。
 * 选中态 = 参考稿蓝紫描边 + 双层光晕 + 亮底（最近打开的项目）。
 *
 * v0.x · ⋯ 更多菜单（产品调研结论后实现）：
 *   - 修复交互结构：卡片原为 <button>，HTML 禁止嵌套交互元素 → 改为 div[role=button] + keydown 可达，
 *     ⋯ 触发器是独立 <button> 并 stopPropagation（否则点菜单误触打开项目）。
 *   - 菜单项（仅 admin 可见卡片场景渲染）：重命名 / 导出日程表 / 归档（复用已有后端与路由）。
 *   - 重命名：复用 store updateProject(id,{name})；归档：复用 setArchived；均走统一 Modal / ConfirmDialog。
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
  const { isAdmin } = useRoleGuard();
  const repos = useRepos();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const actions = createProjectActions(repos);

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

  // 外点关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const confirmRename = (): void => {
    const v = renameValue.trim();
    if (v && v !== project.name) void actions.updateProject(project.id, { name: v });
    setRenameOpen(false);
    setMenuOpen(false);
  };

  const openMenu = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group flex w-full cursor-pointer flex-col gap-3 rounded-[16px] border p-4 text-left backdrop-blur-[10px] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine',
        'shadow-[0_4px_24px_rgba(0,0,0,0.42)] hover:shadow-glow-card-hover',
        selected
          ? 'border-[rgba(110,168,254,0.6)] shadow-[0_0_0_1px_rgba(110,168,254,0.28),0_8px_32px_rgba(110,168,254,0.24)]'
          : 'border-sand glass-medium',
      )}
      style={selected ? { background: 'rgba(80,82,90,0.94)' } : undefined}
    >
      {/* 标题行：项目名 + ⋯ 更多菜单（独立 button + stopPropagation） */}
      <div className="flex w-full items-start justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-display text-md font-semibold text-ink group-hover:text-pine">
          {project.name}
        </span>
        {isAdmin && (
          <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={openMenu}
              aria-label="项目更多操作"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="rounded-md p-1 text-mist transition-colors hover:bg-sand hover:text-ink"
            >
              <MoreHorizontal size={16} aria-hidden />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="glass-medium menuFadeIn absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-sand py-1 shadow-soft"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setRenameValue(project.name);
                    setMenuOpen(false);
                    setRenameOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-sand"
                >
                  项目重命名
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    window.open(appPath(`/project/${project.id}/schedule-print`), '_blank');
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-sand"
                >
                  <CalendarRange size={14} className="text-mist" aria-hidden />
                  导出日程表
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={project.status !== 'active'}
                  onClick={() => {
                    setMenuOpen(false);
                    setArchiveOpen(true);
                  }}
                  className="flex w-full items-center gap-2 border-t border-sand px-3 py-2 text-left text-sm text-ink hover:bg-sand disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Archive size={14} className="text-mist" aria-hidden />
                  归档项目
                </button>
              </div>
            )}
          </div>
        )}
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

      {/* 重命名弹窗 */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} ariaLabel="项目重命名">
        <div className="glass-strong iridescent-border dialog-pop w-full max-w-md rounded-2xl p-5 shadow-soft outline-none">
          <h2 className="font-display text-display-md">项目重命名</h2>
          <p className="mt-1 text-xs text-mist">修改后将同步到项目详情与所有视图。</p>
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmRename();
            }}
            placeholder="输入新的项目名称"
            aria-label="新的项目名称"
            className="mt-3 w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-mist focus:border-pine"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenameOpen(false)}
              className="rounded-md border border-sand px-3 py-1.5 text-sm text-mist transition-colors hover:bg-sand"
            >
              取消
            </button>
            <button
              type="button"
              onClick={confirmRename}
              disabled={!renameValue.trim() || renameValue.trim() === project.name}
              className="rounded-md px-3 py-1.5 text-sm text-white transition-colors bg-pine hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </div>
      </Modal>

      {/* 归档确认（danger 变体） */}
      <ConfirmDialog
        open={archiveOpen}
        title="归档项目"
        confirmText="归档"
        danger
        onConfirm={() => {
          void actions.setArchived(project.id, true);
          setArchiveOpen(false);
        }}
        onCancel={() => setArchiveOpen(false)}
      >
        确认归档「{project.name}」？归档后将从首页列表隐藏（可在「已归档」区恢复）。
      </ConfirmDialog>
    </div>
  );
}
