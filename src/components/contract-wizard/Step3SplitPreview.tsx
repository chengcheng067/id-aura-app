import { useEffect, useMemo, useState } from 'react';

import { ArrowLeft, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { previewSplit } from '../../core/template/split';
import type { StageDraft, ConfirmedContractPayload, StageTemplateItem } from '../../core/types/dto';
import { ChangxiaError, ScheduleBasis } from '../../core/types/enums';
import { DEFAULT_SCHEDULE_BASIS } from '../../core/types/entities';
import { createProjectActions, digestOf } from '../../store/useProjectsStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useRepos } from '../../hooks/useRepos';
import type { ConfirmedBaseInput } from './Step2CandidateConfirm';

/**
 * Step4：切分预览（起止/占比覆写可编辑；N 行由所选阶段子集决定）→ 确认建档。
 * 覆写后实时重算切分（纯函数 previewSplit，含 pinned 逻辑——此处仅暴露占比/名称覆写，
 * 起止整体由日期框驱动）。stageItems / scheduleBasis / restPolicy 透传给 previewSplit：
 * 不传 stageItems / scheduleBasis 时行为与现状逐字节一致（九段自然日）。
 */
export function Step3SplitPreview({
  baseInput,
  rawTextForDigest,
  sourceFileName,
  stageItems,
  stagePresetKey,
  scheduleBasis,
  onBack,
  onDone,
}: {
  baseInput: ConfirmedBaseInput | null;
  rawTextForDigest: string;
  sourceFileName: string | null;
  /** 建档所选阶段子集（Step3 确认）；不传 → 回落到全量九段模板 */
  stageItems?: StageTemplateItem[];
  /** 套餐归属（溯源）；不传 → null */
  stagePresetKey?: string | null;
  /** 排期基准（Step3 确认）；不传 → 自然日 */
  scheduleBasis?: ScheduleBasis;
  onBack(): void;
  onDone(): void;
}): JSX.Element {
  const repos = useRepos();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const restPolicy = useSettingsStore((s) => s.restPolicy);

  const [nameOverrides, setNameOverrides] = useState<Record<number, string>>({});
  const [ratioOverrides, setRatioOverrides] = useState<Record<number, number | ''>>({});

  const effective = useMemo<ConfirmedBaseInput>(
    () =>
      baseInput ?? {
        projectName: '未命名项目',
        projectType: 1 as unknown as ConfirmedBaseInput['projectType'],
        address: '',
        clientName: '',
        contractAmount: null,
        signedAt: null,
        startAt: new Date().toISOString().slice(0, 10),
        endAt: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      },
    [baseInput],
  );

  const [startAt, setStartAt] = useState(effective.startAt);
  const [endAt, setEndAt] = useState(effective.endAt);

  const drafts: StageDraft[] | null = useMemo(() => {
    try {
      const overrides: ConfirmedContractPayload['stageOverrides'] = {};
      for (const [k, v] of Object.entries(nameOverrides)) {
        if (v.trim()) {
          overrides[Number(k)] = { ...(overrides[Number(k)] ?? {}), name: v.trim() };
        }
      }
      for (const [k, v] of Object.entries(ratioOverrides)) {
        if (typeof v === 'number' && v > 0) {
          overrides[Number(k)] = { ...(overrides[Number(k)] ?? {}), ratioPercent: v };
        }
      }
      return previewSplit({
        startAt,
        endAt,
        overrides,
        stageItems,
        scheduleBasis: scheduleBasis ?? DEFAULT_SCHEDULE_BASIS,
        restPolicy,
      });
    } catch (err) {
      setError(err instanceof ChangxiaError ? err.userMessage : '切分失败：请检查日期。');
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAt, endAt, nameOverrides, ratioOverrides, stageItems, scheduleBasis, restPolicy]);

  useEffect(() => {
    if (drafts) setError(null);
  }, [drafts]);

  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    if (!drafts) return;
    setSubmitting(true);
    const actions = createProjectActions(repos);
    const payload: ConfirmedContractPayload = {
      projectName: effective.projectName,
      projectType: effective.projectType,
      address: effective.address,
      clientName: effective.clientName,
      contractAmount: effective.contractAmount,
      signedAt: effective.signedAt ? new Date(`${effective.signedAt}T00:00:00Z`).toISOString() : null,
      startAt,
      endAt,
      stageOverrides: {},
      stagePresetKey: stagePresetKey ?? null,
      scheduleBasis: scheduleBasis ?? DEFAULT_SCHEDULE_BASIS,
      createdByManual: false,
      sourceFileName,
      rawTextDigest: digestOf(rawTextForDigest),
      parsedResultJsonSnapshot: JSON.stringify({ confirmedManuallyFromWizard: true }),
    };
    // 名称/占比覆写并回写 draft（ProjectService 以 drafts 为准入库）
    const mergedDrafts = drafts.map((d) => ({
      ...d,
      name: nameOverrides[d.orderIndex]?.trim() || d.name,
    }));
    const project = await actions.createFromContract(payload, mergedDrafts);
    setSubmitting(false);
    if (project) {
      onDone();
      void navigate(`/project/${project.id}`);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">项目开始日</span>
          <input
            type="date"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="w-full rounded-md border border-sand bg-paper px-2 py-1.5 text-sm outline-none focus:border-pine"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">项目竣工日</span>
          <input
            type="date"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="w-full rounded-md border border-sand bg-paper px-2 py-1.5 text-sm outline-none focus:border-pine"
          />
        </label>
      </div>

      {drafts && (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-sand text-left text-xs text-mist">
              <th className="py-1.5 pr-2 font-medium">#</th>
              <th className="py-1.5 pr-2 font-medium">阶段名</th>
              <th className="py-1.5 pr-2 font-medium">占比 %</th>
              <th className="py-1.5 pr-2 font-medium">开始</th>
              <th className="py-1.5 pr-2 font-medium">截止</th>
              <th className="py-1.5 font-medium">默认条目</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.orderIndex} className="border-b border-sand/60 last:border-b-0">
                <td className="py-1.5 pr-2 text-mist">{d.orderIndex}</td>
                <td className="py-1.5 pr-2">
                  <input
                    value={nameOverrides[d.orderIndex] ?? d.name}
                    onChange={(e) =>
                      setNameOverrides((m) => ({ ...m, [d.orderIndex]: e.target.value }))
                    }
                    className="w-28 rounded-md border border-transparent bg-transparent px-1 py-0.5 hover:border-sand focus:border-pine focus:bg-paper focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={ratioOverrides[d.orderIndex] ?? d.ratioPercent}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '');
                      setRatioOverrides((m) => ({
                        ...m,
                        [d.orderIndex]: raw === '' ? '' : Number(raw),
                      }));
                    }}
                    className="w-14 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-sand focus:border-pine focus:bg-paper focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2 tabular-nums">{d.startAt}</td>
                <td className="py-1.5 pr-2 tabular-nums">{d.endAt}</td>
                <td className="py-1.5 text-xs text-mist">{d.defaultTasks.length} 条</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-clay-soft bg-clay-soft/50 p-3 text-sm leading-6">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md border border-sand px-3 py-1.5 text-sm text-mist hover:bg-sand"
        >
          <ArrowLeft size={14} /> 返回核对
        </button>
        <button
          type="button"
          disabled={!drafts || submitting || Boolean(error)}
          onClick={() => void submit()}
          className="inline-flex items-center gap-1.5 rounded-md bg-pine px-4 py-2 text-sm text-white hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check size={15} /> 确认建档
        </button>
      </div>
    </div>
  );
}
