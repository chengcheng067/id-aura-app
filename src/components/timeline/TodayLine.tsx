import { TODAY_LINE_COLOR } from './timelineColors';

/** 今日垂直虚线（贯穿时间轴全高）。v0.3 hex 收敛：clay 旧值 #C4553B → semantic-danger #f06548 */
export function TodayLine({ x, height }: { x: number; height: number }): JSX.Element | null {
  if (!Number.isFinite(x)) return null;
  return (
    <g pointerEvents="none">
      <line
        x1={x}
        x2={x}
        y1={0}
        y2={height}
        stroke={TODAY_LINE_COLOR}
        strokeWidth={1.4}
        strokeDasharray="5 4"
      />
      <circle cx={x} cy={4} r={3} fill={TODAY_LINE_COLOR} />
    </g>
  );
}
