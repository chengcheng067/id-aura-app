import { useEffect, useState } from 'react';

import { Plus, UserRound, UserX, Crown, XCircle, Pencil, Check, X } from 'lucide-react';

import type { Member } from '../../core/types/entities';
import { ChangxiaError, MemberRoleKind } from '../../core/types/enums';
import { useMembersStore } from '../../store/useMembersStore';
import { createMemberActions } from '../../store/useMembersStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { useRepos } from '../../hooks/useRepos';
import { useRoleGuard, countActiveAdmins } from '../../hooks/useRoleGuard';
import { ConfirmDialog } from '../common/ConfirmDialog';

/**
 * 成员管理区（首页内嵌）：列表 / 新增 / 重命名 / 停用 / 设管理员 / 取消管理员。
 * v0.2：仅管理员视角出现（HomePage 已按 isAdmin 双保险渲染）。
 * v0.4.1：新增「重命名」入口——成员名字可随时修改，避免首字头像与实际姓名长期不一致。
 */
export function MembersPageSection(): JSX.Element | null {
  const repos = useRepos();
  const members = useMembersStore((s) => s.members);
  const { isAdmin } = useRoleGuard();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [contact, setContact] = useState('');
  const [demoteTarget, setDemoteTarget] = useState<Member | null>(null);

  const actions = createMemberActions(repos);

  // 受控例外：头像底色 hex（仅此场景允许，来源集中在模板常量）
  const AVATAR_COLORS = ['#3D6B5B', '#D9A441', '#C4553B', '#7E97A8', '#A99BB5', '#2C3E50'];
  const submit = async (): Promise<void> => {
    if (!name.trim()) return;
    await actions.create({
      name: name.trim(),
      role: role.trim() || '协作',
      contact: contact.trim() || null,
      avatarColor: AVATAR_COLORS[members.length % AVATAR_COLORS.length],
    });
    setName('');
    setRole('');
    setContact('');
    setAdding(false);
  };

  /** active 管理员计数（唯一管理员保护） */
  const activeAdminCount = countActiveAdmins(members);

  /** 重命名：为空或不变时不调用；失败由 actions.update 内部 toast */
  const onRename = async (id: string, newName: string): Promise<void> => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await actions.update(id, { name: trimmed });
  };

  /** 降级确认回调：双保险 */
  const onDemote = async (m: Member): Promise<void> => {
    setDemoteTarget(null);
    const fresh = useMembersStore.getState().members;
    if (
      countActiveAdmins(fresh) === 1 &&
      fresh.some((x) => x.id === m.id && x.active && x.roleKind === MemberRoleKind.Admin)
    ) {
      useProjectsStore.getState().pushToast('error', '系统至少需要一名管理员，无法降级');
      return;
    }
    try {
      const updated = await repos.members.update(m.id, { roleKind: MemberRoleKind.Member });
      useMembersStore.getState().upsert(updated);
      useProjectsStore.getState().pushToast('success', '已取消管理员身份');
    } catch (err) {
      useProjectsStore
        .getState()
        .pushToast('error', err instanceof ChangxiaError ? err.userMessage : '降级失败，请重试。');
    }
  };

  // 双保险：即便被误渲染也不暴露成员管理
  if (!isAdmin) return null;

  return (
    <section className="glass-light rounded-lg border border-sand bg-paper p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-display-md">成员</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-md border border-sand px-3 py-1.5 text-xs text-mist hover:bg-sand hover:text-pine"
          >
            <Plus size={13} /> 添加成员
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-pine/40 bg-cream p-3 md:grid-cols-[1fr_120px_160px_auto]">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="姓名 *"
            className="rounded-md border border-sand bg-paper px-2 py-1.5 text-sm outline-none focus:border-pine"
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="角色（如绘图员）"
            className="rounded-md border border-sand bg-paper px-2 py-1.5 text-sm outline-none focus:border-pine"
          />
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="联系方式"
            className="rounded-md border border-sand bg-paper px-2 py-1.5 text-sm outline-none focus:border-pine"
          />
          <button
            type="button"
            onClick={() => void submit()}
            className="rounded-md bg-pine px-4 py-1.5 text-sm text-white hover:bg-pine-deep"
          >
            添加
          </button>
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-sm leading-6 text-mist">
          还没有成员。添加后可在阶段清单中指派任务，并在顶栏输入姓名进入「我的任务」。
        </p>
      ) : (
        <ul className="divide-y divide-sand/60">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isLastAdmin={
                m.active && m.roleKind === MemberRoleKind.Admin && activeAdminCount === 1
              }
              onToggle={() => void actions.setActive(m.id, !m.active)}
              onPromote={() => void actions.update(m.id, { roleKind: MemberRoleKind.Admin })}
              onDemote={() => setDemoteTarget(m)}
              onRename={(name) => void onRename(m.id, name)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={demoteTarget !== null}
        title="取消管理员"
        danger
        confirmText="确认降级"
        onConfirm={() => void (demoteTarget && onDemote(demoteTarget))}
        onCancel={() => setDemoteTarget(null)}
      >
        <p>
          将 <b>{demoteTarget?.name ?? ''}</b> 降级为普通成员：该成员将立即失去管理员权限，
          只能看到分派给自己的内容。
        </p>
      </ConfirmDialog>
    </section>
  );
}

