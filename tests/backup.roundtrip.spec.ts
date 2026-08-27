/**
 * 备份往返不变式（fake-indexeddb 环境）：
 *   导出 → 清库 → 导入 → 再导出，两次 data 逐表 diff 为空；
 *   坏 JSON / 结构不符 → 拒绝且不落库。
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { installFakeIndexedDB } from './setup';
import { createRepositories } from '../src/core/repositories';
import type { IRepositoryBundle } from '../src/core/repositories/interfaces';
import { BackupService, validateBackupJson } from '../src/core/services/backup.service';
import { previewSplit } from '../src/core/template/split';
import { ProjectService } from '../src/core/services/project.service';
import type { Project } from '../src/core/types/entities';

let bundle: IRepositoryBundle;

beforeAll(async () => {
  await installFakeIndexedDB();
});

beforeEach(async () => {
  // 每个用例独立内存库（fake-indexeddb 的 indexedDB 缓存同 module 实例——
  // 这里用一个固定库名 + 每次清空的方式保证隔离）
  bundle = await createRepositories({ dataSource: 'local' });
});

/** 造一份数据齐备的库：1 项目 × 9 阶段 × 若干任务 + 流水 + 设置 */
async function seedData(): Promise<Project> {
  const projects = new ProjectService({
    projects: bundle.projects,
    bundle,
  });
  const drafts = previewSplit({ startAt: '2026-08-01', endAt: '2026-12-31' });
  const project = await projects.createProjectFromContract(
    {
      projectName: '望江楼茶空间',
      projectType: 'tea_space' as never,
      address: '成都市青羊区',
      clientName: '测试甲方',
      contractAmount: 880000,
      signedAt: '2026-07-20T00:00:00.000Z',
      startAt: '2026-08-01',
      endAt: '2026-12-31',
      stageOverrides: {},
      createdByManual: false,
      sourceFileName: null,
      rawTextDigest: 'abcd1234',
      parsedResultJsonSnapshot: '{}',
    },
    drafts,
  );

  await bundle.members.insert({
    name: '许工',
    role: '主案',
    contact: null,
    avatarColor: '#3D6B5B',
  });

  const tasks = await bundle.tasks.listByProject(project.id);
  if (tasks[0]) {
    await bundle.tasks.update(tasks[0].id, { done: true });
  }
  return project;
}

function normalize(pkg: unknown): string {
  const p = JSON.parse(
    JSON.stringify(pkg, (key, value) => (key === 'exportedAt' ? undefined : value)),
  ) as import('../src/core/types/dto').BackupPackage;
  // 排序保证 diff 稳定
  for (const key of Object.keys(p.data) as Array<keyof typeof p.data>) {
    p.data[key].sort((a: { id?: string; key?: string }, b: { id?: string; key?: string }) =>
      String(a.id ?? a.key ?? '').localeCompare(String(b.id ?? b.key ?? '')),
    );
  }
  return JSON.stringify(p);
}

describe('backup：导出→清库→导入→逐表 diff 为空', () => {
  it('roundtrip 数据零丢失', async () => {
    await seedData();

    const svc = new BackupService(bundle);
    const exported1 = await svc.exportAll();
    expect(exported1.data.projects).toHaveLength(1);
    expect(exported1.data.stages).toHaveLength(9);
    expect(exported1.data.tasks.length).toBeGreaterThan(0);
    expect(exported1.data.logs.length).toBeGreaterThan(0); // created 流水

    // 清库（导入自身即清库重建；这里先写一笔垃圾数据证明导入会整体替换）
    await bundle.projects.insert({
      name: '应被覆盖的脏数据',
      type: 'dining' as never,
      address: '',
      clientName: '',
      contractAmount: null,
      signedAt: null,
      plannedStartAt: '2026-01-01',
      plannedEndAt: '2026-02-01',
      coverColor: null,
    });

    await svc.importAndReplace(exported1);

    const exported2 = await svc.exportAll();
    expect(normalize(exported2)).toBe(normalize(exported1));
  });

  it('流水表（append-only）完整保真', async () => {
    await seedData();
    const stages = await bundle.stages.listByProject((await firstProjectId()));
    const stageLogs = await bundle.logs.listStageLogsByStage(stages[0]!.id);

    const svc = new BackupService(bundle);
    const pkg = await svc.exportAll();
    await svc.importAndReplace(pkg);

    const after = await bundle.logs.listStageLogsByStage(stages[0]!.id);
    expect(after).toHaveLength(stageLogs.length);
  });

  it('含多值 assigneeIds 任务的 roundtrip 保真（v0.3 键序稳定）', async () => {
    const project = await seedData();
    const tasks = await bundle.tasks.listByProject(project.id);
    expect(tasks.length).toBeGreaterThan(0);
    // 多选指派：assigneeIds 多人 + assigneeId 同步为第一参与人
    await bundle.tasks.update(tasks[0]!.id, {
      assigneeIds: ['mem_a', 'mem_b'],
      assigneeId: 'mem_a',
    });

    const svc = new BackupService(bundle);
    const exported1 = await svc.exportAll();
    const withMulti = exported1.data.tasks.find((t) => t.id === tasks[0]!.id);
    expect(withMulti?.assigneeIds).toEqual(['mem_a', 'mem_b']);
    expect(withMulti?.assigneeId).toBe('mem_a');

    await svc.importAndReplace(exported1);
    const exported2 = await svc.exportAll();
    expect(normalize(exported2)).toBe(normalize(exported1));

    // 导入后 DB 行多值保真 + 参与人包含语义
    const after = await bundle.tasks.listByProject(project.id);
    const multi = after.find((t) => t.id === tasks[0]!.id);
    expect(multi?.assigneeIds).toEqual(['mem_a', 'mem_b']);
    const mine = await bundle.tasks.listByAssignee('mem_b');
    expect(mine.map((t) => t.id)).toContain(tasks[0]!.id);
  });
});

describe('backup：坏包拒绝（不允许半套写入）', () => {
  it('meta.app 错误 → 抛 Validation 且库未被清空', async () => {
    await seedData();
    const before = await bundle.projects.list({ status: 'all' });
    expect(before.length).toBeGreaterThan(0);

    const evil = {
      meta: { app: 'not-changxia', schemaVersion: 1, exportedAt: new Date().toISOString() },
      data: {
        projects: [],
        stages: [],
        tasks: [],
        members: [],
        assignments: [],
        logs: [],
        contracts: [],
        settings: [],
      },
    };
    expect(() => validateBackupJson(evil)).toThrowError(/校验失败/);

    const svc = new BackupService(bundle);
    await expect(svc.importAndReplace(evil as never)).rejects.toThrowError();
    // 库未被动
    const after = await bundle.projects.list({ status: 'all' });
    expect(after).toHaveLength(before.length);
  });

  it('缺表 / 非数组字段 → 校验失败', () => {
    const broken = {
      meta: { app: 'changxia', schemaVersion: 1, exportedAt: '2026-09-01T00:00:00.000Z' },
      data: {
        projects: [],
        stages: {},
        tasks: [],
        members: [],
        assignments: [],
        logs: [],
        contracts: [],
        settings: [],
      },
    };
    expect(() => validateBackupJson(broken)).toThrowError(/校验失败/);
  });
});

async function firstProjectId(): Promise<string> {
  const rows = await bundle.projects.list({ status: 'all' });
  return rows[0]!.id;
}
