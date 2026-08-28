import type { BackupPackage } from '../../types/dto';
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
import { BACKUP_SCHEMA_VERSION } from '../../services/backup.service';
import type { IAdminRepository } from '../interfaces';
import { ALL_TABLE_NAMES, type AllTableName, type ChangxiaDatabase } from './dexie.database';

/**
 * local 适配器的备份/引导管理通道（admin）。
 * fullExport：并行读八张表整表（append-only 流水完整保真）。
 * replaceAllImport：单 Dexie 事务内 clear + bulkPut —— 原子性由 Dexie transaction 保证。
 */
export class LocalAdminRepository implements IAdminRepository {
  public constructor(private readonly db: ChangxiaDatabase) {}

  public async fullExport(): Promise<BackupPackage> {
    try {
      const [projects, stages, tasks, members, assignments, logs, contracts, settings] =
        await Promise.all([
          this.db.projects.toArray() as Promise<Project[]>,
          this.db.stages.toArray() as Promise<Stage[]>,
          this.db.tasks.toArray() as Promise<Task[]>,
          this.db.members.toArray() as Promise<Member[]>,
          this.db.assignments.toArray() as Promise<AssignmentLog[]>,
          this.db.stageLogs.toArray() as Promise<StageLog[]>,
          this.db.contracts.toArray() as Promise<ContractRecord[]>,
          this.db.settings.toArray() as Promise<Setting[]>,
        ]);
      return {
        meta: {
          app: 'changxia',
          schemaVersion: BACKUP_SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
        },
        data: { projects, stages, tasks, members, assignments, logs, contracts, settings },
      };
    } catch (err) {
      throw new ChangxiaError(ChangxiaErrorCode.Storage, '全量导出失败。', err);
    }
  }

  /** 清库重建：任一步失败整体回滚，不允许半套写入 */
  public async replaceAllImport(pkg: BackupPackage): Promise<void> {
    const tableOf = (name: AllTableName) =>
      this.db[name as keyof ChangxiaDatabase] as unknown as {
        clear(): Promise<void>;
        bulkPut(rows: unknown[]): Promise<unknown>;
      };

    const rowsFor = (name: AllTableName): unknown[] => {
      switch (name) {
        case 'projects':
          return pkg.data.projects;
        case 'stages':
          return pkg.data.stages;
        case 'tasks':
          return pkg.data.tasks;
        case 'members':
          return pkg.data.members;
        case 'assignments':
          return pkg.data.assignments;
        case 'stageLogs':
          return pkg.data.logs;
        case 'contracts':
          return pkg.data.contracts;
        case 'settings':
          return pkg.data.settings;
        default:
          return [];
      }
    };

    try {
      await this.db.transaction('rw', [...ALL_TABLE_NAMES], async () => {
        for (const name of ALL_TABLE_NAMES) {
          await tableOf(name).clear();
        }
        for (const name of ALL_TABLE_NAMES) {
          const rows = rowsFor(name);
          if (rows.length > 0) await tableOf(name).bulkPut(rows);
        }
      });
    } catch (err) {
      throw new ChangxiaError(
        ChangxiaErrorCode.Storage,
        '备份导入失败：已整体回滚，本地数据未受影响。',
        err,
      );
    }
  }
}