function MemberRow({
  member,
  isLastAdmin,
  onToggle,
  onPromote,
  onDemote,
  onRename,
}: {
  member: Member;
  isLastAdmin: boolean;
  onToggle(): void;
  onPromote(): void;
  onDemote(): void;
  onRename(name: string): void;
}): JSX.Element {
  const isAdminMember = member.roleKind === MemberRoleKind.Admin;
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(member.name);

  // 外部同步（如其他窗口/逻辑改了名字）
  useEffect(() => {
    setEditName(member.name);
  }, [member.name]);

  const save = (): void => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== member.name) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const cancel = (): void => {
    setEditing(false);
    setEditName(member.name);
  };

  return (
    <li className="flex flex-wrap items-center gap-2 py-2 sm:gap-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs text-white"
        style={{ backgroundColor: member.avatarColor }}
      >
        {member.name[0]}
      </span>

      {editing ? (
        <>
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') cancel();
            }}
            placeholder="姓名"
            className="min-w-0 flex-1 rounded-md border border-pine/50 bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-pine"
          />
          <button
            type="button"
            onClick={save}
            title="保存"
            className="inline-flex items-center gap-1 rounded-md border border-pine bg-pine-soft px-2 py-1 text-xs text-pine-deep hover:bg-pine/20"
          >
            <Check size={12} /> 保存
          </button>
          <button
            type="button"
            onClick={cancel}
            title="取消"
            className="inline-flex items-center gap-1 rounded-md border border-sand px-2 py-1 text-xs text-mist hover:bg-sand"
          >
            <X size={12} /> 取消
          </button>
        </>
      ) : (
        <>
          <span className={`text-sm ${member.active ? 'text-ink' : 'text-mist'}`}>{member.name}</span>
          <span className="text-xs text-mist">{member.role}</span>
          {isAdminMember && (
            <span className="inline-flex items-center gap-1 rounded-full bg-pine-soft px-1.5 py-0.5 text-[10px] font-medium text-pine-deep">
              <Crown size={10} /> 管理员
            </span>
          )}
          {member.contact && <span className="hidden text-xs text-mist sm:inline">{member.contact}</span>}
        </>
      )}

      {!editing && (
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {!isAdminMember && member.active && (
            <button
              type="button"
              onClick={onPromote}
              title="设为管理员"
              className="inline-flex items-center gap-1 rounded-md border border-sand px-1.5 py-1 text-xs text-mist hover:bg-sand hover:text-pine sm:px-2"
            >
              <Crown size={12} /> <span className="hidden sm:inline">设为管理员</span>
            </button>
          )}
          {isAdminMember && member.active && (
            <button
              type="button"
              onClick={onDemote}
              disabled={isLastAdmin}
              title={isLastAdmin ? '系统至少需要一名管理员' : '取消管理员'}
              className="inline-flex items-center gap-1 rounded-md border border-sand px-1.5 py-1 text-xs text-mist hover:bg-sand hover:text-clay disabled:cursor-not-allowed disabled:opacity-40 sm:px-2"
            >
              <XCircle size={12} /> <span className="hidden sm:inline">取消管理员</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="重命名"
            className="inline-flex items-center gap-1 rounded-md border border-sand px-1.5 py-1 text-xs text-mist hover:bg-sand hover:text-pine sm:px-2"
          >
            <Pencil size={12} /> <span className="hidden sm:inline">重命名</span>
          </button>
          <button
            type="button"
            onClick={onToggle}
            title={member.active ? '停用成员' : '重新启用'}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs sm:px-2 ${
              member.active ? 'border-sand text-mist hover:bg-sand' : 'border-sand text-pine hover:bg-sand'
            }`}
          >
            {member.active ? (
              <>
                <UserX size={12} /> <span className="hidden sm:inline">停用</span>
              </>
            ) : (
              <>
                <UserRound size={12} /> <span className="hidden sm:inline">启用</span>
              </>
            )}
          </button>
        </span>
      )}
    </li>
  );
}
