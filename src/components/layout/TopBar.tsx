import { Link, useLocation } from 'react-router-dom';

import { NewProjectMenu } from '../project/NewProjectMenu';
import { MemberIdentityPicker } from './MemberIdentityPicker';
import { SaveBackupButton } from './SaveBackupButton';
import { LoadBackupButton } from './LoadBackupButton';
import { useRoleGuard } from '../../hooks/useRoleGuard';

/**
 * 顶栏：「ID Plan」品牌 + 按角色条件渲染的导航/新建/备份 + 身份入口。
 * v0.3 变更 B/D：
 *   - header 玻璃化（glass-medium，含顶部高光/内辉光，见 global.css）；print:hidden 配合日程表打印视图；
 *   - 品牌位加 glow-aura-weak 弱辉光；
 *   - 「备份」下拉（BackupMenu）拆分为「保存备份 / 加载备份」两个独立按钮（SaveBackupButton / LoadBackupButton）。
 * 权限矩阵 3.5（#2/#3/#4）：
 *   - 「项目」导航、新建项目、备份按钮 仅 admin 可见；
 *   - 「我的任务」全角色可见；
 *   - 成员视角顶栏只有：品牌 + 我的任务 + 身份入口。
 */
export function TopBar(): JSX.Element {
  const location = useLocation();
  const { isAdmin } = useRoleGuard();

  return (
    <header className="glass-medium sticky top-0 z-40 border-b border-sand print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-6 px-6">
        <Link to="/" className="glow-aura-weak flex items-baseline gap-2">
          <span className="font-display text-display-md tracking-wide">ID Plan</span>
          <span className="hidden text-xs text-mist sm:inline">节点管理</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          {isAdmin && (
            <Link
              to="/"
              className={`rounded-md px-3 py-1.5 transition-colors hover:bg-sand ${
                location.pathname === '/' ? 'text-pine' : 'text-mist'
              }`}
            >
              项目
            </Link>
          )}
          <Link
            to="/my-tasks"
            className={`rounded-md px-3 py-1.5 transition-colors hover:bg-sand ${
              location.pathname === '/my-tasks' ? 'text-pine' : 'text-mist'
            }`}
          >
            我的任务
          </Link>
        </nav>

        {isAdmin && <NewProjectMenu />}

        <div className="flex items-center gap-2">
          <SaveBackupButton />
          <LoadBackupButton />
        </div>

        <MemberIdentityPicker />
      </div>
    </header>
  );
}
