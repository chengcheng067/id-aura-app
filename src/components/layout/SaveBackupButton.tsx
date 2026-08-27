import { Save } from 'lucide-react';

import { useRepos } from '../../hooks/useRepos';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useProjectsStore } from '../../store/useProjectsStore';
import { BackupService, downloadBackup } from '../../core/services/backup.service';
import { ChangxiaError } from '../../core/types/enums';

/**
 * 顶栏「保存备份」独立按钮（v0.3 变更 D：备份下拉拆分后新增）。
 * 点击直接导出：exportAll() → downloadBackup() → toast「备份包已保存」。
 * 无二次确认、无 loading 圈（铁律 11）；仅管理员渲染（备份含全部数据，成员不得导出）。
 * 浮层按钮复用玻璃样式（glass-medium 由外层 TopBar 承担，本按钮为次级描边样式）。
 */
export function SaveBackupButton(): JSX.Element | null {
  const repos = useRepos();
  const { isAdmin } = useRoleGuard();

  // 权限联动（D-4）：成员不渲染备份入口
  if (!isAdmin) return null;

  const onSave = async (): Promise<void> => {
    try {
      const svc = new BackupService(repos);
      const pkg = await svc.exportAll();
      downloadBackup(pkg);
      useProjectsStore.getState().pushToast('success', '备份包已保存');
    } catch (err) {
      useProjectsStore
        .getState()
        .pushToast('error', err instanceof ChangxiaError ? err.userMessage : '备份导出失败。');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onSave()}
      className="inline-flex items-center gap-1.5 rounded-md border border-sand bg-paper px-3 py-1.5 text-sm text-mist transition-colors hover:bg-sand hover:text-ink"
      title="导出 JSON 备份包（含全部项目、成员与记录）"
    >
      <Save size={14} /> 保存备份
    </button>
  );
}
