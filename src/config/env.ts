import type { DataSourceMode } from '../core/types/enums';

/**
 * 类型化的运行环境配置。
 * 切换发生在进程启动时：main.tsx → RepoProvider → createRepositories() 一次定型，
 * 之后整个应用生命周期不再改变（消灭热切换带来的半套状态 bug 面）。
 */

/** 运行时注入的全局配置（由宿主容器 / 部署环境在 index.html 内联写入） */
interface RuntimeAppEnv {
  VITE_DATA_SOURCE?: string;
  VITE_API_BASE_URL?: string;
}

export interface AppEnvConfig {
  dataSource: DataSourceMode;
  /** remote 模式必填；local 模式忽略 */
  apiBaseUrl: string;
}

/** 读运行时注入（window.__APP_ENV__），其次回退构建期 import.meta.env */
function readEnvSource(envSource: ImportMeta['env'], runtime?: RuntimeAppEnv): {
  VITE_DATA_SOURCE?: string;
  VITE_API_BASE_URL?: string;
} {
  return {
    VITE_DATA_SOURCE:
      runtime?.VITE_DATA_SOURCE ?? (envSource.VITE_DATA_SOURCE ?? '').trim().toLowerCase(),
    VITE_API_BASE_URL:
      runtime?.VITE_API_BASE_URL ?? (envSource.VITE_API_BASE_URL ?? '').trim(),
  };
}

/**
 * 把 apiBaseUrl 规整成最终可用的 fetch 基址。
 * 绿联 Docker 应用是 IP:端口直连（根路径 /），不走系统网关、无 /<proxy_path>/ 前缀，
 * 故 origin-relative 的 /api 原样返回即可，无需拼接任何前缀。
 * - 绝对地址（http(s)://...）：去尾部斜杠返回。
 * - origin-relative（/api）：原样返回（可含查询/子路径，仅去尾斜杠）。
 */
function resolveApiBase(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, '');
  return trimmed.replace(/\/+$/, '');
}

/** 解析 Vite 环境变量为强类型配置（非法值一律回落 local，绝不抛异常阻断启动） */
export function readEnvConfig(
  envSource: ImportMeta['env'],
  runtime?: RuntimeAppEnv,
): AppEnvConfig {
  const src = readEnvSource(envSource, runtime);
  const raw = (src.VITE_DATA_SOURCE ?? '').trim().toLowerCase();
  const dataSource: DataSourceMode = raw === 'remote' ? 'remote' : 'local';
  const apiBaseUrl = resolveApiBase(src.VITE_API_BASE_URL ?? '');
  return { dataSource, apiBaseUrl };
}

/**
 * 进程级配置单例（模块加载时定格一次）。
 * 优先读宿主注入的 window.__APP_ENV__（Docker 容器 / 绿联端在运行时写入，
 * 实现「不再构建镜像即可 local/remote 切换」的移植接口），否则回落构建期 import.meta.env。
 */
export const appEnv: AppEnvConfig = readEnvConfig(
  import.meta.env,
  (typeof window !== 'undefined' ? (window as unknown as { __APP_ENV__?: RuntimeAppEnv }).__APP_ENV__ : undefined),
);

/** 导出类型供宿主 index.html 内联 window.__APP_ENV__ 时参考 */
export type { RuntimeAppEnv };
