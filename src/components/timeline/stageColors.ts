/**
 * 九段彩条配色映射（设计 token 的别名层）。
 * 颜色本体唯一来源是 tailwind.config.ts 的 colors.stage.*（铁律 8）；
 * SVG 属性无法使用 Tailwind class，故此处集中镜像 token 十六进制值，
 * 与 tailwind.config 保持一致——修改时两处必须同步。
 * v0.3 变更 B：九色暗色适配（提亮降饱和，保证 #161616 底上可读）。
 */

export const STAGE_BAR_COLORS: Readonly<Record<number, string>> = {
  1: '#A9C6B7',
  2: '#9FBBD0',
  3: '#D3B99B',
  4: '#BCA8CD',
  5: '#C4D2BC',
  6: '#93AFBF',
  7: '#D5BEAA',
  8: '#9CB8A8',
  9: '#BBB59D',
};
