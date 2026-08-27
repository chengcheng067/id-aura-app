import { Navigate } from 'react-router-dom';

import { useRoleGuard, homeRouteTarget } from '../../hooks/useRoleGuard';
import { HomePage } from '../../pages/HomePage';

/**
 * `/` 索引路由守卫（权限矩阵 3.5 #1，主防线）：
 *   isMember → 重定向 `/my-tasks`（成员看不到项目全貌）
 *   其余     → 正常渲染首页
 * 注意：isMember 推导基于 currentMemberId → member.roleKind，
 *       未进入身份（role=null）视为非成员，仍可看首页（first-run 引导前）。
 */
export function HomeRouteGuard(): JSX.Element {
  const { isMember } = useRoleGuard();

  if (isMember) {
    return <Navigate to={homeRouteTarget(true)} replace />;
  }
  return <HomePage />;
}
