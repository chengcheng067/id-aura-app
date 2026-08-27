import type { DataSourceMode } from '../core/types/enums';

/**
 * 类型化的运行环境配置。
 * 切换发生在进程启动时：main.tsx → RepoProvider → createRepositories() 一次定型，
 * 之后整个应用生命周期不再改变（消灭热切换带来的半套状态 bug 面）。
 */
export interface AppEnvConfig {
  dataSource: DataSourceMode;
  /** remote 模式必填；local 模式忽略 */
  apiBaseUrl: string;
}

/** 解析 Vite 环境变量为强类型配置（非法值一律回落 local，绝不抛异常阻断启动） */
export function readEnvConfig(envSource: ImportMeta['env']): AppEnvConfig {
  const raw = (envSource.VITE_DATA_SOURCE ?? '').trim().toLowerCase();
  const dataSource: DataSourceMode = raw === 'remote' ? 'remote' : 'local';
  const apiBaseUrl = (envSource.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
  return { dataSource, apiBaseUrl };
}

/** 进程级配置单例（模块加载时定格一次） */
export const appEnv: AppEnvConfig = readEnvConfig(import.meta.env);
