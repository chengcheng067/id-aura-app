import { ChangxiaError, ChangxiaErrorCode, MemberRoleKind } from '../../types/enums';
import type { Member } from '../../types/entities';
import type { CreateMemberCmd, UpdateMemberCmd } from '../../types/dto';
import type { IMembersRepository } from '../interfaces';
import type { ChangxiaDatabase } from './dexie.database';
import { pickDefined } from './local.projects.repo';

/** Dexie 实现的成员仓储 */
export class LocalMembersRepository implements IMembersRepository {
  constructor(private readonly db: ChangxiaDatabase) {}

  async list(includeInactive?: boolean): Promise<Member[]> {
    try {
      const rows = await this.db.members.toArray();
      const filtered = includeInactive ? rows : rows.filter((m) => m.active);
      return filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '成员列表读取失败。', err);
    }
  }

  async get(id: string): Promise<Member | null> {
    try {
      return (await this.db.members.get(id)) ?? null;
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '成员读取失败。', err);
    }
  }

  async insert(cmd: CreateMemberCmd): Promise<Member> {
    if (!cmd.name?.trim()) {
      throw new ChangxiaError(ChangxiaErrorCode.Validation, '成员姓名不能为空。');
    }
    const now = new Date().toISOString();
    const row: Member = {
      id: crypto.randomUUID(),
      name: cmd.name.trim(),
      role: cmd.role?.trim() ?? '',
      contact: cmd.contact ?? null,
      avatarColor: cmd.avatarColor,
      active: true,
      // 角色默认 member（外部调用方零改动）；first-run 管理员提权经 roleKind:'admin' 显式传入
      roleKind: cmd.roleKind ?? MemberRoleKind.Member,
      revision: 1,
      updatedAt: now,
    };
    try {
      await this.db.members.add(row);
      return row;
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '成员创建失败。', err);
    }
  }

  async update(id: string, cmd: UpdateMemberCmd): Promise<Member> {
    const existing = await this.db.members.get(id);
    if (!existing) {
      throw new ChangxiaError(ChangxiaErrorCode.NotFound, '未找到该成员。');
    }
    // 停用开关只允许显式 active 字段驱动
    const next: Member = {
      ...existing,
      ...pickDefined(cmd),
      revision: existing.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.db.members.put(next);
    return next;
  }
}
