import { forwardRef } from 'react';
import type {
  KeyboardEvent,
  CompositionEvent,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/**
 * IME 安全的受控输入控件（`<input>` / `<textarea>`）。
 *
 * 重要修正（2026-09-01）：**不再拦截 `onChange`**。
 *
 * 为什么改：受控 `<input value={x} onChange={e => setX(e.target.value)}>` 在 React 18
 * 下本身就对输入法（IME）是安全的——React 会在 `compositionend` 后正确同步受控值，
 * 组合期间不会用受控 value 覆盖 DOM 候选串。旧版本在 `composing` 期间拦截 onChange，
 * 反而导致受控状态卡在旧值：一旦组件因焦点圈禁 / busy / 任何 store 重渲染，
 * `updateWrapper` 会用旧受控值覆盖 DOM value，把 IME 候选串和已输入字符清空——
 * 表现为「输入法能敲出候选，但输入框始终不显示」（切换身份弹窗就是这个症状）。
 *
 * 因此这里只做两件事：
 *   1. `onChange` 原样透传给 `<input>`（让受控值随 IME 正常流动）；
 *   2. 保留 `onKeyDown` 对 Enter 的守卫：输入法组字期（`isComposing`）回车是选词，
 *      不是提交，不能触发提交逻辑。
 *
 * 用法：直接替代 `<input>` / `<textarea>`，接口完全一致（value / onChange / placeholder / className…）：
 *   <ImeInput value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" />
 */
export const ImeInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function ImeInput({ onKeyDown, ...rest }, ref) {
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter' && e.nativeEvent.isComposing) return;
      onKeyDown?.(e);
    };

    return <input ref={ref} {...rest} onKeyDown={handleKeyDown} />;
  },
);

/** 与 ImeInput 相同的 Enter 守卫，但渲染为 `<textarea>`（多行原因/备注等场景）。 */
export const ImeTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function ImeTextarea({ onKeyDown, ...rest }, ref) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && e.nativeEvent.isComposing) return;
    onKeyDown?.(e);
  };

  return <textarea ref={ref} {...rest} onKeyDown={handleKeyDown} />;
});

// 保留类型引用供外部使用（避免未使用告警）
export type { CompositionEvent as _CompositionEvent };
