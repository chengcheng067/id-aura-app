import { useRef, useState } from 'react';

import { Link, Navigate, useParams } from 'react-router-dom';

import { ArrowLeft, Download, FileText, Printer } from 'lucide-react';

import { useProjectsStore } from '../store/useProjectsStore';
import { useMembersStore } from '../store/useMembersStore';
import { useRoleGuard } from '../hooks/useRoleGuard';
import { StageStatus } from '../core/types/enums';
import { STAGE_BAR_COLORS } from '../components/timeline/stageColors';
import {
  buildScheduleSections,
  exportSchedulePng,
  schedulePngFileName,
} from '../lib/schedule-print';
import { totalDaysInclusive } from '../lib/date';

/**
 * 日程表打印视图（v0.3 变更 E）：只读，复用 stores 数据（AppShell bootstrap 已全量装载，零新查询）。
 * 权限：页内 isAdmin 守卫（打印内容含全项目+全员任务，属敏感信息，同备份权限语义）；
 *       bootstrap 完成前先渲染加载态（首帧 members 未装载时 isAdmin 恒 false，避免误判重定向）；
 *       成员/未进入访问 → 重定向首页。
 * 布局：页头（项目信息+工期+打印时间）→ 时间轴摘要（九阶段横向条+图例）→ 阶段分组任务表
 *       （任务标题 | 参与人（多人多值，未指派"—"）| 截止日 | 状态）→ 页脚（打印人+导出时间）。
 * 导出：打印（window.print）/ PDF（打印对话框另存为）/ PNG（html2canvas 动态 import）。
 * 打印样式：global.css @media print 强制浅色 A4、section 不跨页（与暗色主题解耦）。
 */
