/**
 * 备份服务：exportAll() → BackupPackage；importAndReplace() → zod 校验 + 清库重建。
 * 格式规范见 docs/backup-format.md；往返不变式由 tests/backup.roundtrip.spec.ts 保证。
 */

import { z } from 'zod';

import type { BackupPackage } from '../types/dto';
import type {
  AssignmentLog,
  StageLog,
} from '../types/entities';
import { ChangxiaError, ChangxiaErrorCode, ScheduleBasis } from '../types/enums';
import type { IRepositoryBundle } from '../repositories/interfaces';
import { normalizeProjectRow, normalizeStageRow } from '../template/stage-fallback';

/** 现行备份 schema 版本（v2 = 含 stagePresetKey / templateKey / colorIndex / scheduleBasis） */
export const BACKUP_SCHEMA_VERSION = 2;

/** 仍可导入的历史版本（v1 = 老备份，缺阶段自定义字段） */
const LEGACY_BACKUP_SCHEMA_VERSION = 1;

/* ------------------------------ zod 实体 schema ------------------------------ */

const isoString = z.string().min(1);
const nullableIso = isoString.nullable();
const dateLike = z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/);

/**
 * 项目 schema。三个新增字段用 `.optional()` + `.transform()` 而非裸 optional：
 * 老备份（v1）无这些字段 → 校验通过并显式补齐默认值（stagePresetKey=null /
 * stageTemplateVersion=0 / scheduleBasis=自然日），导入后 DB 行必有值，运行时不会 undefined。
 * 键序铁律：插在 coverColor 之后、status 之前（与 entities.Project / repo insert 三处同步）。
 */
const projectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    address: z.string(),
    clientName: z.string(),
    contractAmount: z.number().nullable(),
    signedAt: nullableIso,
    plannedStartAt: dateLike,
    plannedEndAt: dateLike,
    coverColor: z.string().nullable(),
    stagePresetKey: z.string().nullable().optional(),
    stageTemplateVersion: z.number().int().nonnegative().optional(),
    scheduleBasis: z.nativeEnum(ScheduleBasis).optional(),
    status: z.string(),
    revision: z.number().int().nonnegative(),
    updatedAt: isoString,
  })
  .transform(normalizeProjectRow);

/**
 * 阶段 schema。要点：
 *   1. orderIndex 上限 9 → 99 —— 否则阶段数 >9 的项目备份一导出就再也导不回来；
 *   2. templateKey / colorIndex 老备份缺失 → transform 内按 orderIndex 回落
 *      （templateKey 反查 indoor_full 套餐，colorIndex = clamp(orderIndex,1,9)）。
 * 键序铁律：两字段插在 orderIndex 之后、name 之前（与 entities.Stage / project.service 同步）。
 */
const stageSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    orderIndex: z.number().int().min(1).max(99),
    templateKey: z.string().nullable().optional(),
    colorIndex: z.number().int().min(1).max(9).optional(),
    name: z.string(),
    ratioPercent: z.number(),
    startAt: dateLike,
    endAt: dateLike,
    status: z.string(),
    ownerId: z.string().nullable(),
    visible: z.boolean(),
    resourcePath: z.string().nullable(),
    revision: z.number().int().nonnegative(),
    updatedAt: isoString,
  })
  .transform(normalizeStageRow);

const taskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  stageId: z.string(),
  title: z.string(),
  done: z.boolean(),
  assigneeId: z.string().nullable(),
  // v0.3 新增：参与人全集。用 .default([]) 而非裸 optional——旧备份无该字段 → 归一 [] → 通过；
  // 且保证导入后 DB 行必有显式 assigneeIds（否则运行时 assigneeIds.length 读 undefined 抛错）。
  // 键序铁律：插在 assigneeId 之后、dueDate 之前（与 repo insert / project.service 默认字面量三处同步）。
  assigneeIds: z.array(z.string()).default([]),
  dueDate: z.string().nullable(),
  orderIndex: z.number().int(),
  revision: z.number().int().nonnegative(),
  updatedAt: isoString,
});

/**
 * 成员 schema：roleKind 用 z.enum([...]).default('member')（不是裸 optional）。
 * 旧备份无该字段 → undefined → 校验通过并归一为 'member'，保证导入后每行都有显式 roleKind
 * （否则 TS 类型要求必填，导入后行缺字段运行时 undefined）。
 */
const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  contact: z.string().nullable(),
  avatarColor: z.string(),
  active: z.boolean(),
  roleKind: z.enum(['admin', 'member']).default('member'),
  revision: z.number().int().nonnegative(),
  updatedAt: isoString,
});

const assignmentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  projectId: z.string(),
  memberId: z.string().nullable(),
  action: z.string(),
  operatorName: z.string(),
  createdAt: isoString,
});

const stageLogSchema = z.object({
  id: z.string(),
  stageId: z.string(),
  projectId: z.string(),
  type: z.string(),
  fromStatus: z.string().nullable(),
  toStatus: z.string().nullable(),
  oldStartAt: nullableIso,
  newStartAt: nullableIso,
  oldEndAt: nullableIso,
  newEndAt: nullableIso,
  reason: z.string().nullable(),
  operatorName: z.string(),
  createdAt: isoString,
});

const contractSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  fileName: z.string().nullable(),
  rawTextDigest: z.string(),
  parsedResultJson: z.string(),
  confirmedPayloadJson: z.string().nullable(),
  createdByManual: z.boolean(),
  createdAt: isoString,
});

const settingSchema = z.object({
  key: z.string(),
  valueJson: z.string(),
  updatedAt: isoString,
});

const backupSchema = z.object({
  meta: z.object({
    app: z.literal('changxia'),
    // 导入侧同时接受 v1（老备份）与 v2（含阶段自定义字段）；缺失时按现行版本归一
    schemaVersion: z
      .union([z.literal(LEGACY_BACKUP_SCHEMA_VERSION), z.literal(BACKUP_SCHEMA_VERSION)])
      .default(BACKUP_SCHEMA_VERSION),
    exportedAt: isoString,
  }),
  data: z.object({
    projects: z.array(projectSchema),
    stages: z.array(stageSchema),
    tasks: z.array(taskSchema),
    members: z.array(memberSchema),
    assignments: z.array(assignmentSchema),
    logs: z.array(stageLogSchema),
    contracts: z.array(contractSchema),
    settings: z.array(settingSchema),
  }),
});

/** 导入前置校验（供测试直接调用）；结构不符抛 ChangxiaError，绝不半套写入 */
export function validateBackupJson(json: unknown): BackupPackage {
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ChangxiaError(
      ChangxiaErrorCode.Validation,
      `备份文件结构校验失败：${issue?.path.join('.') || '(root)'} ${issue?.message ?? ''}`.trim(),
      parsed.error,
    );
  }
  return parsed.data as BackupPackage;
}

/* --------------------------------- 服务本体 --------------------------------- */

export class BackupService {
  public constructor(private readonly bundle: IRepositoryBundle) {}

  /** 并行读全部表组装 BackupPackage（admin.fullExport 含 append-only 流水整表） */
  public async exportAll(): Promise<BackupPackage> {
    if (this.bundle.admin) {
      return this.bundle.admin.fullExport();
    }
    // 无 admin 通道时的降级路径：主表可导出，流水表置空并告警
    const b = this.bundle;
    const [projects, stages, tasks, members, contracts, settings] = await Promise.all([
      b.projects.list({ status: 'all' }),
      this.listAllStages(),
      this.listAllTasks(),
      b.members.list(true),
      b.contracts.list(),
      b.settings.all(),
    ]);
    return {
      meta: {
        app: 'changxia',
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
      },
      data: { projects, stages, tasks, members, assignments: [], logs: [], contracts, settings },
    };
  }

  /** 导入 = 校验 + 清库重建。结构不符直接拒绝（原子性由 admin.replaceAllImport 保证） */
  public async importAndReplace(pkg: BackupPackage): Promise<void> {
    // 1) 结构校验（含 roleKind 枚举归一）
    const normalized = validateBackupJson(pkg);
    if (!this.bundle.admin) {
      throw new ChangxiaError(
        ChangxiaErrorCode.Storage,
        '当前数据源不支持备份导入。',
      );
    }
    // 2) 落库前组装：一律用 zod 归一产物，保证「老备份缺字段 → 落库后必有显式值」。
    //    - members：roleKind .default('member') 补齐（v0.2 范式）；
    //    - tasks：assigneeIds .default([]) 补齐（v0.3 范式，键序 assigneeId 后、dueDate 前）；
    //    - projects / stages（v2 范式）：stagePresetKey / scheduleBasis / templateKey /
    //      colorIndex 由 .transform() 补齐并**按 schema 键序重建对象**——
    //      该键序与 entities 定义、repo insert 字面量三处对齐，故 roundtrip 的
    //      JSON.stringify 逐表 diff 依然成立（键序铁律）。
    const data = {
      ...pkg.data,
      projects: normalized.data.projects,
      stages: normalized.data.stages,
      members: normalized.data.members,
      tasks: normalized.data.tasks,
    };
    await this.bundle.admin.replaceAllImport({ ...pkg, data });
  }

  /* --------------------------- 降级导出的跨项目聚合 --------------------------- */

  private async listAllStages() {
    const projects = await this.bundle.projects.list({ status: 'all' });
    const chunks = await Promise.all(
      projects.map((p) => this.bundle.stages.listByProject(p.id)),
    );
    return chunks.flat();
  }

  private async listAllTasks() {
    const projects = await this.bundle.projects.list({ status: 'all' });
    const chunks = await Promise.all(
      projects.map((p) => this.bundle.tasks.listByProject(p.id)),
    );
    return chunks.flat();
  }
}

/** 备份下载文件名（用户可见物）：改名 ID Plan 后前缀同步；内容校验走 meta.app，与文件名解耦 */
export function backupFileName(now: Date = new Date()): string {
  const ts = now.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `id-plan-backup-${ts}.json`;
}

/** 序列化下载（浏览器环境专用） */
export function downloadBackup(pkg: BackupPackage): void {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  a.click();
  URL.revokeObjectURL(url);
}

export type { AssignmentLog, StageLog };
