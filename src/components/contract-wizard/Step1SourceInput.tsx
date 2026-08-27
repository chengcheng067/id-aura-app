import { useCallback, useRef, useState } from 'react';

import { FileUp, ClipboardPaste, ArrowRight } from 'lucide-react';

import { extractFromFile } from '../../core/file-extractors/extract.registry';
import { parseContract } from '../../core/contract-parser';
import { ChangxiaError } from '../../core/types/enums';

/**
 * Step1：粘贴文本 或 拖拽/点选上传 PDF·DOCX·TXT。
 * 抽取失败（如扫描件）→ 显示降级提示 + 「改用手动建档」按钮（永不阻断建档）。
 */
export function Step1SourceInput({
  onConfirmed,
  onGiveUp,
}: {
  onConfirmed(text: string, fileName: string | null): void;
  /** 用户选择放弃自动识别走手动表单 */
  onGiveUp(): void;
}): JSX.Element {
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setFailureReason(null);
      try {
        const outcome = await extractFromFile(file);
        if (outcome.text) {
          onConfirmed(outcome.text, file.name);
          return;
        }
        setFailureReason(outcome.failureReason ?? '未能从文件中提取到可用文本。');
      } catch (err) {
        setFailureReason(
          `解析失败：${err instanceof ChangxiaError ? err.userMessage : String(err)}。`,
        );
      } finally {
        setBusy(false);
      }
    },
    [onConfirmed],
  );

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">粘贴合同关键段落或全文</label>
      <textarea
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        rows={7}
        placeholder={'例如：\n本合同于 2026 年 9 月 1 日签订……乙方于 2026 年 9 月 20 日进场开工，须于 2026 年 12 月 31 日前完成竣工验收，总工期不超过 90 个日历天。'}
        className="w-full resize-y rounded-md border border-sand bg-paper p-3 text-sm leading-6 outline-none focus:border-pine"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pasted.trim().length < 10 || busy}
          onClick={() => onConfirmed(pasted.trim(), null)}
          className="inline-flex items-center gap-1.5 rounded-md bg-pine px-4 py-2 text-sm text-white transition-colors hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ClipboardPaste size={15} /> 使用粘贴文本解析 <ArrowRight size={14} />
        </button>

        <span className="text-xs text-mist">或上传文件：</span>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          className={`flex items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm transition-colors ${
            dragOver ? 'border-pine bg-pine-soft' : 'border-mist/50 bg-paper hover:bg-sand'
          }`}
        >
          <FileUp size={15} className="text-mist" />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? '正在抽取文本…' : 'PDF / DOCX / TXT'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.currentTarget.value = '';
            }}
          />
        </div>
      </div>

      {failureReason && (
        <div className="mt-3 rounded-md border border-clay-soft bg-clay-soft/50 p-3 text-sm leading-6">
          <p>{failureReason}</p>
          <button
            type="button"
            onClick={onGiveUp}
            className="mt-1 underline underline-offset-2 hover:text-clay"
          >
            改用手动建档表单 →
          </button>
        </div>
      )}
    </div>
  );
}
