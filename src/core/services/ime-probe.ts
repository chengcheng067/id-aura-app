/**
 * IME 输入法诊断探针。
 *
 * 目的：定位「输入法能敲出候选串，但输入框不显示/字母消失」这类受控 input 吞字 bug 的**真实事件序列**。
 *
 * 为什么需要它：微软拼音的真实组合行为（compositionstart → compositionupdate(×N) → input(isComposing) →
 * compositionend → input(isComposing=false)）只有真实键盘 + 系统 IME 才能触发，自动化（CDP/Playwright）派发的
 * 键盘事件会绕过操作系统 TSF/IME 层，无法复现。因此把探针**打进应用**，让用户在真实环境复现一次，
 * 把每一帧事件写入现有日志系统，导出后即可精确定位是哪个环节丢掉了字符。
 *
 * 设计：
 *  - attachImeProbe(input/textarea)：在目标 DOM 上挂 composition/input/keydown 事件，恢复(record)事件流的
 *    关键快照（事件类型、key、isComposing、此刻 input.value、事件序号）。
 *  - 默认 throttle：组合期事件密集，同一轮组合(value 初值→末值)只记录「组合前的初值 + 关键转折」，避免刷爆 500 条日志上限。
 *  - 通过 log.service 的 logWarn('IME', ...) 写入（非 error，不打扰用户，仅诊断用）。
 *  - 可通过 window.__imeProbeEnabled 或 localStorage('idplan.imeProbe') 开关，默认关闭？——默认开启更利于定位，
 *    但为避免刷日志，仅在组合流程里记录「里程碑」而非每个字母。
 *
 * 注意：这是诊断工具，不改业务逻辑、不拦截任何 onChange/composition 事件（只读监听），
 * 因此不影响现有 ImeInput 的「React 18 受控对 IME 安全」行为。
 */
import { logWarn } from '../services/log.service';

/** 单次组合流程的里程碑记录 */
interface ImeMilestone {
  /** 事件类型 */
  ev: string;
  /** 按下的按键 */
  key?: string;
  /** 此刻是否在组合中 */
  isComposing?: boolean;
  /** 此刻 input 的 value */
  value: string;
  /** 事件流序号（本输入框累计） */
  n: number;
}

const PROBE_LS_KEY = 'idplan.imeProbe';

/** 是否启用探针（默认启用；用户可在 localStorage 关闭） */
function isEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const v = window.localStorage.getItem(PROBE_LS_KEY);
    return v !== 'off';
  } catch {
    return true;
  }
}

/**
 * 在输入框上挂 IME 诊断探针。
 * 返回 detach 函数（组件卸载时清理）。
 * 通过 window.__imeLast 暴露最近一次里程碑，便于自动化/控制台直接读取。
 */
export function attachImeProbe(
  el: HTMLInputElement | HTMLTextAreaElement,
): () => void {
  if (!el || !isEnabled()) return () => undefined;

  let n = 0;
  let lastValue = el.value;
  let composing = false;
  const recent: ImeMilestone[] = [];

  const record = (ev: string, key?: string, isComposingMsg?: boolean): void => {
    n += 1;
    const value = el.value;
    const milestone: ImeMilestone = { ev, key, isComposing: isComposingMsg, value, n };
    recent.push(milestone);
    // 只把「里程碑」写日志，避免每字母一条刷爆 500 上限：
    // 组合开始、组合结束、以及 value 发生变化的 input。
    try {
      (window as unknown as { __imeLast?: ImeMilestone }).__imeLast = milestone;
    } catch {
      /* ignore */
    }
  };

  const onCompositionStart = (): void => {
    composing = true;
    record('compositionstart', undefined, true);
    logWarn('IME', `compositionstart 开始组合 (input#${n})`);
  };

  const onCompositionUpdate = (): void => {
    // 组合更新：value 是当前拼音串。仅在 value 变化时记录（约每拼音字母一次）。
    if (el.value !== lastValue) {
      lastValue = el.value;
      record('compositionupdate', undefined, true);
      logWarn('IME', `compositionupdate value="${el.value}" (input#${n})`);
    }
  };

  const onCompositionEnd = (): void => {
    composing = false;
    record('compositionend', undefined, false);
    // 组合结束：此刻 value 应是已提交的汉字。记录它，供对比 composition 期间 value 是否被覆盖。
    logWarn('IME', `compositionend 提交 value="${el.value}" (input#${n})`);
    logWarn('IME', `compositionend 后 React 受控 value 应等于 "${el.value}"; 若下一帧被重置则回调这里必有痕迹`);
  };

  const onInput = (e: Event): void => {
    const ie = e as unknown as { isComposing?: boolean };
    record('input', undefined, composing ?? ie.isComposing ?? false);
    // 关键诊断点：如果 value 在组合过程中被「清空/回退」，这里能看到 value 骤变。
    if (el.value.length < lastValue.length - 1) {
      logWarn('IME', `⚠️ input 价值回退：last="${lastValue}" -> now="${el.value}" (input#${n}) 疑似受控覆盖`);
    }
    lastValue = el.value;
  };

  el.addEventListener('compositionstart', onCompositionStart);
  el.addEventListener('compositionupdate', onCompositionUpdate);
  el.addEventListener('compositionend', onCompositionEnd);
  el.addEventListener('input', onInput);

  return () => {
    el.removeEventListener('compositionstart', onCompositionStart);
    el.removeEventListener('compositionupdate', onCompositionUpdate);
    el.removeEventListener('compositionend', onCompositionEnd);
    el.removeEventListener('input', onInput);
  };
}

/** 供测试/控制台读取最近的 IME 里程碑 */
export function readImeProbeLast(): ImeMilestone | null {
  try {
    return (window as unknown as { __imeLast?: ImeMilestone }).__imeLast ?? null;
  } catch {
    return null;
  }
}
