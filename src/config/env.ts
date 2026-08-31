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
 * 把 origin-relative 的 apiBaseUrl 自动拼上应用的部署前缀，让同一份镜像在
 * tab 模式（base='/'）与 inner 模式（base='/idplan/'）下都能命中正确的网关路径。
 * - 绝对地址（http(s)://...）：原样返回，不拼接。
 * - 已带前缀（如 /idplan/api）：原样返回，避免重复拼接。
 * - origin-relative（如 /api）：tab 下保持不变，inner 下拼成 /idplan/api。
 * 这样用户安装时始终填 /api，无需因切换 open_type 而改配置。
 */
function resolveApiBase(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, '');
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  if (base === '/' || base === '') return trimmed.replace(/\/+$/, '');
  if (trimmed.startsWith(`${base}/`) || trimmed === base) return trimmed.replace(/\/+$/, '');
  if (trimmed.startsWith('/')) return `${base}${trimmed}`.replace(/\/+$/, '');
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

/** 部署前缀（tab: '/' / inner: '/idplan/'），已去尾部斜杠（空串表示根） */
export const appBase: string = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/** 把应用内相对路由拼上部署前缀，供 window.open 等绕开 router basename 的场景使用 */
export function appPath(route: string): string {
  const r = `/${route.replace(/^\/+/, '')}`;
  return `${appBase}${r}`;
}

/** 导出类型供宿主 index.html 内联 window.__APP_ENV__ 时参考 */
export type { RuntimeAppEnv };
