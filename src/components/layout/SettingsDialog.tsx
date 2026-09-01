import { useMemo, useState } from 'react';

import { Database, FileDown, Settings, Trash2, X } from 'lucide-react';

import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { createLogExportIo } from './useLogExport';
import { clearLogs, dump, logUser } from '../../core/services/log.service';
import { useProjectsStore } from '../../store/useProjectsStore';

/**
 * 「设置」面板（顶栏右侧 · 所有角色可见）。
 *
 * 用户反馈：导出日志按钮藏在顶栏一堆小图标里不明显，且第一次点总是提示「暂无日志」——
 * 因为日志系统是**被动记录**的，正常浏览不会有错误、日常操作也不会埋点，所以 0 条是常态。
 * 为让「导出日志」好找、且不至于每次都空，本面板：
 *   - 作为「设置」抽屉承载：导出日志、当前日志条数、清空日志；
 *   - 首屏显示日志条数，空时给引导提示文案（而不是裸的"暂无日志"）；
 *   - 后续设置项（主题、数据源等）可继续往这里收。
 *
 * 边界：所有角色可用（导出日志不限管理员，调试友好）。破坏性动作（清空日志）走二次确认。
 */
export function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose(): void;
}): JSX.Element | null {
  const io = useMemo(() => createLogExportIo(), []);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const toast = useProjectsStore((s) => s.pushToast);

  // 打开时实时读一次日志条数（抽屉每次打开都刷新，避免静态旧值）
  const count = useMemo(() => dump().length, [open]);

  const onExport = (): void => {
    const n = io.export();
    onClose();
    toast('success', `日志已导出（${n} 条）`);
  };

  const onClear = (): void => {
    clearLogs();
    setConfirmClearOpen(false);
    logUser('设置', '清空日志');
    toast('success', '日志已清空');
  };

  return (
    <>
      <Modal open={open} onClose={onClose} placement="right" ariaLabel="设置">
        <div className="glass-strong flex h-full w-full flex-col overflow-y-auto rounded-none border-white/40 sm:max-w-md sm:rounded-l-3xl">
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-sand px-5 py-4">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-pine" aria-hidden />
              <h2 className="font-display text-base font-semibold text-ink">设置</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭设置"
              className="rounded-[8px] p-1.5 text-mist transition-colors hover:bg-sand hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>

          {/* 内容 */}
          <div className="flex-1 space-y-5 px-5 py-5">
            {/* 日志区 */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <Database size={14} className="text-mist" aria-hidden />
                  前端日志
                </h3>
                <span className="rounded-md bg-cream px-2 py-0.5 text-xs text-mist">
                  {count} 条
                </span>
              </div>

              {count === 0 ? (
                <p className="rounded-xl border border-sand bg-cream/60 px-3.5 py-3 text-xs leading-relaxed text-mist">
                  暂无日志。日志默认在{' '}
                  <strong className="text-ink">报错时</strong>或{' '}
                  <strong className="text-ink">执行关键操作</strong>（身份切换、备份导入导出）时
                  才记录。正常浏览页面不会有日志，属正常现象。遇到"输入法打不出字"这类问题时，
                  请先复现一次再回来导出。
                </p>
              ) : (
                <p className="rounded-xl border border-sand bg-cream/60 px-3.5 py-3 text-xs leading-relaxed text-mist">
                  已记录 <strong className="text-ink">{count}</strong> 条运行事件，可导出为 .log
                  文件发给开发。日志仅含运行记录与错误堆栈，不含项目/客户业务数据。
                </p>
              )}
            </section>
          </div>

          {/* 底部操作 */}
          <div className="space-y-2.5 border-t border-sand px-5 py-4">
            <button
              type="button"
              onClick={onExport}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-sand bg-cream/60 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-sand"
            >
              <FileDown size={15} className="text-mist" aria-hidden />
              导出日志
            </button>
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-sand px-4 py-2.5 text-sm text-mist transition-colors hover:bg-sand hover:text-clay"
            >
              <Trash2 size={15} className="text-mist" aria-hidden />
              清空日志
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmClearOpen}
        title="清空日志"
        confirmText="清空"
        onConfirm={onClear}
        onCancel={() => setConfirmClearOpen(false)}
      >
        <p>
          将清空当前 <strong>{count}</strong> 条前端日志。此操作不可恢复，如需排查问题建议先导出。
        </p>
      </ConfirmDialog>
    </>
  );
}
