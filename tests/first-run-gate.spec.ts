/**
 * first-run 幂等（增量架构 4.3 手工回归重点 6 的自动化补充）：
 *   useFirstRunGate 闸门：hydrated && !currentMemberId && !hasAdmin
 *   && !firstRunDismissed && identityFlow==='closed' → open('admin_prompt')。
 * 断言：
 *   1. 无管理员 + 未进入 + bootstrap 完成 → 自动弹引导；
 *   2. 管理员确立后刷新（重新挂载）→ 不重弹；
 *   3. 退出身份后再次进入（currentMemberId=null 但 hasAdmin=true）→ 不弹引导；
 *   4. 无管理员时普通成员选「我不是管理员」（firstRunDismissed=true）→ 不无限重弹。
 * 运行于 jsdom 环境（react-dom 渲染 hook 需要 DOM）。
 */

// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';

import { useFirstRunGate } from '../src/hooks/useFirstRunGate';
import { useSettingsStore } from '../src/store/useSettingsStore';
import { useMembersStore } from '../src/store/useMembersStore';
import { MemberRoleKind } from '../src/core/types/enums';
import type { Member } from '../src/core/types/entities';

/** 渲染探针：只挂载闸门 hook，不渲染任何 UI */
function GateProbe(): null {
  useFirstRunGate();
  return null;
}

function member(overrides: Partial<Member> & { id: string; name: string }): Member {
  return {
    role: '',
    contact: null,
    avatarColor: '#3D6B5B',
    active: true,
    roleKind: MemberRoleKind.Member,
    revision: 1,
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  // 重置两个 store 为初始态（模块级单例，测试间必须隔离）
  useSettingsStore.setState({
    currentMemberId: null,
    hydrated: false,
    identityFlow: 'closed',
    adminIntent: false,
    firstRunDismissed: false,
  });
  useMembersStore.setState({ members: [] });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.removeChild(container);
});

/** 挂载探针并等待 effect flush */
async function mountGate(): Promise<void> {
  await act(async () => {
    // 用 createElement 而非 JSX：vitest 仅转译 .ts（include 未含 .tsx），esbuild 对 .ts 内 JSX 报错
    root.render(React.createElement(GateProbe));
  });
}

describe('useFirstRunGate：first-run 幂等', () => {
  it('无管理员 + 未进入 + bootstrap 完成 → 自动打开 admin_prompt', async () => {
    await mountGate();
    // 挂载时 hydrated=false，闸门条件不满足
    expect(useSettingsStore.getState().identityFlow).toBe('closed');

    // bootstrap 完成信号：hydrate() 置 hydrated=true（members 已 setAll 前置）
    await act(async () => {
      useSettingsStore.getState().hydrate(null);
    });
    expect(useSettingsStore.getState().identityFlow).toBe('admin_prompt');
  });

  it('管理员确立后刷新（重新挂载）→ 不重弹', async () => {
    useMembersStore.setState({
      members: [member({ id: 'mem_admin', name: '齐活林', roleKind: MemberRoleKind.Admin })],
    });
    await mountGate();
    await act(async () => {
      useSettingsStore.getState().hydrate(null);
    });
    // hasAdmin=true → 闸门不打开
    expect(useSettingsStore.getState().identityFlow).toBe('closed');
  });

  it('退出身份后再次进入（currentMemberId=null 但 hasAdmin=true）→ 不弹引导', async () => {
    // 模拟：管理员曾确立并进入过，随后退出身份（setCurrentMember(null)），刷新页面
    useMembersStore.setState({
      members: [member({ id: 'mem_admin', name: '齐活林', roleKind: MemberRoleKind.Admin })],
    });
    await mountGate();
    await act(async () => {
      useSettingsStore.getState().hydrate(null);
    });
    expect(useSettingsStore.getState().identityFlow).toBe('closed');

    // 再次触发 store 变化（等价于任何重渲染），仍不应弹
    await act(async () => {
      useMembersStore.setState({
        members: [
          member({ id: 'mem_admin', name: '齐活林', roleKind: MemberRoleKind.Admin }),
          member({ id: 'mem_m', name: '许工' }),
        ],
      });
    });
    expect(useSettingsStore.getState().identityFlow).toBe('closed');
  });

  it('无管理员时普通成员选「我不是管理员」（firstRunDismissed=true）→ 不无限重弹', async () => {
    await mountGate();
    // 先触发一次引导
    await act(async () => {
      useSettingsStore.getState().hydrate(null);
    });
    expect(useSettingsStore.getState().identityFlow).toBe('admin_prompt');

    // 成员选「我不是管理员」→ mismatch + dismiss（IdentityDialog.handleClose 路径）
    await act(async () => {
      useSettingsStore.getState().dismissFirstRunNotice();
      useSettingsStore.getState().closeIdentityFlow();
    });
    expect(useSettingsStore.getState().identityFlow).toBe('closed');

    // 闸门条件中的 firstRunDismissed=true → 不再自动弹（防死循环）
    await act(async () => {
      // 模拟任意 store 抖动（如 members 更新），触发 effect 重评估
      useMembersStore.setState({ members: [] });
    });
    expect(useSettingsStore.getState().identityFlow).toBe('closed');
  });

  it('管理员确立成功后（currentMemberId 有值）刷新 → 不弹', async () => {
    useSettingsStore.setState({ currentMemberId: 'mem_admin' });
    useMembersStore.setState({
      members: [member({ id: 'mem_admin', name: '齐活林', roleKind: MemberRoleKind.Admin })],
    });
    await mountGate();
    await act(async () => {
      useSettingsStore.getState().hydrate('mem_admin');
    });
    expect(useSettingsStore.getState().identityFlow).toBe('closed');
  });
});
