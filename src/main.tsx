import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  Navigate,
  RouteObject,
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom';

import { RepoProvider } from './di/repository.provider';
import './styles/global.css';
import { AppShell } from './components/layout/AppShell';
import { HomeRouteGuard } from './components/layout/HomeRouteGuard';
import { MyTasksPage } from './pages/MyTasksPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { SchedulePrintPage } from './pages/SchedulePrintPage';

/**
 * 应用路由表：
 *   /                          首页·项目列表（HomeRouteGuard：isMember 重定向 /my-tasks）
 *   /project/:id               项目详情·九阶段时间轴主视图
 *   /project/:id/schedule-print 日程表打印视图（v0.3 变更 E；页内 isAdmin 守卫，复用 stores 零新查询）
 *   /my-tasks                  我的任务（成员视角）
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeRouteGuard /> },
      { path: 'project/:id', element: <ProjectDetailPage /> },
      { path: 'project/:id/schedule-print', element: <SchedulePrintPage /> },
      { path: 'my-tasks', element: <MyTasksPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ] satisfies RouteObject[],
  },
]);

/**
 * 应用装配点：
 *   RepoProvider —— 启动时经工厂 createRepositories(readEnvConfig) 创建一次数据源适配器，
 *                    经 Context 下发 IRepositoryBundle（业务代码唯一取数入口）。
 *   Router —— 三页面 SPA 路由。
 *   StrictMode —— 开发期放大副作用信号（离线应用首屏数据装载均为幂等操作，双调无害）。
 */
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RepoProvider>
      <RouterProvider router={router} />
    </RepoProvider>
  </React.StrictMode>,
);
