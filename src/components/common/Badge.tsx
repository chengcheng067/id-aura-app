import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

/** 轻量标签徽章（项目类型/阶段序号等场景复用） */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'pine' | 'amber' | 'clay' | 'ink';
  className?: string;
}): JSX.Element {
  const toneCls: Record<string, string> = {
    neutral: 'bg-sand text-mist',
    pine: 'bg-pine-soft text-pine-deep',
    amber: 'bg-amber-soft text-amber-deep',
    clay: 'bg-clay-soft text-clay-deep',
    ink: 'bg-ink text-cream',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        toneCls[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
