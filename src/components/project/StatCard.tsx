/**
 * 首页统计概览指标卡（严格对齐参考稿 §统计概览行）：
 *   glass-medium / 圆角 18 / padding 20 / gap 14；
 *   顶部行 = 40×40 圆角12 语义色图标底（色值 0.14 透明）+ 趋势胶囊（圆角8，色值 0.12）；
 *   数字 32/700 + 标签 13 次级文字。
 * 语义色全部走 Tailwind token（pine / amber / clay / stage.s1），禁止裸 hex。
 */

export type StatTone = 'pine' | 'amber' | 'clay' | 'sage';

const TONE_CLASS: Record<StatTone, { text: string; soft: string }> = {
  pine: { text: 'text-pine', soft: 'bg-pine-soft' },
  amber: { text: 'text-amber', soft: 'bg-amber-soft' },
  clay: { text: 'text-clay', soft: 'bg-clay-soft' },
  // 灰绿（参考稿「本月完工」）复用九段莫兰迪 stage.s1，避免新增配色体系
  sage: { text: 'text-stage-s1', soft: 'bg-stage-s1/15' },
};

export function StatCard({
  icon,
  tone,
  value,
  label,
  trend,
  trendDown = false,
}: {
  /** 卡片图标（与参考稿一致的极简字形，避免引入新图标库） */
  icon: string;
  tone: StatTone;
  value: number | string;
  label: string;
  /** 趋势文本；为 null 时不渲染趋势胶囊（无历史数据不伪造） */
  trend?: string | null;
  trendDown?: boolean;
}): JSX.Element {
  const t = TONE_CLASS[tone];

  return (
    <div className="glass-medium flex min-w-0 flex-1 flex-col gap-3.5 rounded-[18px] border border-sand p-5">
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${t.soft}`}
          aria-hidden
        >
          <span className={`text-[16px] ${t.text}`}>{icon}</span>
        </span>

        {trend ? (
          <span
            className={`flex items-center gap-1 rounded-[8px] px-2 py-1 text-[11px] font-medium ${t.soft} ${t.text}`}
          >
            <span aria-hidden>{trendDown ? '↘' : '↗'}</span>
            {trend}
          </span>
        ) : null}
      </div>

      <span className="text-[32px] font-bold leading-[38px] text-ink">{value}</span>
      <span className="truncate text-sm text-mist">{label}</span>
    </div>
  );
}
