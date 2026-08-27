import { ChangxiaError, ChangxiaErrorCode, ProjectStatus } from '../../types/enums';
import type { Project } from '../../types/entities';
import type {
  CreateProjectCmd,
  UpdateProjectCmd,
} from '../../types/dto';
import type { IProjectsRepository, ProjectQuery } from '../interfaces';
import type { ChangxiaDatabase } from './dexie.database';

/** Dexie 实现的项目仓储 */
export class LocalProjectsRepository implements IProjectsRepository {
  constructor(private readonly db: ChangxiaDatabase) {}

  async list(query?: ProjectQuery): Promise<Project[]> {
    try {
      let rows = await this.db.projects.toArray();
      if (query?.status && query.status !== 'all') {
        rows = rows.filter((p) => p.status === query.status);
      }
      if (query?.keyword) {
        const kw = query.keyword.trim().toLowerCase();
        if (kw) {
          rows = rows.filter(
            (p) =>
              p.name.toLowerCase().includes(kw) ||
              p.clientName.toLowerCase().includes(kw) ||
              p.address.toLowerCase().includes(kw),
          );
        }
      }
      return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '项目列表读取失败。', err);
    }
  }

  async get(id: string): Promise<Project | null> {
    try {
      return (await this.db.projects.get(id)) ?? null;
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '项目详情读取失败。', err);
    }
  }

  async insert(cmd: CreateProjectCmd & { id?: string }): Promise<Project> {
    if (!cmd.name?.trim()) {
      throw new ChangxiaError(ChangxiaErrorCode.Validation, '项目名称不能为空。');
    }
    if (!cmd.plannedStartAt || !cmd.plannedEndAt) {
      throw new ChangxiaError(ChangxiaErrorCode.Validation, '项目计划起止日期不能为空。');
    }
    const now = new Date().toISOString();
    const row: Project = {
      id: cmd.id ?? crypto.randomUUID(),
      name: cmd.name.trim(),
      type: cmd.type,
      address: cmd.address ?? '',
      clientName: cmd.clientName ?? '',
      contractAmount: cmd.contractAmount ?? null,
      signedAt: cmd.signedAt ?? null,
      plannedStartAt: cmd.plannedStartAt,
      plannedEndAt: cmd.plannedEndAt,
      coverColor: cmd.coverColor ?? null,
      status: ProjectStatus.Active,
      revision: 1,
      updatedAt: now,
    };
    try {
      await this.db.projects.add(row);
      return row;
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '项目创建失败。', err);
    }
  }

  async update(id: string, cmd: UpdateProjectCmd): Promise<Project> {
    const existing = await this.db.projects.get(id);
    if (!existing) {
      throw new ChangxiaError(ChangxiaErrorCode.NotFound, '未找到该项目，可能已被删除。');
    }
    const next: Project = {
      ...existing,
      ...pickDefined(cmd),
      revision: existing.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.db.projects.put(next);
    return next;
  }

  async archive(id: string, archived: boolean): Promise<void> {
    await this.update(id, { status: archived ? ProjectStatus.Archived : ProjectStatus.Active });
  }
}

/** 仅复制值为 undefined 之外的键（PUT 合并语义的基础工具） */
export function pickDefined<T extends object>(src: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(src) as Array<keyof T>) {
    if (src[key] !== undefined) {
      // undefined 检查后赋值安全
      (out as Record<string, unknown>)[key as string] = src[key];
    }
  }
  return out;
}
