import { useEffect, useRef, useState } from 'react';

import { ChevronDown, FileText, PenLine, FolderPlus } from 'lucide-react';

import { useUiStore } from '../../store/useUiStore';

/** 顶栏「+ 新建项目」下拉（双入口）：导入合同建档 / 手动建档 */
export function NewProjectMenu(): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const openWizard = useUiStore((s) => s.openContractWizard);
  // 手动表单的显隐由 HomePage 局部渲染（这里仅广播意图）
  const setOpenManual = broadcastManualForm;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative ml-auto md:ml-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-aura inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white"
      >
        新建项目 <ChevronDown size={14} />
      </button>

      {open && (
        <div className="glass-medium menuFadeIn absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-sand py-1 shadow-soft">
          <MenuItem
            icon={<FileText size={15} />}
            title="导入合同建档"
            desc="粘贴 / 上传，自动识别关键日期"
            onClick={() => {
              setOpen(false);
              openWizard();
            }}
          />
          <MenuItem
            icon={<PenLine size={15} />}
            title="手动建档"
            desc="先建空项目，后补录合同"
            onClick={() => {
              setOpen(false);
              setOpenManual(true);
            }}
          />
          <div className="mt-1 border-t border-sand px-3 pb-1 pt-1.5 text-[11px] leading-4 text-mist">
            <FolderPlus size={11} className="mr-1 inline" />
            扫描件无法识别？任何情况下都可以手动建档。
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick(): void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-sand"
    >
      <span className="mt-0.5 text-pine">{icon}</span>
      <span>
        <span className="block text-sm text-ink">{title}</span>
        <span className="block text-xs text-mist">{desc}</span>
      </span>
    </button>
  );
}

/* ---------------------- 极简跨组件广播（手动表单显隐） ---------------------- */

type Listener = (open: boolean) => void;
const manualListeners = new Set<Listener>();

/** 广播手动建档表单显隐意图 */
export function broadcastManualForm(open: boolean): void {
  manualListeners.forEach((l) => l(open));
}

/** 订阅手动表单显隐（HomePage 等页面级组件用）；返回取消订阅函数 */
export function subscribeManualForm(listener: Listener): () => void {
  manualListeners.add(listener);
  return () => {
    manualListeners.delete(listener);
  };
}
