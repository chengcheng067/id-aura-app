/**
 * 剩余天数展示（PRD §7 色彩规则）：
 *   >3 天     黛蓝正文
 *   0–3 天    琥珀临期
 *   <0 天     赤陶红逾期 + 「逾期」前缀
 * 当日=0、昨日=-1（铁律 2 剩余口径）。
 */

import { remainingDays } from '../../lib/date';

export function CountdownNumber({
  target,
  todayIso,
  labelPrefix = '',
}: {
  target: string;
  /** 测试注入用；缺省取今天 */
  todayIso?: string;
  labelPrefix?: string;
}): JSX.Element {
  const days = remainingDays(target, todayIso);
  const overdue = days < 0;
  const urgent = !overdue && days <= 3;

  const colorCls = overdue ? 'text-clay' : urgent ? 'text-amber-deep' : 'text-ink';
  const captionCls = overdue ? 'text-clay' : urgent ? 'text-amber-deep' : 'text-mist';

  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`font-display text-display-lg leading-none ${colorCls}`}>
        {overdue ? `逾期 ${Math.abs(days)}` : Math.abs(days)}
      </span>
      <span className={`text-xs ${captionCls}`}>
        {overdue ? '天' : days === 0 ? '今天截止' : `${labelPrefix || '剩余'}天`}
      </span>
    </div>
  );
}
