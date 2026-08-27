import { create } from 'zustand';

import type { IRepositoryBundle } from '../core/repositories/interfaces';
import { MemberRoleKind } from '../core/types/enums';
import { useRepoContext } from '../di/repository.provider';
import { useProjectsStore } from '../store/useProjectsStore';
import { useMembersStore } from '../store/useMembersStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { normalizeLegacyMemberRoles } from './useRoleGuard';

/**
 * 业务代码唯一取数入口（铁律 4）。
 * 依赖 react 组件树 Context —— 只能在组件/自定义 hook 内调用，
 * service 层经由 store action 或 React 层注入的 bundle 工作。
 */
export function useRepos(): IRepositoryBundle {
  return useRepoContext();
}

/** 首屏装载完成后的整体引导（useProjectsBootstrap 的核心动作包装） */
export async function bootstrapAllStores(repos: IRepositoryBundle): Promise<void> {
  const [projects, stages, tasks, members, settings] = await Promise.all([
    repos.projects.list({ status: 'all' }),
    loadAllStages(repos),
    repos.tasks.list(),
    repos.members.list(true),
    repos.settings.all(),
  ]);

  const currentMemberId =
    readCurrentMemberFromSettings(settings) ??
    localStorage.getItem('changxia.currentMemberId') ??
    null;

  // LOW-2 迁移：旧成员行 roleKind 归一（undefined→member；当前用户且系统无 admin 时恢复 admin）
  const memberList = normalizeLegacyMemberRoles(members, currentMemberId);
  const legacyRows = members.filter((m) => m.roleKind === undefined);
  if (legacyRows.length > 0) {
    // 一次性持久化回 Dexie（失败不影响本次会话——内存已归一，下次启动重试）
    void Promise.allSettled(
      legacyRows.map((m) => {
        const roleKind =
          memberList.find((x) => x.id === m.id)?.roleKind ?? MemberRoleKind.Member;
        return repos.members.update(m.id, { roleKind }).catch(() => undefined);
      }),
    );
  }

  useProjectsStore.getState().replaceAll({ projects, stages, tasks });
  useMembersStore.getState().setAll(memberList);
  useSettingsStore.getState().hydrate(currentMemberId);
}

async function loadAllStages(
  repos: IRepositoryBundle,
): Promise<import('../core/types/entities').Stage[]> {
  const projects = await repos.projects.list({ status: 'all' });
  const chunks = await Promise.all(projects.map((p) => repos.stages.listByProject(p.id)));
  return chunks.flat();
}

function readCurrentMemberFromSettings(
  rows: Array<{ key: string; valueJson: string }>,
): string | null {
  for (const row of rows) {
    if (row.key === 'currentMemberId') {
      try {
        const v = JSON.parse(row.valueJson);
        return typeof v === 'string' ? v : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}
