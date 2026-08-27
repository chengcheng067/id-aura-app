import { ChangxiaError, ChangxiaErrorCode } from '../../types/enums';
import type { Task } from '../../types/entities';
import type { CreateTaskCmd, UpdateTaskCmd } from '../../types/dto';
import type { ITasksRepository, TaskQuery } from '../interfaces';
import type { ChangxiaDatabase } from './dexie.database';
import { pickDefined } from './local.projects.repo';
import { taskAssigneeIds } from '../../../hooks/useRoleGuard';

/** Dexie 实现的任务仓储 */
export class LocalTasksRepository implements ITasksRepository {
  constructor(private readonly db: ChangxiaDatabase) {}

  async list(query?: TaskQuery): Promise<Task[]> {
    try {
      let rows = await this.db.tasks.toArray();
      if (query?.projectId) rows = rows.filter((t) => t.projectId === query.projectId);
      if (query?.stageId) rows = rows.filter((t) => t.stageId === query.stageId);
      // v0.3：参与人包含语义（assigneeIds 或 assigneeId 命中即返回），与 useRoleGuard.taskAssigneeIds 同口径
      if (query?.assigneeId) rows = rows.filter((t) => taskAssigneeIds(t).includes(query.assigneeId as string));
      if (typeof query?.done === 'boolean') rows = rows.filter((t) => t.done === query.done);
      return rows.sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id));
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '任务列表读取失败。', err);
    }
  }

  async listByProject(projectId: string): Promise<Task[]> {
    return this.list({ projectId });
  }

  /** 参与人包含语义：memberId 出现在 assigneeIds 或等于 assigneeId 即命中（v0.3） */
  async listByAssignee(memberId: string): Promise<Task[]> {
    return this.list({ assigneeId: memberId });
  }

  async bulkInsert(rows: Task[]): Promise<void> {
    if (rows.length === 0) return;
    for (const r of rows) {
      if (!r.id || !r.projectId || !r.stageId || !r.title?.trim()) {
        throw new ChangxiaError(ChangxiaErrorCode.Validation, '任务草稿字段不完整，无法入库。');
      }
    }
    try {
      await this.db.tasks.bulkAdd(rows);
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '任务批量写入失败。', err);
    }
  }

  async insert(cmd: CreateTaskCmd): Promise<Task> {
    if (!cmd.title?.trim()) {
      throw new ChangxiaError(ChangxiaErrorCode.Validation, '任务标题不能为空。');
    }
    const now = new Date().toISOString();
    const siblings = await this.list({ stageId: cmd.stageId });
    // 键序铁律：assigneeIds 必须插在 assigneeId 之后、dueDate 之前（与 taskSchema/project.service 默认字面量三处同步）
    const row: Task = {
      id: crypto.randomUUID(),
      projectId: cmd.projectId,
      stageId: cmd.stageId,
      title: cmd.title.trim(),
      done: false,
      assigneeId: cmd.assigneeId ?? null,
      assigneeIds: cmd.assigneeIds ?? (cmd.assigneeId ? [cmd.assigneeId] : []),
      dueDate: cmd.dueDate ?? null,
      orderIndex: siblings.reduce((max, t) => Math.max(max, t.orderIndex), 0) + 1,
      revision: 1,
      updatedAt: now,
    };
    await this.db.tasks.add(row);
    return row;
  }

  async update(id: string, cmd: UpdateTaskCmd): Promise<Task> {
    const existing = await this.db.tasks.get(id);
    if (!existing) {
      throw new ChangxiaError(ChangxiaErrorCode.NotFound, '未找到该任务。');
    }
    const next: Task = {
      ...existing,
      ...pickDefined(cmd),
      revision: existing.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.db.tasks.put(next);
    return next;
  }

  async remove(id: string): Promise<void> {
    try {
      await this.db.tasks.delete(id);
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '任务删除失败。', err);
    }
  }
}
