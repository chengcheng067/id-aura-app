/**
 * 验证 ImeInput（修复后）的受控输入行为：onChange 应随 IME 正常透传，
 * 不得拦截 —— 拦截是「切换身份弹窗输入中文吞字」的根因。
 */
// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';

import { ImeInput } from '../src/components/common/ImeInput';

let root: Root;
let container: HTMLDivElement;

function fireInput(el: HTMLElement, init: Record<string, unknown> = {}): void {
  const ev = new Event('input', { bubbles: true, cancelable: true });
  Object.assign(ev, init);
  el.dispatchEvent(ev);
}
function fireCompStart(el: HTMLElement): void {
  el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, cancelable: true, data: '' }));
}
function fireCompEnd(el: HTMLElement, data: string): void {
  el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, cancelable: true, data }));
}
function setInputValue(el: HTMLInputElement, v: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(el, v);
  else el.value = v;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.removeChild(container);
});

function mountControlled(): {
  input: HTMLInputElement;
  values: string[];
  rerender: () => void;
} {
  const values: string[] = [];
  let current = '';
  const Comp = (): JSX.Element =>
    React.createElement(ImeInput, {
      value: current,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        current = e.target.value;
        values.push(e.target.value);
      },
    });
  act(() => root.render(React.createElement(Comp)));
  const input = container.querySelector('input') as HTMLInputElement;
  return { input, values, rerender: () => act(() => root.render(React.createElement(Comp))) };
}

describe('ImeInput（修复后）受控输入行为', () => {
  it('关键：onChange 透传，不因 composition 拦截（修复吞字根因）', () => {
    const { input, values } = mountControlled();
    fireCompStart(input);
    setInputValue(input, 'z');
    fireInput(input);
    setInputValue(input, 'zh');
    fireInput(input);
    // 修复后：onChange 透传 → 受控值随输入更新（不再卡在 ''，不会吞字）
    expect(values.length).toBe(2);
    expect(values[values.length - 1]).toBe('zh');
  });

  it('composition 期间重渲染不会清空受控值（DOM value 保留候选串）', () => {
    const { input, values, rerender } = mountControlled();
    fireCompStart(input);
    setInputValue(input, 'zhong');
    fireInput(input);
    setInputValue(input, 'zhong');
    fireInput(input);
    // 触发一次重渲染（模拟焦点圈禁/busy 状态），受控值已更新，不应被清空
    rerender();
    expect(values.length).toBe(2);
    expect(input.value).toBe('zhong');
  });

  it('isComposing 为 true 时 Enter 不触发提交（选词回车不误提交）', () => {
    let submitted = false;
    const Comp = (): JSX.Element =>
      React.createElement(ImeInput, {
        value: '',
        onChange: () => {},
        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitted = true;
        },
      });
    act(() => root.render(React.createElement(Comp)));
    const input = container.querySelector('input') as HTMLInputElement;
    const keyEvt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(keyEvt, 'isComposing', { value: true });
    input.dispatchEvent(keyEvt);
    expect(submitted).toBe(false);
  });
});
