import type { Config } from 'tailwindcss';

/**
 * ID 系列「液态玻璃」design token 唯一来源（共享知识铁律 8；v0.3 变更 B 别名映射）。
 * 组件内禁写裸色值 hex，一律引用这里的命名 token。
 *
 * v0.4 策略：旧 token 名（cream/paper/sand/ink/mist/pine/amber/clay/stage）**直接重映射**为
 * 灰底液态玻璃新值——30+ 组件引用的 `bg-cream`/`bg-paper`/`border-sand`/`text-pine` 等 className
 * 一个不改，全站自动换肤；玻璃类/虹彩/Aura 由 global.css utility 增量叠加（架构 3.2 映射表）。
 * 亮色主题 `.theme-light` 明确不做（PRD 待确认 6 默认：仅暗色基线）。
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './tests/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /** surface-base 应用底色（v0.4.1 对比度微调：#2a2a2c → #26262a，压深让前景浮起） */
        cream: '#26262a',
        /** surface-raised 卡片/面板底（v0.4.1 对比度微调：#353538 → #3a3a40，提亮拉开层次） */
        paper: '#3a3a40',
        /** glass-border / hover-subtle（v0.4.1 对比度微调：0.08 → 0.12，边界更清晰） */
        sand: 'rgba(255,255,255,0.12)',
        /** text-primary 主文字（v0.4 稍暖白 #f7f7fa） */
        ink: '#f7f7fa',
        /** text-secondary 弱文字（v0.4 灰底次级 #a0a0a8） */
        mist: '#a0a0a8',
        /** accent-default 主操作/链接/选中（主行动按钮另用 Aura 渐变） */
        pine: {
          DEFAULT: '#6ea8fe',
          soft: 'rgba(110,168,254,0.14)',
          deep: '#2563eb',
        },
        /** semantic-warning 临期 */
        amber: {
          DEFAULT: '#e5b042',
          soft: 'rgba(229,176,66,0.14)',
          deep: '#d1a03c',
        },
        /**
         * 休息日底纹（公司休息制度 · 渲染层专用，T7）：低饱和中性灰，
         * 沉于 surface-raised(paper #3a3a40) 与 surface-base(cream #26262a) 之间。
         *   DEFAULT —— 月历休息日格 / 时间轴条带（不透明）
         *   band    —— 时间轴 SVG 竖向条带（半透明叠加在行底纹之上，不遮挡阶段彩条）
         * 语义只走 src/lib/workdays.ts 的 isRestDay，此处仅提供颜色。
         */
        'rest-day': {
          DEFAULT: '#31313a',
          band: 'rgba(255,255,255,0.05)',
        },
        /** semantic-danger 逾期/危险 */
        clay: {
          DEFAULT: '#f06548',
          soft: 'rgba(240,101,72,0.14)',
          deep: '#ff7a5c',
        },
        /**
         * 时间轴九段莫兰迪低饱和彩条（阶段 1→9 顺色）——暗色适配：提亮降饱和，保证 #161616 底上可读。
         * 仅集中定义于此，时间轴/图例统一引用 stage.sX；stageColors.ts 镜像同步（两处必须一致）。
         */
        stage: {
          s1: '#A9C6B7',
          s2: '#9FBBD0',
          s3: '#D3B99B',
          s4: '#BCA8CD',
          s5: '#C4D2BC',
          s6: '#93AFBF',
          s7: '#D5BEAA',
          s8: '#9CB8A8',
          s9: '#BBB59D',
        },
      },
      fontFamily: {
        // 全局无衬线（品牌位「ID Plan」同规范，PRD 待确认 11）
        display: ['Inter', 'Noto Sans SC', '-apple-system', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        body: ['Inter', 'Noto Sans SC', '-apple-system', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      boxShadow: {
        // 暗色 elevation-1（原极浅纸面感 → 暗色阴影体系）
        soft: '0 1px 3px rgba(0,0,0,0.4)',
        glass: '0 4px 24px rgba(0,0,0,0.4)',
        'glow-card-hover': '0 0 20px rgba(110,168,254,0.08)',
      },
      borderRadius: {
        // 规范 --radius 体系（v0.3 大圆角升级，不破坏布局）
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        '3xl': '20px',
        full: '9999px',
      },
      fontSize: {
        // 规范字号阶梯（11/13/14/15/18/24）+ 保留 display-lg/md 键名（值随规范微调）
        xs: '11px',
        sm: '13px',
        base: '14px',
        md: '15px',
        lg: '18px',
        xl: '24px',
        'display-lg': ['1.5rem', { lineHeight: '1.35' }],
        'display-md': ['1.125rem', { lineHeight: '1.4' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
