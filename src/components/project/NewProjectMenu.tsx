import { PenLine } from 'lucide-react';

import { useUiStore } from '../../store/useUiStore';

/**
 * 顶栏「+ 新建项目」（v0.3：移除「导入合同建档」入口，收敛为单入口）。
 * 点击直接打开「手动建档」（全局挂载于 AppShell，走 store.manualFormOpen）。
 */
export function NewProjectMenu(): JSX.Element {
  const openManual = useUiStore((s) => s.openManualForm);

  return (
    <button
      type="button"
      onClick={openManual}
      className="btn-aura inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white"
    >
      <PenLine size={14} />
      新建项目
    </button>
  );
}

/* ---------------------- 跨组件广播（手动表单显隐） ----------------------
 * v0.3 起手动表单改走 useUiStore.manualFormOpen 全局状态，
 * 该广播总线仅保留给未迁移的调用方（如旧空态/旧测试），避免移除后编译断链。
 * 新代码统一使用 store，不再依赖此总线。
 */

type Listener = (open: boolean) => void;
const manualListeners = new Set<Listener>();

/** 广播手动建档表单显隐意图 */
export function broadcastManualForm(open: boolean): void {
  manualListeners.forEach((l) => l(open));
}

/** 订阅手动表单显隐；返回取消订阅函数 */
export function subscribeManualForm(listener: Listener): () => void {
  manualListeners.add(listener);
  return () => {
    manualListeners.delete(listener);
  };
}
