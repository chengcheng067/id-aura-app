import { StageStatus } from '../../core/types/enums';
import { cn } from '../../lib/cn';

/** 四态胶囊：未开始灰 / 进行中绿 / 已完成黛蓝 / 延期赤陶红（PRD §7 色彩规则） */
export function StatusPill({
  status,
  size = 'md',
}: {
  status: StageStatus;
  size?: 'sm' | 'md';
}): JSX.Element {
  const label =
    status === StageStatus.NotStarted
      ? '未开始'
      : status === StageStatus.InProgress
        ? '进行中'
        : status === StageStatus.Completed
          ? '已完成'
          : '延期';

  const colorCls =
    status === StageStatus.NotStarted
      ? 'bg-sand text-mist'
      : status === StageStatus.InProgress
        ? 'bg-pine-soft text-pine-deep'
        : status === StageStatus.Completed
          ? 'bg-ink text-cream'
          : 'bg-clay-soft text-clay-deep';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        colorCls,
      )}
    >
      {label}
    </span>
  );
}
