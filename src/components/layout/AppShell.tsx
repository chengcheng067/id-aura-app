import { Outlet } from 'react-router-dom';

import { TopBar } from './TopBar';
import { IdentityDialog } from './IdentityDialog';
import { ManualFallbackForm } from '../contract-wizard/ManualFallbackForm';
import { useProjectsBootstrap } from '../../hooks/useProjectsBootstrap';
import { useFirstRunGate } from '../../hooks/useFirstRunGate';
import { useProjectsStore } from '../../store/useProjectsStore';
import { useUiStore } from '../../store/useUiStore';

/**
 * 应用壳：米白底大面积留白 + 顶栏 + 路由出口；挂载全局 Toast 容器。
 * 启动引导（全量装载）在此触发一次；首启身份闸门也在此挂载。
 */
export function AppShell(): JSX.Element {
  useProjectsBootstrap();
  useFirstRunGate();
  const toasts = useProjectsStore((s) => s.toasts);
  const dismissToast = useProjectsStore((s) => s.dismissToast);
  const manualFormOpen = useUiStore((s) => s.manualFormOpen);
  const closeManualForm = useUiStore((s) => s.closeManualForm);

  return (
    <div className="min-h-screen bg-cream font-body text-ink">
      <TopBar />
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      {/* 身份进入对话框（first-run 管理员确立 / 成员姓名进入 / 未命中提示） */}
      <IdentityDialog />
      {/* 手动建档兜底：全局挂载，「新建项目」直接打开（v0.3 移除导入合同建档入口后） */}
      <ManualFallbackForm open={manualFormOpen} onClose={closeManualForm} />
      {/* 瞬时 Toast 层（≤2s，无 loading 圈；v0.3 玻璃化） */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismissToast(t.id)}
            className={`toast-enter glass-medium pointer-events-auto rounded-lg px-4 py-2 text-sm shadow-soft ${
              t.kind === 'success'
                ? 'text-moss'
                : t.kind === 'error'
                  ? 'text-clay'
                  : 'text-ink'
            }`}
          >
            {t.message}
          </button>
        ))}
      </div>
    </div>
  );
}
