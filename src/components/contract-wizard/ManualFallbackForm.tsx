import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { Check, X } from 'lucide-react';

import { type ConfirmedContractPayload } from '../../core/types/dto';
import { ProjectType, PROJECT_TYPE_LABELS } from '../../core/types/enums';
import { createProjectActions } from '../../store/useProjectsStore';
import { useRepos } from '../../hooks/useRepos';

/**
 * 纯手动兜底建档（与向导并列可达，任何情况下都能建好档）。
 * 受控组件：由页面/顶栏控制显隐。
 */
export function ManualFallbackForm({
  open,
  onClose,
}: {
  open: boolean;
  onClose(): void;
}): JSX.Element | null {
  const repos = useRepos();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>(ProjectType.Dining);
  const [address, setAddress] = useState('');
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [startAt, setStartAt] = useState(new Date().toISOString().slice(0, 10));
  const [endAt, setEndAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const submit = async (): Promise<void> => {
    setError(null);
    if (!name.trim() || !endAt) {
      setError('项目名称与竣工日为必填。');
      return;
    }
    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      setError('竣工日不能早于开始日。');
      return;
    }
    setSubmitting(true);
    const actions = createProjectActions(repos);
    void (0 as unknown as ConfirmedContractPayload); // 类型引用占位：payload 由 service 组装
    const project = await actions.createManual({
      name: name.trim(),
      type,
      address: address.trim(),
      clientName: clientName.trim(),
      contractAmount: amount ? Number(amount.replace(/[^\d.]/g, '')) : null,
      signedAt: null,
      plannedStartAt: startAt,
      plannedEndAt: endAt,
      coverColor: null,
    });
    setSubmitting(false);
    if (project) {
      onClose();
      void navigate(`/project/${project.id}`);
    } else {
      setError('建档失败：请检查日期是否有效。');
    }
  };

  return (
    <div className="rounded-md border border-sand bg-paper p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-display-md">手动建档</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭手动建档"
          className="rounded-md p-1 text-mist hover:bg-sand"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">项目名称 *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如「XX餐饮·室内设计」"
            className="w-full rounded-md border border-sand px-2 py-1.5 text-sm outline-none focus:border-pine"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">类型</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ProjectType)}
            className="w-full rounded-md border border-sand px-2 py-1.5 text-sm outline-none focus:border-pine"
          >
            {Object.entries(PROJECT_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">地址</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-md border border-sand px-2 py-1.5 text-sm outline-none focus:border-pine"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">客户名称</span>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full rounded-md border border-sand px-2 py-1.5 text-sm outline-none focus:border-pine"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">合同额（元，选填）</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="数字"
            className="w-full rounded-md border border-sand px-2 py-1.5 text-sm outline-none focus:border-pine"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">开始 *</span>
            <input
              type="date"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-md border border-sand px-2 py-1.5 text-sm outline-none focus:border-pine"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">竣工 *</span>
            <input
              type="date"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full rounded-md border border-sand px-2 py-1.5 text-sm outline-none focus:border-pine"
            />
          </label>
        </div>
      </div>

      {error && <p className="mt-3 text-sm leading-6 text-clay">{error}</p>}

      <button
        type="button"
        disabled={submitting}
        onClick={() => void submit()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-pine px-4 py-2 text-sm text-white hover:bg-pine-deep disabled:opacity-40"
      >
        <Check size={15} /> 建档（按九阶段模板切分）
      </button>
    </div>
  );
}
