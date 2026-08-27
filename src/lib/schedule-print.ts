/**
 * 日程表打印视图的数据组装（v0.3 变更 E，纯函数可测）。
 * 只读聚合：阶段分组任务表 + 时间轴摘要所需的最小数据形状。
 * 打印视图均为管理员打开（路由守卫 isAdmin），参与人直接显示姓名。
 */

import type { Member, Project, Stage, Task } from '../core/types/entities';
import type { StageStatus } from '../core/types/enums';
import { taskAssigneeIds } from '../hooks/useRoleGuard';

/** 打印表单行：任务标题 | 参与人（多人多值，未指派 → [] → 页面渲染「—」）| 截止日 | 状态 */
export interface ScheduleTaskRow {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  /** 参与人姓名列表（未指派 → []） */
  assigneeNames: string[];
}

/** 按阶段分组的一个 section（无任务 → tasks=[] → 页面显示「无任务」空行） */
export interface ScheduleSection {
  orderIndex: number;
  name: string;
  startAt: string;
  endAt: string;
  status: StageStatus;
  tasks: ScheduleTaskRow[];
}

/**
 * 组装日程表 section：
 *   - 阶段按 orderIndex 1→9 排序（仅 visible 阶段）；
 *   - 任务按 orderIndex 排序；
 *   - 参与人 = taskAssigneeIds(task) 映射成员姓名（id 找不到 → 显示 id 兜底）；
 *   - 未指派 → assigneeNames=[]。
 */
export function buildScheduleSections(opts: {
  project: Project;
  stages: Stage[];
  tasks: Task[];
  members: Member[];
}): ScheduleSection[] {
  const memberName = (id: string): string =>
    opts.members.find((m) => m.id === id)?.name ?? id;

  const visibleStages = opts.stages
    .filter((s) => s.projectId === opts.project.id && s.visible !== false)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  return visibleStages.map((s) => {
    const stageTasks = opts.tasks
      .filter((t) => t.stageId === s.id)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id));
    return {
      orderIndex: s.orderIndex,
      name: s.name,
      startAt: s.startAt.slice(0, 10),
      endAt: s.endAt.slice(0, 10),
      status: s.status,
      tasks: stageTasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate?.slice(0, 10) ?? null,
        done: t.done,
        assigneeNames: taskAssigneeIds(t).map(memberName),
      })),
    };
  });
}

/**
 * 导出 PNG（html2canvas 动态 import——打印视图低频使用，避免主包体积增大）。
 * jsdom 测试环境无 canvas，不调用；返回 Promise<void> 供页面 await 并 toast。
 */
export async function exportSchedulePng(
  element: HTMLElement,
  fileName: string,
): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) {
    throw new Error('PNG 导出失败：无法生成图像数据。');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** 打印文件名（用户可见物）：id-plan-schedule-<项目名>-<时间戳>.png */
export function schedulePngFileName(projectName: string, now: Date = new Date()): string {
  const ts = now.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const safeName = projectName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 24);
  return `id-plan-schedule-${safeName || 'project'}-${ts}.png`;
}