export function SchedulePrintPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const project = useProjectsStore((s) => s.projects.find((p) => p.id === id));
  const stages = useProjectsStore((s) => s.stages.filter((st) => st.projectId === id));
  const tasks = useProjectsStore((s) => s.tasks.filter((t) => t.projectId === id));
  const members = useMembersStore((s) => s.members);
  const { isAdmin, currentMember, hydrated } = useRoleGuard();

  const [pngBusy, setPngBusy] = useState(false);
  const [pdfHint, setPdfHint] = useState(false);
  const printRef = useRef<HTMLElement | null>(null);

  // bootstrap 完成前先展示加载态：首帧 members 尚未装载时 isAdmin 恒为 false，
  // 若此时直接走下方守卫会被静默重定向回首页（新窗口打开日程表即触发，旧身份用户尤甚）。
  if (!hydrated) {
    return <div className="py-16 text-center text-mist">正在装载日程表…</div>;
  }

  // 页内守卫：非管理员重定向（打印内容含全员任务，敏感信息）
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!project) {
    return (
      <div className="py-16 text-center text-mist">
        <p className="mb-3">未找到该项目。</p>
        <Link to="/" className="text-pine underline underline-offset-2">
          ← 返回项目列表
        </Link>
      </div>
    );
  }

  const sections = buildScheduleSections({ project, stages, tasks, members });
  const nowIso = new Date().toISOString();
  const nowText = `${nowIso.slice(0, 10)} ${nowIso.slice(11, 16)}`;

  const onPrint = (): void => {
    window.print();
  };

  const onExportPdf = (): void => {
    setPdfHint(true);
    window.print();
  };

  const onExportPng = async (): Promise<void> => {
    if (!printRef.current) return;
    setPngBusy(true);
    try {
      await exportSchedulePng(printRef.current, schedulePngFileName(project.name));
    } catch {
      useProjectsStore.getState().pushToast('error', 'PNG 导出失败，请改用「打印 / 另存为 PDF」。');
    } finally {
      setPngBusy(false);
    }
  };

  const statusColor = (status: StageStatus): string => {
    switch (status) {
      case StageStatus.InProgress:
        return 'bg-pine';
      case StageStatus.Completed:
        return 'bg-ink';
      case StageStatus.Delayed:
        return 'bg-clay';
      default:
        return 'bg-sand';
    }
  };

  /** 状态胶囊（浅色底+深色字：屏幕与打印浅色均清晰可读） */
  const statusChipCls = (status: StageStatus): string => {
    switch (status) {
      case StageStatus.InProgress:
        return 'bg-blue-100 text-blue-800';
      case StageStatus.Completed:
        return 'bg-slate-300 text-slate-700';
      case StageStatus.Delayed:
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-200 text-slate-700';
    }
  };

  const statusLabel = (status: StageStatus): string => {
    switch (status) {
      case StageStatus.InProgress:
        return '进行中';
      case StageStatus.Completed:
        return '已完成';
      case StageStatus.Delayed:
        return '延期';
      default:
        return '未开始';
    }
  };

  return (
    <div className="print-root mx-auto max-w-[900px] px-6 py-8">
      {/* 操作栏（打印时隐藏） */}
      <div className="no-print mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link
          to={`/project/${project.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-sand bg-paper px-3 py-1.5 text-mist transition-colors hover:bg-sand hover:text-ink"
        >
          <ArrowLeft size={14} /> 返回项目
        </Link>
        <span className="ml-auto" />
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 rounded-md border border-sand bg-paper px-3 py-1.5 text-mist transition-colors hover:bg-sand hover:text-ink"
        >
          <Printer size={14} /> 打印
        </button>
        <button
          type="button"
          onClick={onExportPdf}
          className="inline-flex items-center gap-1.5 rounded-md border border-sand bg-paper px-3 py-1.5 text-mist transition-colors hover:bg-sand hover:text-ink"
        >
          <FileText size={14} /> 导出 PDF
        </button>
        <button
          type="button"
          onClick={() => void onExportPng()}
          disabled={pngBusy}
          className="inline-flex items-center gap-1.5 rounded-md bg-pine px-3 py-1.5 text-white transition-colors hover:bg-pine-deep disabled:opacity-50"
        >
          <Download size={14} /> {pngBusy ? '生成中…' : '导出 PNG'}
        </button>
        {pdfHint && (
          <span className="w-full text-xs text-mist">
            已在打印对话框打开：请选择「另存为 PDF」即可导出。
          </span>
        )}
      </div>

      <div ref={(el) => { printRef.current = el; }}>
        {/* 页头：项目信息 */}
        <header className="mb-6 border-b-2 border-slate-200 pb-4 print:mb-4">
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {project.clientName && <span>客户：{project.clientName} · </span>}
            {project.address && <span>地址：{project.address} · </span>}
            工期：{project.plannedStartAt.slice(0, 10)} — {project.plannedEndAt.slice(0, 10)}（共{' '}
            {totalDaysInclusive(project.plannedStartAt.slice(0, 10), project.plannedEndAt.slice(0, 10))} 天）
          </p>
          <p className="mt-1 text-xs text-slate-500">打印时间：{nowText}</p>
        </header>

        {/* 时间轴摘要：九阶段横向条 + 图例 */}
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">时间轴摘要</h2>
          <div className="flex h-6 w-full overflow-hidden rounded-md border border-slate-300">
            {sections.map((s) => {
              const days =
                totalDaysInclusive(project.plannedStartAt.slice(0, 10), project.plannedEndAt.slice(0, 10)) || 1;
              const w = Math.max(
                12,
                Math.round(
                  (totalDaysInclusive(s.startAt, s.endAt) / days) * 100,
                ),
              );
              return (
                <div
                  key={s.orderIndex}
                  title={`${s.orderIndex}. ${s.name}（${s.startAt} — ${s.endAt} · ${statusLabel(s.status)}）`}
                  className="flex items-center justify-center border-r border-slate-300 text-[9px] font-medium text-slate-700 last:border-r-0"
                  style={{
                    width: `${w}%`,
                    backgroundColor: STAGE_BAR_COLORS[s.orderIndex] ?? '#BBB59D',
                  }}
                >
                  {s.orderIndex}
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            色块 = 阶段（1→9）；图例：
            {([StageStatus.NotStarted, StageStatus.InProgress, StageStatus.Completed, StageStatus.Delayed] as StageStatus[]).map(
              (st) => (
                <span key={st} className="ml-2 inline-flex items-center gap-1">
                  <span className={`inline-block h-2.5 w-2.5 rounded-sm ${statusColor(st)}`} />
                  {statusLabel(st)}
                </span>
              ),
            )}
            ；✓=已完成 □=未完成
          </p>
        </section>

        {/* 阶段分组任务表 */}
        {sections.map((s) => (
          <section key={`${s.orderIndex}-${s.name}`} className="schedule-section mb-5">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-700">
                {s.orderIndex}
              </span>
              {s.name}
              <span className="text-xs font-normal text-slate-500">
                {s.startAt} — {s.endAt}
              </span>
              <span
                className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${statusChipCls(s.status)}`}
              >
                {statusLabel(s.status)}
              </span>
            </h3>
            {s.tasks.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
                无任务
              </p>
            ) : (
              <table className="schedule-table">
                <thead>
                  <tr className="bg-slate-100 text-left text-slate-700">
                    <th className="w-1/2">任务标题</th>
                    <th className="w-1/4">参与人</th>
                    <th className="w-[18%]">截止日</th>
                    <th className="w-[12%]">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {s.tasks.map((t) => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>{t.assigneeNames.length > 0 ? t.assigneeNames.join('、') : '—'}</td>
                      <td>{t.dueDate ?? '—'}</td>
                      <td>{t.done ? '✓ 完成' : '□ 未完成'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}

        {/* 页脚 */}
        <footer className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500">
          打印人：{currentMember?.name ?? '—'} · 导出时间：{nowText} · ID Plan 日程表
        </footer>
      </div>
    </div>
  );
}

export type { StageStatus };
