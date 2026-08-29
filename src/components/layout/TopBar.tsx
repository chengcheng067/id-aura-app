import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';

import { NewProjectMenu } from '../project/NewProjectMenu';
import { MemberIdentityPicker } from './MemberIdentityPicker';
import { SaveBackupButton } from './SaveBackupButton';
import { LoadBackupButton } from './LoadBackupButton';
import { RestPolicySettingsButton } from '../settings/RestPolicyDialog';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useUiStore } from '../../store/useUiStore';
import { cn } from '../../lib/cn';

/**
 * 应用栏（严格对齐参考稿 §应用栏）：
 *   浮起 glass-strong / 圆角 20 / padding 16 卡片（不再是通栏 sticky + border-b）；
 *   左 = logo（40×40 圆角12，Aura 渐变走 btn-aura，不写裸 hex）+ 品牌名 18/700 + 副标 11 次级；
 *   中 = 480 宽搜索框（圆角14，真实过滤项目名 / 客户名，非占位）；
 *   右 = 导航 + 备份 + 视图切换（参考稿 toggle 形态）+ 新建 + 身份入口。
 * 既有功能（项目/我的任务导航、新建项目、保存/加载备份、身份切换）全部保留，仅重排为参考稿形态。
 */
export function TopBar(): JSX.Element {
  const location = useLocation();
  const { isAdmin } = useRoleGuard();
  const homeViewMode = useUiStore((s) => s.homeViewMode);
  const setHomeViewMode = useUiStore((s) => s.setHomeViewMode);
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const searchRef = useRef<HTMLInputElement>(null);

  /**
   * ⌘K / Ctrl+K / Alt+K 全局快捷键：聚焦搜索框。
   * 兼容桌面（⌘K 徽标文案）与用户习惯的 Alt+K 触发方式。
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (
        (e.metaKey || e.ctrlKey || e.altKey) &&
        e.key.toLowerCase() === 'k'
      ) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onHome = location.pathname === '/';
  const onProjectPage = onHome || location.pathname.startsWith('/project');

  const navClass = (active: boolean): string =>
    cn(
      'rounded-[8px] px-3 py-1.5 text-sm transition-colors hover:bg-sand',
      active ? 'text-pine' : 'text-mist',
    );

  return (
    <header className="relative z-40 print:hidden">
      <div className="mx-auto w-full max-w-[1600px] px-8 pt-6">
        <div className="glass-strong flex items-center justify-between gap-6 rounded-[20px] border border-sand p-4">
          {/* 左：logo + 品牌 */}
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <span
              className="btn-aura flex h-10 w-10 items-center justify-center rounded-[12px]"
              aria-hidden
            >
              <span className="text-[16px] text-ink">▦</span>
            </span>
            <span className="flex flex-col">
              <span className="font-display text-lg font-bold leading-6 text-ink">ID Plan</span>
              <span className="text-xs leading-[14px] text-mist">室内设计项目管理</span>
            </span>
          </Link>

          {/* 中：搜索框（真实过滤，桌面端 480 宽） */}
          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <div className="flex w-[480px] max-w-full items-center gap-2.5 rounded-[14px] border border-sand bg-cream/60 p-3">
              <span className="text-sm text-mist" aria-hidden>
                ⌕
              </span>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索项目、任务或客户…"
                aria-label="搜索项目、任务或客户"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-mist"
              />
              <button
                type="button"
                onClick={() => {
                  searchRef.current?.focus();
                  searchRef.current?.select();
                }}
                aria-label="聚焦搜索（快捷键 ⌘K / Ctrl+K / Alt+K）"
                className="rounded-[8px] border border-sand px-2 py-1 text-xs text-mist transition-colors hover:bg-sand hover:text-ink"
              >
                ⌘K
              </button>
            </div>
          </div>

          {/* 右：导航 + 备份 + 视图切换 + 新建 + 身份 */}
          <div className="flex shrink-0 items-center gap-3">
            {isAdmin && (
              <Link to="/" className={navClass(location.pathname === '/')}>
                项目
              </Link>
            )}
            <Link to="/my-tasks" className={navClass(location.pathname === '/my-tasks')}>
              我的任务
            </Link>

            {isAdmin && (
              <div className="flex items-center gap-1">
                <SaveBackupButton />
                <LoadBackupButton />
                <RestPolicySettingsButton />
              </div>
            )}

            {/* 视图切换（仅首页）：参考稿形态 = 圆角12 容器内 padding4，选中项 圆角9 半透明蓝底蓝字 */}
            {onHome && (
              <div
                role="tablist"
                aria-label="首页视图切换"
                className="flex items-center gap-1 rounded-[12px] border border-sand bg-cream/60 p-1"
              >
                {(
                  [
                    { key: 'kanban' as const, label: '看板', icon: '▤' },
                    { key: 'calendar' as const, label: '月历', icon: '▥' },
                  ]
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    role="tab"
                    aria-selected={homeViewMode === o.key}
                    onClick={() => setHomeViewMode(o.key)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-sm font-medium transition-colors',
                      homeViewMode === o.key
                        ? 'bg-pine-soft text-pine'
                        : 'text-mist hover:bg-sand hover:text-ink',
                    )}
                  >
                    <span aria-hidden>{o.icon}</span>
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            {isAdmin && onProjectPage && <NewProjectMenu />}
            <MemberIdentityPicker />
          </div>
        </div>
      </div>
    </header>
  );
}
