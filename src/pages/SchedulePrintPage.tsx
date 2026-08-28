import { useMemo, useRef, useState } from 'react';

import { Link, Navigate, useParams } from 'react-router-dom';

import { ArrowLeft, CalendarDays, Download, FileText, Printer } from 'lucide-react';

import { useProjectsStore } from '../store/useProjectsStore';
import { useMembersStore } from '../store/useMembersStore';
import { useRoleGuard } from '../hooks/useRoleGuard';
import { StageStatus, ScheduleBasis, SCHEDULE_BASIS_LABELS } from '../core/types/enums';
import { resolveStageColorIndex } from '../core/template/stage-fallback';
import { STAGE_BAR_COLORS } from '../components/timeline/stageColors';
import {
  buildScheduleSections,
  paginateSections,
  exportSchedulePngPages,
  schedulePngFileName,
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  type ScheduleSection,
} from '../lib/schedule-print';
import { totalDaysInclusive } from '../lib/date';

/**
 * 日程表打印视图（v0.4.1 重做）：
 *   旧版把整份日程表一次性 html2canvas 截成单张 PNG → 内容越多图越细长，
 *   且 @media print 的 A4 / break-inside 规则对屏幕渲染无效（表格被拉断、颜色割裂）。
 * 现改为：按 A4 页高估算分页 → 每页独立渲染为白纸（屏幕态即所见即所得）→ 逐页导出 PNG。
 * 第一页承载项目信息 + 时间轴摘要；每页含页眉（项目名 / 工期或页码）、页脚（打印人 / 页码 x/y）。
 * 导出：打印（window.print）/ PDF（打印对话框另存为）/ PNG（逐页，多页时文件名带 -p1ofN）。
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
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);

  // ⚠️ 所有 Hook 必须在任何条件提前 return 之前调用完成，
  //    否则不同 render 路径下 React 记录的 Hook 数量不一致会触发 error #310。
  const sections = useMemo(
    () => (project ? buildScheduleSections({ project, stages, tasks, members }) : []),
    [project, stages, tasks, members],
  );
  const pages = useMemo(() => paginateSections(sections), [sections]);
  const nowIso = new Date().toISOString();

  // bootstrap 完成前先展示加载态（首帧 members 未装载时 isAdmin 恒 false，避免误判重定向）
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
  const nowText = `${nowIso.slice(0, 10)} ${nowIso.slice(11, 16)}`;
  const startAt = project.plannedStartAt.slice(0, 10);
  const endAt = project.plannedEndAt.slice(0, 10);
  const totalDays = totalDaysInclusive(startAt, endAt);

  const onPrint = (): void => window.print();

  const onExportPdf = (): void => {
    setPdfHint(true);
    window.print();
  };

  const onExportPng = async (): Promise<void> => {
    const els = pageRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (els.length === 0) return;
    setPngBusy(true);
    try {
      await exportSchedulePngPages(els, schedulePngFileName(project.name));
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

  /** 状态胶囊（浅色底 + 深色字：纸面与打印均清晰可读） */
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
    <div className="print-root mx-auto w-full max-w-[900px] px-6 py-8">
      {/* 操作栏（打印时隐藏） */}
      <div className="no-print mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link
          to={`/project/${project.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-sand bg-paper px-3 py-1.5 text-mist transition-colors hover:bg-sand hover:text-ink"
        >
          <ArrowLeft size={14} /> 返回项目
        </Link>
        <span className="ml-auto" />
        <span className="text-xs text-mist">共 {pages.length} 页 · A4</span>
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
        <Link
          to={`/project/${project.id}/calendar-print`}
          className="inline-flex items-center gap-1.5 rounded-md border border-sand bg-paper px-3 py-1.5 text-mist transition-colors hover:bg-sand hover:text-ink"
        >
          <CalendarDays size={14} /> 月历视图
        </Link>
        <button
          type="button"
          onClick={() => void onExportPng()}
          disabled={pngBusy}
          className="inline-flex items-center gap-1.5 rounded-md bg-pine px-3 py-1.5 text-white transition-colors hover:bg-pine-deep disabled:opacity-50"
        >
          <Download size={14} /> {pngBusy ? '生成中…' : `导出 PNG${pages.length > 1 ? `（${pages.length} 张）` : ''}`}
        </button>
        {pdfHint && (
          <span className="w-full text-xs text-mist">
            已在打印对话框打开：请选择「另存为 PDF」即可导出。
          </span>
        )}
      </div>

      {/* A4 分页纸面 */}
      {pages.map((pageSections, idx) => (
        <div
          key={idx}
          ref={(el) => {
            pageRefs.current[idx] = el;
          }}
          className="a4-page mx-auto mb-6 flex flex-col"
          style={{ width: A4_WIDTH_PX, minHeight: A4_HEIGHT_PX, padding: 40 }}
        >
          {/* 页眉 */}
          <div className="mb-3 flex items-baseline justify-between border-b border-slate-200 pb-2">
            <span className="text-[13px] font-semibold text-slate-800">{project.name}</span>
            <span className="text-[11px] text-slate-500">
              {idx === 0 ? `工期 ${startAt} — ${endAt}（共 ${totalDays} 天）` : `第 ${idx + 1} 页`}
            </span>
          </div>

          {/* 第一页：项目信息 + 时间轴摘要 */}
          {idx === 0 && (
            <>
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {project.clientName && <span>客户：{project.clientName} · </span>}
                {project.address && <span>地址：{project.address} · </span>}
                排期基准：{SCHEDULE_BASIS_LABELS[project.scheduleBasis] ?? SCHEDULE_BASIS_LABELS[ScheduleBasis.Calendar]} · 打印时间：{nowText}
              </p>

              <section className="mt-3">
                <h2 className="mb-1.5 text-sm font-semibold text-slate-800">时间轴摘要</h2>
                <div className="flex h-6 w-full overflow-hidden rounded border border-slate-300">
                  {sections.map((s) => {
                    const days = totalDaysInclusive(s.startAt, s.endAt) || 1;
                    return (
                      <div
                        key={s.orderIndex}
                        title={`${s.orderIndex}. ${s.name}（${s.startAt} — ${s.endAt} · ${statusLabel(s.status)}）`}
                        className="schedule-bar-segment flex min-w-0 items-center justify-center border-r border-slate-300 text-[9px] font-medium text-slate-700 last:border-r-0"
                        style={{
                          // 按天数比例分配宽度（旧实现 Math.max(12,…) 会导致 9 段合计溢出）
                          flexGrow: days,
                          flexBasis: 0,
                          backgroundColor: STAGE_BAR_COLORS[resolveStageColorIndex(s.orderIndex, s.colorIndex)] ?? '#BBB59D',
                        }}
                      >
                        {s.orderIndex}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  色块 = 阶段（1→9）；图例：
                  {(
                    [
                      StageStatus.NotStarted,
                      StageStatus.InProgress,
                      StageStatus.Completed,
                      StageStatus.Delayed,
                    ] as StageStatus[]
                  ).map((st) => (
                    <span key={st} className="ml-2 inline-flex items-center gap-1">
                      <span
                        className={`schedule-status-dot inline-block h-2.5 w-2.5 rounded-sm ${statusColor(st)}`}
                      />
                      {statusLabel(st)}
                    </span>
                  ))}
                  ；✓=已完成 □=未完成
                </p>
              </section>
            </>
          )}

          {/* 本页阶段分组任务表 */}
          <div className="mt-3 flex-1">
            {pageSections.map((s) => (
              <StageBlock key={`${s.orderIndex}-${s.name}`} section={s} chipCls={statusChipCls} label={statusLabel} />
            ))}
          </div>

          {/* 页脚 */}
          <footer className="mt-4 flex items-center justify-between border-t border-slate-200 pt-2 text-[11px] text-slate-500">
            <span>打印人：{currentMember?.name ?? '—'} · {nowText}</span>
            <span>
              第 {idx + 1} / {pages.length} 页 · ID Plan 日程表
            </span>
          </footer>
        </div>
      ))}
    </div>
  );
}

function StageBlock({
  section,
  chipCls,
  label,
}: {
  section: ScheduleSection;
  chipCls(status: StageStatus): string;
  label(status: StageStatus): string;
}): JSX.Element {
  return (
    <section className="schedule-section mb-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-700">
          {section.orderIndex}
        </span>
        {section.name}
        <span className="text-xs font-normal text-slate-500">
          {section.startAt} — {section.endAt}
        </span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${chipCls(section.status)}`}>
          {label(section.status)}
        </span>
      </h3>
      {section.tasks.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
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
            {section.tasks.map((t) => (
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
  );
}

export type { StageStatus };
