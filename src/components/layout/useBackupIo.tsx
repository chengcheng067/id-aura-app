import { useRef, useState } from 'react';

import { useRepos } from '../../hooks/useRepos';
import { useProjectsStore } from '../../store/useProjectsStore';
import {
  BackupService,
  downloadBackup,
  validateBackupJson,
} from '../../core/services/backup.service';
import { logError, logUser } from '../../core/services/log.service';
import { ChangxiaError } from '../../core/types/enums';
import type { BackupPackage } from '../../core/types/dto';
import { ConfirmDialog } from '../common/ConfirmDialog';

/**
 * 备份导入 / 导出逻辑（v0.4 抽取）。
 *
 * 抽出的原因：桌面顶栏的「保存备份 / 加载备份」按钮与移动端「更多」菜单里的同名菜单项
 * 需要完全相同的行为（导出下载 / 选文件 → 预检 → 二次确认 → 整体替换）。
 * 若各写一份，日后改校验规则或文案时必然出现两边不一致，故收敛为单一实现。
 *
 * 调用方必须把返回的 `fileInput` 与 `confirmDialog` 渲染进 DOM——
 * 不渲染会导致 `pick()` 点了没反应（隐藏 file input 不在 DOM 里）。
 */
export interface BackupIo {
  /** 导出全量数据并触发浏览器下载 */
  save(): Promise<void>;
  /** 弹出系统文件选择器（走隐藏 input，非 window API） */
  pick(): void;
  /** 隐藏的 file input，必须渲染 */
  fileInput: JSX.Element;
  /** 覆盖式恢复的二次确认弹窗，必须渲染 */
  confirmDialog: JSX.Element;
}

export function useBackupIo(): BackupIo {
  const repos = useRepos();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPkg, setPendingPkg] = useState<BackupPackage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toast = (kind: 'success' | 'error' | 'info', message: string): void => {
    useProjectsStore.getState().pushToast(kind, message);
  };

  const save = async (): Promise<void> => {
    try {
      const pkg = await new BackupService(repos).exportAll();
      downloadBackup(pkg);
      toast('success', '备份包已保存');
      logUser('备份', '保存备份成功');
    } catch (err) {
      toast('error', err instanceof ChangxiaError ? err.userMessage : '备份导出失败。');
      logError('备份', '保存备份失败', err);
    }
  };

  const pick = (): void => fileRef.current?.click();

  const onFileSelected = async (f: File): Promise<void> => {
    try {
      const json: unknown = JSON.parse(await f.text());
      // 预检：结构不符 → toast 且零写入，绝不进入确认
      validateBackupJson(json);
      setPendingPkg(json as BackupPackage);
      setConfirmOpen(true);
    } catch (err) {
      toast('error', '备份文件校验失败，未做任何改动。');
      logError('备份', '备份文件校验失败', err);
    }
  };

  const onConfirmRestore = async (): Promise<void> => {
    setConfirmOpen(false);
    if (!pendingPkg) return;
    try {
      await new BackupService(repos).importAndReplace(pendingPkg);
      logUser('备份', '从备份恢复成功');
      window.location.reload();
    } catch (err) {
      toast(
        'error',
        err instanceof ChangxiaError ? err.userMessage : '备份恢复失败，本地数据未受影响。',
      );
      logError('备份', '从备份恢复失败', err);
    }
  };

  return {
    save,
    pick,
    fileInput: (
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // 清空 value，保证连续选同一个文件也能再次触发 change
          e.currentTarget.value = '';
          if (f) void onFileSelected(f);
        }}
      />
    ),
    confirmDialog: (
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
    ),
  };
}
