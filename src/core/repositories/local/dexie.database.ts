import Dexie, { Table } from 'dexie';

import type {
  AssignmentLog,
  ContractRecord,
  Member,
  Project,
  Setting,
  Stage,
  StageLog,
  Task,
} from '../../types/entities';
import { ChangxiaError, ChangxiaErrorCode } from '../../types/enums';

/**
 * Dexie 数据库声明（local adapter 唯一持久化出口）。
 * 业务代码禁止 import dexie —— 只有本目录下的适配器允许（铁律 4）。
 */

export class ChangxiaDatabase extends Dexie {
  public projects!: Table<Project, string>;
  public stages!: Table<Stage, string>;
  public tasks!: Table<Task, string>;
  public members!: Table<Member, string>;
  public assignments!: Table<AssignmentLog, string>;
  public stageLogs!: Table<StageLog, string>;
  public contracts!: Table<ContractRecord, string>;
  public settings!: Table<Setting, string>;

  constructor(name = 'changxia') {
    super(name);
    this.version(1).stores({
      projects: 'id, status, name, updatedAt',
      stages: 'id, projectId, [projectId+orderIndex], updatedAt',
      tasks: 'id, projectId, stageId, assigneeId, done, [stageId+done], dueDate',
      members: 'id, active, name',
      assignments: 'id, taskId, projectId, memberId, createdAt',
      stageLogs: 'id, stageId, projectId, createdAt',
      contracts: 'id, projectId, createdAt',
      settings: 'key',
    });
  }
}

/** 打开失败时的统一错误归一 */
export async function openDatabase(): Promise<ChangxiaDatabase> {
  const db = new ChangxiaDatabase();
  try {
    await db.open();
    return db;
  } catch (err) {
    db.close();
    throw new ChangxiaError(
      ChangxiaErrorCode.Storage,
      '本地数据库打开失败，请检查浏览器隐私模式或存储空间。',
      err,
    );
  }
}

/** 表名清单（备份整库替换时遍历用） */
export const ALL_TABLE_NAMES = [
  'projects',
  'stages',
  'tasks',
  'members',
  'assignments',
  'stageLogs',
  'contracts',
  'settings',
] as const;

export type AllTableName = (typeof ALL_TABLE_NAMES)[number];
