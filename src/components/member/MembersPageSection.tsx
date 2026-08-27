import { useState } from 'react';

import { Plus, UserRound, UserX, Crown, XCircle } from 'lucide-react';

import type { Member } from '../../core/types/entities';
import { ChangxiaError, MemberRoleKind } from '../../core/types/enums';
import { useMembersStore } from '../../store/useMembersStore';
import { createMemberActions } from '../../store/useMembersStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { useRepos } from '../../hooks/useRepos';
import { useRoleGuard, countActiveAdmins } from '../../hooks/useRoleGuard';
import { ConfirmDialog } from '../common/ConfirmDialog';

/**
 * 成员管理区（首页内嵌）：列表 / 新增 / 停用 / 设管理员 / 取消管理员（F9）。
 * v0.2：仅管理员视角出现（HomePage 已按 isAdmin 双保险渲染）；
 *       每行「设为管理员」按钮（权限矩阵 #6）→ update(id, { roleKind: 'admin' })，
 *       被提升者退出身份后重新进入即管理员视角。
 * v0.3 变更 A（管理员降级）：
 *   - 管理员行新增「取消管理员」按钮（icon XCircle，与停用并排）；
 *   - 唯一 active 管理员时 disabled（title「系统至少需要一名管理员」）；
 *   - 确认回调内再校验一次唯一管理员（双保险，防 disabled 被绕过）；
 *   - 降级成功后必须 upsert 同步 members store → useRoleGuard 派生重算：
 *     降级自己 → 顶栏「管理员」徽标消失 + HomeRouteGuard 自动重定向 /my-tasks（零新机制）。
 * AVATAR_COLORS 为受控例外（规范 §3.1 允许头像底色 hex 场景，来源集中于此 + IdentityDialog）。
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

  /** active 管理员计数（唯一管理员保护，口径=active && roleKind==='admin'） */
  const activeAdminCount = countActiveAdmins(members);

  /** 降级确认回调：双保险（按钮 disabled 之外的二次校验）+ 降级自己视角自动收敛 */
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
      // 关键一步：必须 upsert 同步 store（只调 repo 不更新 store，降级自己不会自动收敛）
      useMembersStore.getState().upsert(updated);
      useProjectsStore.getState().pushToast('success', '已取消管理员身份');
      // 若降级自己：useRoleGuard 重算 role='member' → isAdmin=false → isMember=true
      //   → TopBar「管理员」徽标消失（MemberIdentityPicker 依赖 useRoleGuard 自动收敛）
      //   → HomeRouteGuard 检测 isMember → <Navigate to="/my-tasks" replace />（页面级自动跳转）
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
}: {
  member: Member;
  isLastAdmin: boolean;
  onToggle(): void;
  onPromote(): void;
  onDemote(): void;
}): JSX.Element {
  const isAdminMember = member.roleKind === MemberRoleKind.Admin;
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-white"
        style={{ backgroundColor: member.avatarColor }}
      >
        {member.name[0]}
      </span>
      <span className={`text-sm ${member.active ? 'text-ink' : 'text-mist'}`}>{member.name}</span>
      <span className="text-xs text-mist">{member.role}</span>
      {isAdminMember && (
        <span className="inline-flex items-center gap-1 rounded-full bg-pine-soft px-1.5 py-0.5 text-[10px] font-medium text-pine-deep">
          <Crown size={10} /> 管理员
        </span>
      )}
      {member.contact && <span className="hidden text-xs text-mist sm:inline">{member.contact}</span>}
      <span className="ml-auto flex items-center gap-2">
        {!isAdminMember && member.active && (
          <button
            type="button"
            onClick={onPromote}
            title="设为管理员（被提升者退出身份后重新进入即为管理员视角）"
            className="inline-flex items-center gap-1 rounded-md border border-sand px-2 py-1 text-xs text-mist hover:bg-sand hover:text-pine"
          >
            <Crown size={12} /> 设为管理员
          </button>
        )}
        {isAdminMember && member.active && (
          <button
            type="button"
            onClick={onDemote}
            disabled={isLastAdmin}
            title={isLastAdmin ? '系统至少需要一名管理员' : '取消管理员（降级为普通成员）'}
            className="inline-flex items-center gap-1 rounded-md border border-sand px-2 py-1 text-xs text-mist hover:bg-sand hover:text-clay disabled:cursor-not-allowed disabled:opacity-40"
          >
            <XCircle size={12} /> 取消管理员
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          title={member.active ? '停用成员' : '重新启用'}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
            member.active ? 'border-sand text-mist hover:bg-sand' : 'border-sand text-pine hover:bg-sand'
          }`}
        >
          {member.active ? (
            <>
              <UserX size={12} /> 停用
            </>
          ) : (
            <>
              <UserRound size={12} /> 启用
            </>
          )}
        </button>
      </span>
    </li>
  );
}
