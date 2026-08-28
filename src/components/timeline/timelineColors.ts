/**
 * 时间轴 SVG 硬编码 hex 收敛（v0.4 灰底）：
 * SVG 属性（fill/stroke/feDropShadow floodColor）无法使用 Tailwind class，
 * 故集中镜像 token 值，与 tailwind.config / global.css :root 保持一致——修改时三处必须同步。
 * 头像底色 hex（AVATAR_COLORS / Member.avatarColor）为受控例外（规范 §3.1 注释允许），不在此列。
 */

/** 时间轴行底纹：激活阶段整行高亮（v0.4.1 对比度微调：#3c3c40 → #42424a，比奇数行更亮一档） */
export const ROW_BG_ACTIVE = '#42424a';

/** 时间轴行底纹：偶数行（v0.4.1 对比度微调：surface-base #2a2a2c → #26262a） */
export const ROW_BG_EVEN = '#26262a';

/** 时间轴行底纹：奇数行（v0.4.1 对比度微调：surface-raised #353538 → #3a3a40） */
export const ROW_BG_ODD = '#3a3a40';

/** 激活彩条描边（原墨绿 #2E5548 → accent #6ea8fe） */
export const STAGE_ACTIVE_STROKE = '#6ea8fe';

/** 激活彩条发光（feDropShadow floodColor 原 #3D6B5B → accent #6ea8fe 系） */
export const STAGE_GLOW_COLOR = '#6ea8fe';

/** 完成度环：外圈 track（border 弱描边，暗色玻璃底上可见但不刺眼） */
export const RING_TRACK = 'rgba(255,255,255,0.10)';

/** 完成度环：进度条（accent-default #6ea8fe，全站主操作一致） */
export const RING_PROGRESS = '#6ea8fe';

/** 完成度环：百分比文字（text-primary #f7f7fa，灰底可读 ≥4.5:1） */
export const RING_TEXT = '#f7f7fa';

/** 今日线（semantic-danger #f06548；原 v0.2 clay 旧值 #C4553B 已收敛） */
export const TODAY_LINE_COLOR = '#f06548';

/**
 * 休息日竖向条带（tailwind token rest-day.band，T7）。
 * 半透明叠加在行底纹之上——只做语义底纹，不改变 xOf 的自然日线性映射。
 */
export const REST_DAY_BAND = 'rgba(255,255,255,0.02)';
