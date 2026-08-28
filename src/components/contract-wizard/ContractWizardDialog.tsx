import { useEffect, useRef, useState } from 'react';

import { ArrowLeft, X } from 'lucide-react';

import { useUiStore } from '../../store/useUiStore';
import { DEFAULT_SCHEDULE_BASIS } from '../../core/types/entities';
import type { ScheduleBasis } from '../../core/types/enums';
import type { StageTemplateItem } from '../../core/types/dto';
import { getPresetItems } from '../../core/template/stage-library';
import { MIN_STAGE_COUNT } from '../../core/template/split';
import { Step1SourceInput } from './Step1SourceInput';
import { Step2CandidateConfirm } from './Step2CandidateConfirm';
import { Step3SplitPreview } from './Step3SplitPreview';
import { defaultPresetKeyFor, presetKeyOfItems, StageSelectPanel } from './StageSelectPanel';

/**
 * 合同向导壳（四步状态机）：
 *   Step1 粘贴/上传 → Step2 候选卡片确认 → Step3 选择阶段（套餐/阶段池/调序）
 *   → Step4 切分预览（可改名/改占比）→ 确认建档。
 * 任何一步都能退出；解析失败不阻断——引导 ManualFallbackForm 兜底。
 */
export function ContractWizardDialog(): JSX.Element | null {
  const open = useUiStore((s) => s.contractWizardOpen);
  const close = useUiStore((s) => s.closeContractWizard);
  const openManual = useUiStore((s) => s.openManualForm);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawText, setRawText] = useState('');
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  /** Step3 所选阶段项（受控；经 selectionRef 跨步骤传递到 Step4） */
  const [stageSelection, setStageSelection] = useState<StageTemplateItem[]>([]);
  const [scheduleBasis, setScheduleBasis] = useState<ScheduleBasis>(DEFAULT_SCHEDULE_BASIS);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setRawText('');
      setSourceFileName(null);
      setStageSelection([]);
      setScheduleBasis(DEFAULT_SCHEDULE_BASIS);
      selectionRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(15,23,42,0.45)] p-6 backdrop-blur-[6px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="导入合同建档"
        className="glass-strong iridescent-border dialog-pop my-8 w-full max-w-3xl rounded-2xl p-6 shadow-soft"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-display-md">导入合同建档</h2>
          <button
            type="button"
            onClick={close}
            aria-label="关闭向导"
            className="rounded-md p-1 text-mist hover:bg-sand"
          >
            <X size={18} />
          </button>
        </div>

        {/* 步骤指示 */}
        <ol className="mb-5 flex items-center gap-2 text-xs text-mist">
          {['来源', '核对候选', '选择阶段', '切分预览'].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                  step >= i + 1 ? 'bg-pine text-cream' : 'bg-sand'
                }`}
              >
                {i + 1}
              </span>
              <span className={step === i + 1 ? 'text-pine' : ''}>{label}</span>
              {i < 3 && <span className="mx-1 h-px w-6 bg-sand" />}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <Step1SourceInput
            onConfirmed={(text, fileName) => {
              setRawText(text);
              setSourceFileName(fileName);
              setStep(2);
            }}
            onGiveUp={() => {
              close();
              openManual(); // 解析失败 → 手动兜底，永不阻断建档
            }}
          />
        )}
        {step === 2 && rawText && (
          <Step2CandidateConfirm
            rawText={rawText}
            sourceFileName={sourceFileName}
            onBack={() => setStep(1)}
            onConfirmed={(confirmedDraftInput) => {
              confirmedRef.current = confirmedDraftInput;
              // 进入阶段选择前按项目类型预选默认套餐（PRD §3.4）
              setStageSelection(
                getPresetItems(defaultPresetKeyFor(confirmedDraftInput.projectType)),
              );
              setScheduleBasis(DEFAULT_SCHEDULE_BASIS);
              setStep(3);
            }}
          />
        )}
        {step === 3 && confirmedRef.current && (
          <div>
            <StageSelectPanel
              selected={stageSelection}
              onChange={setStageSelection}
              projectType={confirmedRef.current.projectType}
              scheduleBasis={scheduleBasis}
              onScheduleBasisChange={setScheduleBasis}
            />
            <div className="mt-5 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1 rounded-md border border-sand px-3 py-1.5 text-sm text-mist hover:bg-sand"
              >
                <ArrowLeft size={14} /> 返回核对
              </button>
              <button
                type="button"
                disabled={stageSelection.length < MIN_STAGE_COUNT}
                onClick={() => {
                  // 当前选择写入跨步骤引用，供 Step4 切分与建档消费
                  selectionRef.current = {
                    stageItems: stageSelection,
                    stagePresetKey: presetKeyOfItems(stageSelection),
                    scheduleBasis,
                  };
                  setStep(4);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-pine px-4 py-2 text-sm text-white hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                预览切分 →
              </button>
            </div>
          </div>
        )}
        {step === 4 && confirmedRef.current && (
          <Step3SplitPreview
            baseInput={confirmedRef.current}
            rawTextForDigest={rawText}
            sourceFileName={sourceFileName}
            stageItems={selectionRef.current?.stageItems}
            stagePresetKey={selectionRef.current?.stagePresetKey ?? null}
            scheduleBasis={selectionRef.current?.scheduleBasis}
            onBack={() => setStep(3)}
            onDone={() => {
              close();
            }}
          />
        )}

        <p className="mt-4 border-t border-sand pt-3 text-xs leading-5 text-mist">
          所有识别结果仅作候选展示，人工确认后才写入数据库；低置信度会留空而不是给出看似确定的日期。
        </p>
      </div>
    </div>
  );
}

/** 向导内跨步骤的暂存引用（Step2 确认的基础信息草稿） */
export const confirmedRef: { current: import('./Step2CandidateConfirm').ConfirmedBaseInput | null } =
  { current: null };

/** 向导内跨步骤的暂存引用（Step3 确认的阶段选择：阶段项 / 套餐归属 / 排期基准） */
export const selectionRef: {
  current: {
    stageItems: StageTemplateItem[];
    stagePresetKey: string;
    scheduleBasis: ScheduleBasis;
  } | null;
} = { current: null };
