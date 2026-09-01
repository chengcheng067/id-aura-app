import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/core/repositories/local/dexie.database';
import { LocalProjectsRepository } from '../src/core/repositories/local/local.projects.repo';
import { LocalStagesRepository } from '../src/core/repositories/local/local.stages.repo';
import { LocalTasksRepository } from '../src/core/repositories/local/local.tasks.repo';
import { LocalLogsRepository } from '../src/core/repositories/local/local.logs.repo';
import type { Stage, Task, StageLog } from '../src/core/types/entities';

describe('项目级联删除', () => {
  let db: Awaited<ReturnType<typeof openDatabase>>;

  beforeEach(async () => {
    db = await openDatabase();
    await Promise.all([
      db.projects.clear(),
      db.stages.clear(),
      db.tasks.clear(),
      db.stageLogs.clear(),
      db.assignments.clear(),
    ]);
  });

  it('删除项目时级联清理其下 stages/tasks/stageLogs', async () => {
    const projRepo = new LocalProjectsRepository(db);
    const stageRepo = new LocalStagesRepository(db);
    const taskRepo = new LocalTasksRepository(db);
    const logRepo = new LocalLogsRepository(db);

    const proj = await projRepo.insert({
      name: '测试项目',
      type: 'dining',
      address: '地址',
      clientName: '客户',
      plannedStartAt: '2026-09-01',
      plannedEndAt: '2026-09-30',
    });

    const stage: Stage = {
      id: 'stg-1',
      projectId: proj.id,
      orderIndex: 1,
      templateKey: null,
      colorIndex: null,
      name: '方案设计',
      ratioPercent: 30,
      startAt: '2026-09-01',
      endAt: '2026-09-10',
      status: 'not_started',
      ownerId: null,
      visible: 1,
      resourcePath: null,
      revision: 1,
      updatedAt: new Date().toISOString(),
    };
    await stageRepo.bulkInsert([stage]);

    const task: Task = {
      id: 'tsk-1',
      projectId: proj.id,
      stageId: stage.id,
      title: '出平面图',
      done: false,
      assigneeId: null,
      assigneeIds: [],
      dueDate: '2026-09-05',
      orderIndex: 1,
      revision: 1,
      updatedAt: new Date().toISOString(),
    };
    await taskRepo.bulkInsert([task]);

    await logRepo.appendStageLog({
      stageId: stage.id,
      projectId: proj.id,
      type: 'created',
      fromStatus: null,
      toStatus: 'not_started',
      oldStartAt: null,
      newStartAt: '2026-09-01',
      oldEndAt: null,
      newEndAt: '2026-09-10',
      reason: null,
      operatorName: 'test',
    });

    // 级联删除
    await projRepo.remove(proj.id);

    expect(await db.projects.count()).toBe(0);
    expect(await db.stages.count()).toBe(0);
    expect(await db.tasks.count()).toBe(0);
    expect(await db.stageLogs.count()).toBe(0);
  });

  it('删除不存在的项目不抛错', async () => {
    const projRepo = new LocalProjectsRepository(db);
    await expect(projRepo.remove('nonexistent')).resolves.toBeUndefined();
  });
});
