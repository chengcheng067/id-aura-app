/**
 * 月历甘特内联色镜像（PRD §6.2 铁律 8 + 镜像机制）：
 * 组件内一律用 Tailwind token class；色带 / 进度点 / 图例等需要内联 fill 的场景，
 * 色值必须集中镜像到本文件（与 tailwind.config / stageColors / timelineColors 同步，
 * 修改任一处三处必须同步）。禁止在组件里写裸 hex。
 */

import { STAGE_BAR_COLORS } from '../timeline/stageColors';
import { TODAY_LINE_COLOR, RING_PROGRESS } from '../timeline/timelineColors';

/** 未开始幽灵态底色 = mist token（#a0a0a8） */
export const NOT_STARTED_COLOR = '#a0a0a8';

/** 逾期色带 = clay token（#f06548，复用今日线色，同一语义源） */
export const OVERDUE_COLOR = TODAY_LINE_COLOR;

/** 已完成色带 = stage.s9（九段色末段，token 唯一来源） */
export const COMPLETED_COLOR = STAGE_BAR_COLORS[9];

/** 末端蓝色进度点 = pine token（#6ea8fe，复用完成度环进度色） */
export const PROGRESS_DOT_COLOR = RING_PROGRESS;

/** 按阶段 orderIndex 取莫兰迪九段色（与旧时间轴完全一致） */
export function stageColorOf(orderIndex: number): string {
  return STAGE_BAR_COLORS[orderIndex] ?? COMPLETED_COLOR;
}
