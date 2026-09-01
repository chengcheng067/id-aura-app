import { useCallback, useSyncExternalStore } from 'react';

/**
 * 双主题（亮 / 暗）状态源。
 *
 * 设计要点：
 *   1) **首屏不闪**：index.html 里有一段同步内联脚本先按 localStorage / 系统偏好写好
 *      <html data-theme>，本模块只负责接管后续变更，不作为首屏唯一依据。
 *   2) **优先级**：用户显式选择（localStorage）> 系统偏好（prefers-color-scheme）。
 *      用户没选过时，跟随系统实时变化；一旦手动切换过，就以用户选择为准。
 *   3) **持久化降级**：localStorage 不可用（隐私模式 / 禁用 storage）时静默降级为
 *      「仅当前会话生效」，不抛错、不影响渲染。
 *   4) 颜色值本身不在这里，全部住在 src/styles/global.css 的 CSS 变量里；
 *      这里只切换 <html data-theme>，整站自动换肤。
 */

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'idplan-theme';

function isThemeMode(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark';
}

/** 读取用户显式选择；无则返回 null（表示「跟随系统」） */
function readStoredTheme(): ThemeMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isThemeMode(v) ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** 当前应当生效的主题 */
function resolveTheme(): ThemeMode {
  return readStoredTheme() ?? systemTheme();
}

// —— 极小的外部 store：让任意多个组件共享同一份主题状态 ——
let current: ThemeMode = resolveTheme();
const listeners = new Set<() => void>();

function apply(next: ThemeMode): void {
  current = next;
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* 存储不可用：仅当前会话生效，忽略 */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ThemeMode {
  return current;
}

function getServerSnapshot(): ThemeMode {
  return 'light';
}

/**
 * 在 main.tsx 渲染前调用一次：同步 DOM 上的 data-theme，并挂上系统偏好监听。
 * 与 index.html 的内联脚本互补——内联脚本防首屏闪白，这里负责运行期响应。
 */
export function initTheme(): void {
  document.documentElement.dataset.theme = resolveTheme();

  if (typeof window.matchMedia !== 'function') return;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // 用户已显式选过主题时，不跟随系统
    if (readStoredTheme() !== null) return;
    apply(e.matches ? 'dark' : 'light');
  });
}

export interface UseThemeResult {
  theme: ThemeMode;
  /** 在亮 / 暗之间切换 */
  toggleTheme(): void;
  /** 直接设定 */
  setTheme(mode: ThemeMode): void;
}

export function useTheme(): UseThemeResult {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggleTheme = useCallback(() => {
    apply(current === 'dark' ? 'light' : 'dark');
  }, []);
  const setTheme = useCallback((mode: ThemeMode) => {
    apply(mode);
  }, []);
  return { theme, toggleTheme, setTheme };
}
