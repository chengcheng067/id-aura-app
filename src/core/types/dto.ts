/**
 * 命令对象 / 数据传输对象（CreateXxxCmd / UpdateXxxCmd 集中定义）。
 * 命名规范见共享知识铁律 7：别处不得重复声明实体形状。
 */

import {
  AssignmentAction,
  Confidence,
  MemberRoleKind,
  ProjectStatus,
  ProjectType,
  StageLogType,
  StageStatus,
} from './enums';
import type { Member, Project, Stage, Task } from './entities';

/* ------------------------------------ 项目 ----------------------------------- */

/** 手动建档命令（先建空项目后补录合同的微调诉求） */
export interface CreateProjectCmd {
  name: string;
  type: ProjectType;
  address: string;
  clientName: string;
  contractAmount: number | null;
  signedAt: string | null;
  plannedStartAt: string; // ISO date 'YYYY-MM-DD'
  plannedEndAt: string;
  coverColor: string | null;
}

/** 项目信息编辑命令（不含状态与日期切分，改期走 stage.service） */
export interface UpdateProjectCmd {
  name?: string;
  type?: ProjectType;
  address?: string;
  clientName?: string;
  contractAmount?: number | null;
  signedAt?: string | null;
  coverColor?: string | null;
  status?: ProjectStatus;
}

/** 合同建档的确认载荷（向导第三步「确认」后交给 ProjectService 的完整意图） */
export interface ConfirmedContractPayload {
  projectName: string;
  projectType: ProjectType;
  address: string;
  clientName: string;
  contractAmount: number | null;
  signedAt: string | null; // ISO datetime or date
  startAt: string;
  endAt: string;
  /** 九阶段草案（含可能的人工覆写） */
  stageOverrides: Record<number, StageOverride>;
  createdByManual: boolean;
  sourceFileName: string | null;
  rawTextDigest: string;
  parsedResultJsonSnapshot: string;
}

/* ------------------------------------ 阶段 ------------------------------------ */

/** 向导/切分阶段的覆写项 */
export interface StageOverride {
  name?: string;
  ratioPercent?: number;
  pinnedStartAt?: string | null;
  pinnedEndAt?: string | null;
  visible?: boolean;
}

/** 切分产出的阶段草稿（确认后才入库） */
export interface StageDraft {
  orderIndex: number;
  name: string;
  ratioPercent: number;
  startAt: string;
  endAt: string;
  status: StageStatus; // 恒为 not_started
  ownerId: string | null;
  visible: boolean;
  resourcePath: string | null;
  defaultTasks: string[];
}

/** 改期命令：必经 StageService.reschedule() 的闸门校验 */
export interface RescheduleStageCmd {
  newStartAt: string;
  newEndAt: string;
  /** 截止日后移（newEndAt>oldEndAt）时必填；提前/平移可空 */
  reason: string | null;
  operatorName: string;
}

/** 阶段字段级更新（抽屉内行内编辑；日期变更不允许绕过 reschedule） */
export interface UpdateStageCmd {
  name?: string;
  ratioPercent?: number;
  visible?: boolean;
  ownerId?: string | null;
  resourcePath?: string | null;
}

/* ------------------------------------ 任务 ------------------------------------ */

export interface CreateTaskCmd {
  projectId: string;
  stageId: string;
  title: string;
  assigneeId: string | null;
  /** 参与人全集（可选；未传时 repo.insert 回落 [assigneeId]） */
  assigneeIds?: string[];
  dueDate: string | null;
}

export interface UpdateTaskCmd {
  title?: string;
  done?: boolean;
  assigneeId?: string | null;
  /** 参与人全集（可选；集合变化时 store 层写集合级 Change 流水） */
  assigneeIds?: string[];
  dueDate?: string | null;
  orderIndex?: number;
}

/* ------------------------------------ 成员 ------------------------------------ */

export interface CreateMemberCmd {
  name: string;
  role: string;
  contact: string | null;
  avatarColor: string;
  /** 可选：默认 member（repo.insert 落默认值，外部调用方零改动） */
  roleKind?: MemberRoleKind;
}

export interface UpdateMemberCmd {
  name?: string;
  role?: string;
  contact?: string | null;
  avatarColor?: string;
  active?: boolean;
  /** 可选：提权/降级走 update(id, { roleKind: 'admin' })，接口层零新增 */
  roleKind?: MemberRoleKind;
}

/* ------------------------------------ 备份 ------------------------------------ */

/** 备份包结构（规范见 docs/backup-format.md，zod schema 见 backup.service.ts） */
export interface BackupPackage {
  meta: {
    app: 'changxia';
    schemaVersion: 1;
    exportedAt: string;
  };
  data: {
    projects: Project[];
    stages: Stage[];
    tasks: Task[];
    members: Member[];
    assignments: import('./entities').AssignmentLog[];
    logs: import('./entities').StageLog[];
    contracts: import('./entities').ContractRecord[];
    settings: import('./entities').Setting[];
  };
}

/** 导入结果摘要（供 toast 与 diff 校验展示） */
export interface ImportResultSummary {
  projects: number;
  stages: number;
  tasks: number;
  members: number;
  assignments: number;
  logs: number;
  contracts: number;
  settings: number;
}

/* ------------------------------- 九阶段模板 ---------------------------------- */

/** templates/nine-stages.default.json 的类型化形状 */
export interface NineStagesTemplateFile {
  version: 1;
  stages: Array<{
    orderIndex: number;
    name: string;
    ratioPercent: number;
    defaultResponsibility: string;
    defaultTasks: string[];
  }>;
}

/* ------------------------------ 切分选项 ------------------------------------- */

export interface SplitOptionsInput {
  startAt: string;
  endAt: string;
  overrides?: Partial<Record<number, StageOverride>>;
}
