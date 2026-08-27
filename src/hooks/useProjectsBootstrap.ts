import { useEffect, useRef } from 'react';

import type { IRepositoryBundle } from '../core/repositories/interfaces';
import { bootstrapAllStores, useRepos } from './useRepos';
import { useProjectsStore } from '../store/useProjectsStore';

/**
 * 应用启动引导：全量装载活跃数据进 stores（离线单机数据量小：
 * ≤50 项目 × 9 阶段 × ~30 任务 —— 全量装载策略无需分页）。
 */
export function useProjectsBootstrap(): void {
  const repos: IRepositoryBundle | null = safeRepos();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!repos || startedRef.current) return;
    startedRef.current = true;
    bootstrapAllStores(repos)
      .then(() => {
        useProjectsStore.getState().pushToast('info', '数据装载完成');
      })
      .catch(() => {
        useProjectsStore.getState().pushToast('error', '本地数据装载失败，请刷新页面重试。');
      });
  }, [repos]);
}

/** Provider 未就绪时返回 null（组件树装配期调用安全） */
function safeRepos(): IRepositoryBundle | null {
  try {
    return useRepos();
  } catch {
    return null;
  }
}
