import { STAGE_BAR_COLORS } from '../timeline/stageColors';
import { NOT_STARTED_COLOR, OVERDUE_COLOR, PROGRESS_DOT_COLOR } from './calendarColors';

/**
 * 月历图例（PRD §4.4 / §6.1）：解释色带语义，色块全部引用镜像 token（无裸 hex）。
 * 阶段①~⑨ 莫兰迪 / 逾期陶土红 / 未开始灰 / 蓝进度点。
 */

function Swatch({ color, ghost }: { color: string; ghost?: boolean }): JSX.Element {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-5 rounded-sm"
      style={{ backgroundColor: color, opacity: ghost ? 0.35 : 1 }}
    />
  );
}

function Dot({ color }: { color: string }): JSX.Element {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 rounded-full ring-2 ring-pine"
      style={{ backgroundColor: color }}
    />
  );
}

export function CalendarLegend(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-mist">
      {/* 阶段①~⑨：去掉每个的 pill 外壳，改为紧凑的「色块+序号」内联行，手机端不再被 9 个药丸挤碎换行 */}
      <div className="flex items-center gap-2">
        <span className="text-mist">阶段</span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5"
              title={`阶段${'①②③④⑤⑥⑦⑧⑨'[i - 1]}`}
            >
              <Swatch color={STAGE_BAR_COLORS[i]} />
              <span className="text-mist">{'①②③④⑤⑥⑦⑧⑨'[i - 1]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Swatch color={OVERDUE_COLOR} />
        <span className="text-mist">逾期</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Swatch color={NOT_STARTED_COLOR} ghost />
        <span className="text-mist">未开始</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Dot color={PROGRESS_DOT_COLOR} />
        <span className="text-mist">当前进度位置</span>
      </div>
    </div>
  );
}
