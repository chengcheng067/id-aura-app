/**
 * 月份刻度尺（zoom=half-month 时切为半月刻度）。
 * 纯展示：宽度 = daysSpan × pxPerDay（与 TimelineView 同一坐标系）。
 */

export interface ScaleTick {
  start: string;
  label: string;
  daysSpan: number;
}

export function MonthScaleHeader({
  ticks,
  pxPerDay,
}: {
  ticks: ScaleTick[];
  pxPerDay: number;
}): JSX.Element {
  return (
    <div className="flex h-full items-stretch">
      {ticks.map((t) => (
        <div
          key={`${t.start}-${t.label}`}
          style={{ width: t.daysSpan * pxPerDay }}
          className="flex items-center border-r border-sand/70 bg-cream px-2 text-xs text-mist last:border-r-0"
        >
          <span className="truncate">{t.label}</span>
        </div>
      ))}
    </div>
  );
}
