import { useMemo, useState } from 'react';

import { ArrowLeft, Check, Pencil } from 'lucide-react';

import { parseContract } from '../../core/contract-parser';
import type { ContractParseResult, FieldCandidate, ParsedField } from '../../core/contract-parser/types';
import { Confidence, ProjectType, PROJECT_TYPE_LABELS } from '../../core/types/enums';
import type { ConfirmedContractPayload } from '../../core/types/dto';

/**
 * Step2：候选卡片确认。
 *   high（绿）直接带出 / mid（黄）需核对 / low（红）留空不默认带值。
 * 一键修正；三核心字段 + 项目基本信息一起在此表单化。
 */
export interface ConfirmedBaseInput {
  projectName: string;
  projectType: ProjectType;
  address: string;
  clientName: string;
  contractAmount: number | null;
  signedAt: string | null;
  startAt: string;
  endAt: string;
}

interface FieldCardProps {
  title: string;
  field: ParsedField | null;
  value: string;
  onChange(v: string): void;
}

/** 单字段候选卡片（带置信色与候选一键切换） */
function DateFieldCard({ title, field, value, onChange }: FieldCardProps): JSX.Element {
  const confidence = field?.confidence ?? Confidence.Low;
  const candidates = field?.candidates ?? [];

  const tone =
    confidence === Confidence.High
      ? 'border-pine bg-pine-soft/40'
      : confidence === Confidence.Mid
        ? 'border-amber bg-amber-soft/40'
        : 'border-clay/60 bg-clay-soft/30';

  const note =
    confidence === Confidence.High
      ? '高置信度 · 已带出'
      : confidence === Confidence.Mid
        ? '中置信度 · 请核对'
        : '低置信度 · 默认留空，可从候选手选或手动输入';

  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-mist">{note}</span>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="YYYY-MM-DD"
        className="w-full rounded-md border border-sand bg-paper px-2 py-1.5 text-sm outline-none focus:border-pine"
      />
      {candidates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {candidates.slice(0, 3).map((c: FieldCandidate, i) => (
            <button
              key={`${c.value}-${c.offset}`}
              type="button"
              title={c.snippet}
              onClick={() => onChange(c.value)}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                c.value === value
                  ? 'border-pine bg-pine text-white'
                  : 'border-sand bg-paper text-mist hover:bg-sand'
              }`}
            >
              候选{i + 1}：{c.value}
            </button>
          ))}
          {value !== '' && !candidates.some((c) => c.value === value) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-xs text-mist">
              <Pencil size={10} /> 手动值
            </span>
          )}
        </div>
      )}
      {field?.warnings.map((w) => (
        <p key={w} className="mt-1 text-xs leading-4 text-clay">
          ⚠ {w}
        </p>
      ))}
    </div>
  );
}

export function Step2CandidateConfirm({
  rawText,
  sourceFileName,
  onBack,
  onConfirmed,
}: {
  rawText: string;
  sourceFileName: string | null;
  onBack(): void;
  onConfirmed(payload: ConfirmedBaseInput): void;
}): JSX.Element {
  const result: ContractParseResult = useMemo(() => parseContract(rawText), [rawText]);

  const val = (f: ParsedField | null): string =>
    f && f.confidence !== Confidence.Low && f.candidates.length > 0 ? f.candidates[0].value : '';

  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>(ProjectType.Dining);
  const [address, setAddress] = useState('');
  const [clientName, setClientName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [signedDate, setSignedDate] = useState<string>(val(result.signedDate));
  const [startDate, setStartDate] = useState<string>(val(result.startDate));
  // 竣工优先取显式日期锚点，否则用工期换算的兜底值
  const fallbackEnd =
    result.endDate
      ? val(result.endDate)
      : result.startDate &&
          result.startDate.confidence !== Confidence.Low &&
          result.durationDays !== null
        ? computeFallbackEnd(
            val(result.startDate),
            result.durationDays,
            result.durationUnit ?? 'calendar',
          )
        : '';
  const [endDate, setEndDate] = useState<string>(fallbackEnd);

  const valid =
    projectName.trim().length > 0 && isYmd(signedDate || '2026-01-01') !== false;

  return (
    <div>
      {/* 解析告警区 */}
      {result.warnings.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-md border border-amber-soft bg-amber-soft/40 p-3 text-xs leading-5">
          {result.warnings.map((w) => (
            <li key={w} className="text-amber-deep">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}

      {/* 三核心字段候选卡片 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <DateFieldCard title="签订日期" field={result.signedDate} value={signedDate} onChange={setSignedDate} />
        <DateFieldCard title="开工 / 进场" field={result.startDate} value={startDate} onChange={setStartDate} />
        <DateFieldCard
          title="竣工 / 完工 / 验收"
          field={result.endDate}
          value={endDate}
          onChange={setEndDate}
        />
      </div>

      {/* 项目基本信息 */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <LabeledInput label="项目名称*" value={projectName} onChange={setProjectName} placeholder="如「XX茶空间·室内设计」" required />
        <label className="block text-sm">
          <span className="mb-1 block font-medium">项目类型</span>
          <select
            value={projectType}
            onChange={(e) => setProjectType(e.target.value as ProjectType)}
            className="w-full rounded-md border border-sand bg-paper px-2 py-1.5 text-sm outline-none focus:border-pine"
          >
            {Object.entries(PROJECT_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <LabeledInput label="地址" value={address} onChange={setAddress} placeholder="街道门牌（选填）" />
        <LabeledInput label="客户名称" value={clientName} onChange={setClientName} placeholder="甲方称呼（选填）" />
        <LabeledInput
          label="合同额（元，选填）"
          value={amountText}
          onChange={(v) => setAmountText(v.replace(/[^\d.]/g, ''))}
          placeholder="数字，单位元"
        />
        <LabeledInput label="合同来源文件名" value={sourceFileName ?? '粘贴文本'} readOnly disabled />
      </div>

      {/* 付款条款线索展示 */}
      {result.paymentClauses.length > 0 && (
        <div className="mt-4 rounded-md border border-sand bg-cream p-3 text-xs leading-5">
          <p className="mb-1 font-medium text-ink">付款节点线索（仅作阶段边界佐证，不入库强写）：</p>
          <ul className="space-y-0.5 text-mist">
            {result.paymentClauses.slice(0, 5).map((c, i) => (
              <li key={`${c.text}-${i}`}>
                · {c.percent ?? '?'}% ——{' '}
                {c.stageHintOrderIndex ? `${c.stageHintOrderIndex}. ${c.stageHintName}` : '未匹配到九阶段'}
                （{c.text.slice(0, 46)}…）
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md border border-sand px-3 py-1.5 text-sm text-mist hover:bg-sand"
        >
          <ArrowLeft size={14} /> 返回修改来源
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            onConfirmed({
              projectName: projectName.trim(),
              projectType,
              address: address.trim(),
              clientName: clientName.trim(),
              contractAmount: amountText ? Number(amountText) : null,
              signedAt: signedDate || null,
              startAt: startDate,
              endAt: endDate,
            })
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-pine px-4 py-2 text-sm text-white hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check size={15} /> 确认信息，选择阶段
        </button>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  readOnly,
  disabled,
}: {
  label: string;
  value: string;
  onChange?(v: string): void;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
}): JSX.Element {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        className="w-full rounded-md border border-sand bg-paper px-2 py-1.5 text-sm outline-none focus:border-pine disabled:bg-cream"
      />
    </label>
  );
}

/** 起点日期 + 工期 → 终点兜底换算（duration.parser 的 UI 层复用） */
function computeFallbackEnd(anchor: string, days: number, unit: 'calendar' | 'business'): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || days <= 0) return '';
  let cursor = d;
  let remaining = unit === 'business' ? days : days - 1; // 自然日含头尾减一
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 86400000);
    const dow = cursor.getUTCDay();
    if (unit === 'business' && (dow === 0 || dow === 6)) continue;
    remaining -= 1;
  }
  return cursor.toISOString().slice(0, 10);
}

function isYmd(v: string): boolean | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}
