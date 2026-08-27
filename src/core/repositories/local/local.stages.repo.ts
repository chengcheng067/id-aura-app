import dayjs from 'dayjs';

import { ChangxiaError, ChangxiaErrorCode, StageStatus } from '../../types/enums';
import type { Stage } from '../../types/entities';
import type { UpdateStageCmd } from '../../types/dto';
import type { IStagesRepository } from '../interfaces';
import type { ChangxiaDatabase } from './dexie.database';
import { pickDefined } from './local.projects.repo';

/** Dexie 实现的阶段仓储 */
export class LocalStagesRepository implements IStagesRepository {
  constructor(private readonly db: ChangxiaDatabase) {}

  async listByProject(projectId: string): Promise<Stage[]> {
    try {
      const rows = await this.db.stages.where('projectId').equals(projectId).toArray();
      return rows.sort((a, b) => a.orderIndex - b.orderIndex);
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '阶段列表读取失败。', err);
    }
  }

  async get(id: string): Promise<Stage | null> {
    try {
      return (await this.db.stages.get(id)) ?? null;
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '阶段读取失败。', err);
    }
  }

  async bulkInsert(rows: Stage[]): Promise<void> {
    if (rows.length === 0) return;
    for (const r of rows) {
      if (!r.projectId || !r.id || typeof r.orderIndex !== 'number') {
        throw new ChangxiaError(ChangxiaErrorCode.Validation, '阶段草稿字段不完整，无法入库。');
      }
      if (dayjs(r.endAt).isBefore(dayjs(r.startAt))) {
        throw new ChangxiaError(ChangxiaErrorCode.Validation, `「${r.name}」起止日期倒置。`);
      }
    }
    try {
      await this.db.stages.bulkAdd(rows);
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '阶段批量写入失败。', err);
    }
  }

  async update(id: string, cmd: UpdateStageCmd): Promise<Stage> {
    const existing = await this.db.stages.get(id);
    if (!existing) {
      throw new ChangxiaError(ChangxiaErrorCode.NotFound, '未找到该阶段。');
    }
    const next: Stage = {
      ...existing,
      ...pickDefined(cmd),
      revision: existing.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.db.stages.put(next);
    return next;
  }

  /** 改期落库（状态联动由 service 决定）；流水写入在 service 层编排 */
  async reschedule(
    id: string,
    startAt: string,
    endAt: string,
    status?: StageStatus,
  ): Promise<Stage> {
    const existing = await this.db.stages.get(id);
    if (!existing) {
      throw new ChangxiaError(ChangxiaErrorCode.NotFound, '未找到该阶段。');
    }
    const start = dayjs(startAt);
    const end = dayjs(endAt);
    if (!start.isValid() || !end.isValid()) {
      throw new ChangxiaError(ChangxiaErrorCode.Validation, '日期格式无效。');
    }
    if (end.isBefore(start)) {
      throw new ChangxiaError(ChangxiaErrorCode.Validation, '新截止日早于开始日，已拒绝保存。');
    }
    const next: Stage = {
      ...existing,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      ...(status ? { status } : {}),
      revision: existing.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.db.stages.put(next);
    return next;
  }
}
