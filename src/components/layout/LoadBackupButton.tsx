import { useRef, useState } from 'react';

import { Upload } from 'lucide-react';

import { useRepos } from '../../hooks/useRepos';
import { useRoleGuard } from '../../hooks/useRoleGuard';
import { useProjectsStore } from '../../store/useProjectsStore';
import { BackupService, validateBackupJson } from '../../core/services/backup.service';
import { ChangxiaError } from '../../core/types/enums';
import type { BackupPackage } from '../../core/types/dto';
import { ConfirmDialog } from '../common/ConfirmDialog';

/**
 * 顶栏「加载备份」独立按钮（v0.3 变更 D：备份下拉拆分后新增）。
 * 流程：点击触发隐藏 file input → 选文件 → JSON.parse → validateBackupJson 预检
 *   （失败 toast「备份文件校验失败，未做任何改动」，零写入）→ ConfirmDialog danger 二次确认
 *   （"恢复将整体替换当前全部数据且不可撤销，建议先导出留档"）→ importAndReplace → reload。
 * 复用 BackupService / ConfirmDialog / toast 通道，不重写服务层；仅管理员渲染。
 */
export function LoadBackupButton(): JSX.Element | null {
  const repos = useRepos();
  const { isAdmin } = useRoleGuard();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPkg, setPendingPkg] = useState<BackupPackage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 权限联动（D-4）：成员不渲染备份入口
  if (!isAdmin) return null;

  const toast = (kind: 'success' | 'error' | 'info', message: string): void => {
    useProjectsStore.getState().pushToast(kind, message);
  };

  const onFileSelected = async (f: File): Promise<void> => {
    try {
      const json: unknown = JSON.parse(await f.text());
      // 预检：结构不符 → toast 且零写入，绝不进入确认
      validateBackupJson(json);
      setPendingPkg(json as BackupPackage);
      setConfirmOpen(true);
    } catch {
      toast('error', '备份文件校验失败，未做任何改动。');
    }
  };

  const onConfirmRestore = async (): Promise<void> => {
    setConfirmOpen(false);
    if (!pendingPkg) return;
    try {
      await new BackupService(repos).importAndReplace(pendingPkg);
      window.location.reload();
    } catch (err) {
      toast('error', err instanceof ChangxiaError ? err.userMessage : '备份恢复失败，本地数据未受影响。');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md border border-sand bg-paper px-3 py-1.5 text-sm text-mist transition-colors hover:bg-sand hover:text-ink"
        title="从 JSON 备份包恢复（整体替换当前全部数据）"
      >
        <Upload size={14} /> 加载备份
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.currentTarget.value = '';
          if (f) void onFileSelected(f);
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="从备份恢复"
        danger
        confirmText="确认恢复"
        onConfirm={() => void onConfirmRestore()}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>
          恢复将<strong>整体替换当前全部数据且不可撤销</strong>。建议先「保存备份」留档，再确认恢复。
        </p>
        <p className="mt-2 text-xs text-mist">
          文件：{pendingPkg ? `${(pendingPkg.meta as { exportedAt?: string }).exportedAt ?? ''}` : ''}
        </p>
      </ConfirmDialog>
    </>
  );
}
