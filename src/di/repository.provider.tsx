import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { appEnv } from '../config/env';
import { createRepositories } from '../core/repositories';
import { ChangxiaError, ChangxiaErrorCode } from '../core/types/enums';
import type { IRepositoryBundle } from '../core/repositories/interfaces';

/**
 * DI 注入点：启动时经工厂创建一次 IRepositoryBundle，Context 下发。
 * 业务代码统一通过 useRepos() 取用（铁律 4 的唯一合法取数入口）。
 */

const RepoContext = createContext<IRepositoryBundle | null>(null);

export function RepoProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [bundle, setBundle] = useState<IRepositoryBundle | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createRepositories({ dataSource: appEnv.dataSource, apiBaseUrl: appEnv.apiBaseUrl })
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof ChangxiaError
            ? err.userMessage
            : '本地数据库初始化失败（可能是隐私模式禁用了存储）。';
        setFatalError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => bundle, [bundle]);

  if (fatalError) {
    // 存储不可用的兜底画面：不白屏、给出可操作指引
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream p-8">
        <div className="max-w-md rounded-md border border-clay-soft bg-paper p-6 text-ink shadow-soft">
          <h1 className="mb-2 font-display text-display-md">无法访问本地数据</h1>
          <p className="text-sm leading-6 text-mist">{fatalError}</p>
          <p className="mt-3 text-sm leading-6">
            请确认未处于浏览器无痕/隐私模式，或为站点启用站点数据后刷新重试。
          </p>
        </div>
      </div>
    );
  }

  if (!value) {
    // 首屏装配瞬态：仅微占位，非「加载圈」（PRD 禁令针对写操作反馈）
    return <div className="min-h-screen bg-cream" aria-busy="true" />;
  }

  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}

/** Context 消费（业务 hook useRepos() 底层实现；组件请勿直接使用本函数） */
export function useRepoContext(): IRepositoryBundle {
  const ctx = useContext(RepoContext);
  if (!ctx) {
    throw new ChangxiaError(
      ChangxiaErrorCode.Cancelled,
      '仓储上下文缺失：RepoProvider 未挂载。',
    );
  }
  return ctx;
}
