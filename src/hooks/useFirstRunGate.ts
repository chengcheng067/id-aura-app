import { useEffect } from 'react';

import { useSettingsStore } from '../store/useSettingsStore';
import { useRoleGuard } from './useRoleGuard';

/**
 * 首启闸门（挂在 AppShell，一次）：
 *   bootstrap 完成（hydrated=true）且 未进入身份 且 系统无管理员 且 身份流关闭
 *   → 打开 admin_prompt 引导管理员确立。
 *
 * 时序保证（增量架构 3.3）：bootstrapAllStores 内 setAll(members) 先于 hydrate()，
 * 故 hydrated=true 时 members 已就绪，hasAdmin 判定准确。
 *
 * firstRunDismissed：无管理员时普通成员选「我不是管理员」后置位，
 * 避免闸门条件仍满足导致引导无限重弹。
 */
export function useFirstRunGate(): void {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const currentMemberId = useSettingsStore((s) => s.currentMemberId);
  const identityFlow = useSettingsStore((s) => s.identityFlow);
  const firstRunDismissed = useSettingsStore((s) => s.firstRunDismissed);
  const openIdentityFlow = useSettingsStore((s) => s.openIdentityFlow);
  const { hasAdmin } = useRoleGuard();

  useEffect(() => {
    if (
      hydrated &&
      currentMemberId === null &&
      !hasAdmin &&
      !firstRunDismissed &&
      identityFlow === 'closed'
    ) {
      openIdentityFlow('admin_prompt');
    }
  }, [hydrated, currentMemberId, hasAdmin, firstRunDismissed, identityFlow, openIdentityFlow]);
}
