import { Outlet } from 'react-router-dom';

import { TopBar } from './TopBar';
import { IdentityDialog } from './IdentityDialog';
import { useProjectsBootstrap } from '../../hooks/useProjectsBootstrap';
import { useFirstRunGate } from '../../hooks/useFirstRunGate';
import { useProjectsStore } from '../../store/useProjectsStore';

/**
 * 应用壳：米白底大面积留白 + 顶栏 + 路由出口；挂载全局 Toast 容器。
 * 启动引导（全量装载）在此触发一次；首启身份闸门也在此挂载。
 */
export function AppShell(): JSX.Element {
  useProjectsBootstrap();
  useFirstRunGate();
  const toasts = useProjectsStore((s) => s.toasts);
  const dismissToast = useProjectsStore((s) => s.dismissToast);

  return (
    <div className="min-h-screen bg-cream font-body text-ink">
      <TopBar />
      <main className="mx-auto w-full max-w-[1200px] px-6 pb-16 pt-6">
        <Outlet />
      </main>
      {/* 身份进入对话框（first-run 管理员确立 / 成员姓名进入 / 未命中提示） */}
      <IdentityDialog />
      {/* 瞬时 Toast 层（≤2s，无 loading 圈；v0.3 玻璃化） */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismissToast(t.id)}
            className={`toast-enter glass-medium pointer-events-auto rounded-lg px-4 py-2 text-sm shadow-soft ${
              t.kind === 'success'
                ? 'text-[#56d48c]'
                : t.kind === 'error'
                  ? 'text-[#ff7a5c]'
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
