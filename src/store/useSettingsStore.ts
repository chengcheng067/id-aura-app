import { create } from 'zustand';

import { DEFAULT_REST_POLICY } from '../core/types/entities';
import type { RestPolicyConfig } from '../core/types/entities';

/**
 * 本机设置与身份。
 * currentMemberId = 「我的任务」身份（MVP 无账号体系，本机选择 + localStorage 持久化；
 * Docker 化后升级为登录会话映射，接口形状不变）。
 *
 * restPolicy = 公司休息制度（决定全系统排期的工作日口径）。体例同其他字段：
 * 不落 localStorage，由 bootstrapAllStores 从 settings 表（key='restPolicy'）读入后注入；
 * 缺失或数据损坏时静默回落 DEFAULT_REST_POLICY。
 *
 * v0.2 增量：身份进入状态机（不持久化，每次启动由 currentMemberId 恢复已进入态）：
 *   closed        未在身份流程中
 *   admin_prompt  first-run 引导「你是管理员吗？」
 *   name_input    姓名输入（adminIntent=true 为管理员确立，false 为成员进入）
 *   mismatch      未命中提示（停留，不进入）
 * firstRunDismissed 会话级开关：无管理员时普通成员选「我不是管理员」后不再自动弹引导
 * （防死循环：若不置位，闸门条件仍满足会立刻重新弹出 admin_prompt）。
 */

const LS_KEY = 'changxia.currentMemberId';

export type IdentityFlowState = 'closed' | 'admin_prompt' | 'name_input' | 'mismatch' | 'password_input';

export interface SettingsState {
  currentMemberId: string | null;
  hydrated: boolean;
  identityFlow: IdentityFlowState;
  /** name_input 是否处于「管理员确立」意图（首次引导路径） */
  adminIntent: boolean;
  /** 会话级：无管理员时普通成员已被告知联系管理员，不再自动弹引导 */
  firstRunDismissed: boolean;
  /** 公司休息制度（出厂默认双休；由 bootstrap 从 settings 表注入，不落 localStorage） */
  restPolicy: RestPolicyConfig;
  /**
   * v0.6 密码系统：name_input 命中「设置了密码的成员」后，进入 password_input 前暂存该成员 id，
   * 供密码表单校验通过后 setCurrentMember。关闭/取消时清空。
   */
  pendingMemberId: string | null;

  hydrate(currentMemberId: string | null): void;
  setRestPolicy(next: RestPolicyConfig): void;
  setCurrentMember(memberId: string | null): void;
  setPendingMember(memberId: string | null): void;
  openIdentityFlow(state: IdentityFlowState, adminIntent?: boolean): void;
  setIdentityFlow(state: IdentityFlowState): void;
  closeIdentityFlow(): void;
  dismissFirstRunNotice(): void;
}

function readLocalStorageId(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  currentMemberId: readLocalStorageId(),
  hydrated: false,
  identityFlow: 'closed',
  adminIntent: false,
  firstRunDismissed: false,
  restPolicy: DEFAULT_REST_POLICY,
  pendingMemberId: null,

  setRestPolicy: (next) => set({ restPolicy: next }),

  hydrate: (currentMemberId) =>
    set({
      // 设置表值优先；无则回落 localStorage；再次无则空（未选身份）
      currentMemberId: currentMemberId ?? readLocalStorageId(),
      hydrated: true,
    }),

  setCurrentMember: (memberId) => {
    try {
      if (memberId === null) localStorage.removeItem(LS_KEY);
      else localStorage.setItem(LS_KEY, memberId);
    } catch {
      /* 隐私模式下静默降级为内存态 */
    }
    set({ currentMemberId: memberId });
  },

  setPendingMember: (memberId) => set({ pendingMemberId: memberId }),

  openIdentityFlow: (state, adminIntent = false) =>
    set({ identityFlow: state, adminIntent }),

  setIdentityFlow: (state) => set({ identityFlow: state }),

  closeIdentityFlow: () => set({ identityFlow: 'closed', adminIntent: false, pendingMemberId: null }),

  dismissFirstRunNotice: () => set({ firstRunDismissed: true }),
}));
