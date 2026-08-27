/**
 * 全局枚举与错误码定义（core/types 唯一出处）。
 */

/** 数据源模式：local=IndexedDB(Dexie)，remote=REST(Fastify 预留) */
export type DataSourceMode = 'local' | 'remote';

/** 项目状态 */
export enum ProjectStatus {
  Active = 'active',
  Archived = 'archived',
}

/** 阶段四态流转：未开始 → 进行中 → 已完成；延期可自任意态进入（重置回未开始亦允许） */
export enum StageStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
  Delayed = 'delayed',
}

/** 全部阶段状态集合（遍历渲染/校验用） */
export const ALL_STAGE_STATUSES: readonly StageStatus[] = [
  StageStatus.NotStarted,
  StageStatus.InProgress,
  StageStatus.Completed,
  StageStatus.Delayed,
];

/** 合同解析字段置信度三档 */
export enum Confidence {
  High = 'high',
  Mid = 'mid',
  Low = 'low',
}

/** 项目类型（PRD F2 五类） */
export enum ProjectType {
  Dining = 'dining',
  TeaSpace = 'tea_space',
  Bookstore = 'bookstore',
  Homestay = 'homestay',
  Retail = 'retail',
}

/** 项目类型展示名映射（唯一 UI 文案源） */
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  [ProjectType.Dining]: '餐饮',
  [ProjectType.TeaSpace]: '茶空间',
  [ProjectType.Bookstore]: '书店',
  [ProjectType.Homestay]: '民宿',
  [ProjectType.Retail]: '零售',
};

/** 成员角色（无密码信任模型）：admin=设计师本人（系统所有者），member=被指派的执行者 */
export enum MemberRoleKind {
  Admin = 'admin',
  Member = 'member',
}

/** 成员角色展示名映射（唯一 UI 文案源，铁律 7） */
export const MEMBER_ROLE_LABELS: Record<MemberRoleKind, string> = {
  [MemberRoleKind.Admin]: '管理员',
  [MemberRoleKind.Member]: '成员',
};

/** 任务指派流水动作 */
export enum AssignmentAction {
  Assign = 'assign',
  Unassign = 'unassign',
  Change = 'change',
}

/** 阶段流水类型 */
export enum StageLogType {
  Created = 'created',
  Rescheduled = 'rescheduled',
  StatusChanged = 'status_changed',
}

/**
 * 统一业务错误码。
 * 仓储层任何失败抛 ChangxiaError{code,userMessage}；REST client 将网络/HTTP
 * 错误翻译为同一类型（共享知识铁律 5），上层只 catch 一个类。
 */
export enum ChangxiaErrorCode {
  NotFound = 'not_found',
  Validation = 'validation',
  Conflict = 'conflict',
  Storage = 'storage',
  Network = 'network',
  ParseFailed = 'parse_failed',
  Cancelled = 'cancelled',
}

/** 统一业务异常：上层只需捕获此类型并向 toast 展示 userMessage */
export class ChangxiaError extends Error {
  public readonly code: ChangxiaErrorCode;
  /** 可直接展示给用户的中文文案（为空时 UI 回落到兜底文案） */
  public readonly userMessage: string;

  constructor(code: ChangxiaErrorCode, userMessage: string, cause?: unknown) {
    super(`[changxia:${code}] ${userMessage}`);
    this.name = 'ChangxiaError';
    this.code = code;
    this.userMessage = userMessage;
    if (cause !== undefined) {
      // 现代运行环境支持 cause 透传，兼容性不足时静默忽略
      try {
        (this as { cause?: unknown }).cause = cause;
      } catch {
        /* 忽略 */
      }
    }
  }
}
