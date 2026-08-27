/**
 * 项目领域服务：建档编排（模板实例化→切分→清单生成→多表事务写）。
 * 业务规则的唯一住所——组件/store 只做参数搬运，不含规则。
 */

import { createId } from '../../lib/id';
import { toIsoDate } from '../../lib/date';
import { previewSplit } from '../template/split';
import type { StageDraft } from '../types/dto';
import type {
  ConfirmedContractPayload,
  CreateProjectCmd,
} from '../types/dto';
import { ChangxiaError, ChangxiaErrorCode, ProjectType, StageLogType, StageStatus } from '../types/enums';
import type { Project, Stage, Task } from '../types/entities';
import type { IProjectsRepository } from '../repositories/interfaces';
import type { LocalProjectsRepository } from '../repositories/local/local.projects.repo';

/** 事务执行器：local=Dexie transaction；remote=服务端受理（接口同签名） */
export interface TxRunner {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

/** ProjectService 构造依赖（全部来自 IRepositoryBundle + 可选事务执行器） */
export interface ProjectServiceDeps {
  projects: IProjectsRepository;
  /** stages/tasks/logs/contracts 需要事务语义：接口同签名由 bundle 提供 */
  bundle: import('../repositories/interfaces').IRepositoryBundle;
  /** local 适配器可注入 Dexie db 构造的事务 runner；remote 可不传（服务端兜底） */
  tx?: TxRunner;
}

export class ProjectService {
  public constructor(private readonly deps: ProjectServiceDeps) {}

  /**
   * 合同建档主流程：
   *   contracts.insert(存证) → projects.insert → stages.bulkInsert(9)
   *   → tasks.bulkInsert(职责清单) → contracts.linkProject
   * 有 tx 则整体包裹；无 tx 时逐条顺序写（remote 模式由服务端受理保证）。
   */
  public async createProjectFromContract(
    confirmed: ConfirmedContractPayload,
    drafts: StageDraft[],
    contractRecordId?: string,
  ): Promise<Project> {
    this.assertDraftsValid(drafts);

    const projectCmd: CreateProjectCmd = {
      name: confirmed.projectName,
      type: confirmed.projectType,
      address: confirmed.address,
      clientName: confirmed.clientName,
      contractAmount: confirmed.contractAmount,
      signedAt: confirmed.signedAt,
      plannedStartAt: toIsoDate(confirmed.startAt) ?? confirmed.startAt,
      plannedEndAt: toIsoDate(confirmed.endAt) ?? confirmed.endAt,
      coverColor: null,
    };

    const exec = async (): Promise<Project> => {
      // 1. 存证解析结果（新建或回链已有记录）
      let contractId = contractRecordId;
      if (!contractId) {
        const record = await this.deps.bundle.contracts.insert({
          projectId: null,
          fileName: confirmed.sourceFileName,
          rawTextDigest: confirmed.rawTextDigest,
          parsedResultJson: confirmed.parsedResultJsonSnapshot,
          confirmedPayloadJson: JSON.stringify(confirmed),
          createdByManual: confirmed.createdByManual,
        });
        contractId = record.id;
      }

      // 2. 项目主体
      const project = await (this.deps.projects as LocalProjectsRepository).insert(projectCmd);

      // 3. 九阶段实例化
      const stageRows: Stage[] = drafts.map((d) => ({
        id: createId('stg'),
        projectId: project.id,
        orderIndex: d.orderIndex,
        name: d.name,
        ratioPercent: d.ratioPercent,
        startAt: d.startAt,
        endAt: d.endAt,
        status: StageStatus.NotStarted,
        ownerId: d.ownerId,
        visible: d.visible,
        resourcePath: d.resourcePath,
        revision: 1,
        updatedAt: new Date().toISOString(),
      }));
      await this.deps.bundle.stages.bulkInsert(stageRows);

      // 首段状态流水
      for (const s of stageRows) {
        await this.deps.bundle.logs.appendStageLog({
          stageId: s.id,
          projectId: project.id,
          type: StageLogType.Created,
          fromStatus: null,
          toStatus: StageStatus.NotStarted,
          oldStartAt: null,
          newStartAt: s.startAt,
          oldEndAt: null,
          newEndAt: s.endAt,
          reason: null,
          operatorName: 'system',
        });
      }

      // 4. 默认职责清单生成
      const taskRows: Task[] = [];
      for (const draft of drafts) {
        const stageRow = stageRows.find((s) => s.orderIndex === draft.orderIndex);
        if (!stageRow) continue;
        draft.defaultTasks.forEach((title, idx) => {
          taskRows.push({
            id: createId('tsk'),
            projectId: project.id,
            stageId: stageRow.id,
            title,
            done: false,
            assigneeId: null,
            // 键序铁律：assigneeIds 插在 assigneeId 之后、dueDate 之前（与 taskSchema/repo insert 三处同步）
            // 漏补此字段 → 首次导出键序 ≠ 导入归一后键序 → backup.roundtrip 直接失败
            assigneeIds: [],
            dueDate: stageRow.endAt.slice(0, 10),
            orderIndex: idx + 1,
            revision: 1,
            updatedAt: new Date().toISOString(),
          });
        });
      }
      if (taskRows.length > 0) {
        await this.deps.bundle.tasks.bulkInsert(taskRows);
      }

      // 5. 回链合同存证
      if (contractId) {
        await this.deps.bundle.contracts.linkProject(contractId, project.id);
      }

      return project;
    };

    return this.deps.tx ? this.deps.tx.run(exec) : exec();
  }

  /** 手动建档（先建空项目后补录合同的微调诉求）：同样走九阶段切分 */
  public async createManualProject(cmd: CreateProjectCmd): Promise<Project> {
    const drafts = previewSplit({
      startAt: cmd.plannedStartAt,
      endAt: cmd.plannedEndAt,
    });
    const payload: ConfirmedContractPayload = {
      projectName: cmd.name,
      projectType: cmd.type ?? ProjectType.Dining,
      address: cmd.address,
      clientName: cmd.clientName,
      contractAmount: cmd.contractAmount,
      signedAt: cmd.signedAt,
      startAt: cmd.plannedStartAt,
      endAt: cmd.plannedEndAt,
      stageOverrides: {},
      createdByManual: true,
      sourceFileName: null,
      rawTextDigest: digestOf(''),
      parsedResultJsonSnapshot: JSON.stringify({ manual: true }),
    };
    return this.createProjectFromContract(payload, drafts);
  }

  private assertDraftsValid(drafts: StageDraft[]): void {
    if (drafts.length !== 9) {
      throw new ChangxiaError(ChangxiaErrorCode.Validation, '建档必须包含完整九个阶段草稿。');
    }
    for (let i = 0; i < drafts.length; i += 1) {
      if (drafts[i].orderIndex !== i + 1) {
        throw new ChangxiaError(ChangxiaErrorCode.Validation, '阶段顺序锁定为 1..9，不可乱序。');
      }
    }
  }
}

/** 原文摘要：sha256 前 16 位（webcrypto 异步则退化为简单 hash —— 存证用弱一致性即可） */
export function digestOf(text: string): string {
  if (text.length === 0) return '';
  // 简单 FNV-1a 32bit ×4 轮做轻量指纹；正文 diff 场景足够
  let h1 = 0x811c9dc5;
  for (let round = 0; round < 4; round += 1) {
    for (let i = 0; i < text.length; i += 1) {
      h1 ^= text.charCodeAt(i) + round;
      h1 = Math.imul(h1, 0x01000193) >>> 0;
    }
  }
  return h1.toString(16).padStart(8, '0') + text.length.toString(16).padStart(8, '0');
}
