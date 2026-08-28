import { useEffect, useRef } from 'react';

import { createPortal } from 'react-dom';

/**
 * 通用浮层底座（modal-overlay 基础设施）。
 *
 * 为什么存在：`position: fixed` 一旦祖先含非 `none` 的 `backdrop-filter` / `transform` /
 * `filter` / `perspective` / `will-change` / `contain:paint`，就会退化为相对该祖先定位，
 * 导致弹窗跑到顶部、且超出祖先高度被裁切（信息丢失）。本组件用 createPortal 挂到
 * `document.body`，彻底隔离祖先 CSS 对 fixed 的破坏，今后新增浮层一律走它即可从底层杜绝复发。
 *
 * 已替你处理的边界：
 *  - 遮罩点击关闭（`e.target === e.currentTarget`）、Escape 关闭
 *  - 焦点圈禁（打开聚焦面板，Tab 循环不逃逸到页面背后）
 *  - body 滚动锁定（overflow:hidden + 补偿 scrollbar 宽度，页面不跳动）
 *  - z-index 统一（高于顶部 toast 层），ATIA `role="dialog"` `aria-modal="true"`
 *
 * 用法（必传 open / onClose / children，placement 可省略）：
 *   <Modal open={isOpen} onClose={close}>
 *     <div className="glass-strong ...">你的弹窗面板</div>
 *   </Modal>
 *   侧滑抽屉传 placement="right"，子面板给 max-w + 自己撑满高度即可。
 *
 * 注意：`glass-strong / iridescent-border` 等玻璃样式请放在子面板（children 内）上，
 * 不要加到外层遮罩上——遮罩由本组件统一渲染，否则玻璃自身又变成新的固定包含块。
 */
export function Modal({
  open,
  onClose,
  placement = 'center',
  ariaLabel = '浮层',
  children,
}: {
  open: boolean;
  onClose(): void;
  /** 对齐方式：center（居中弹窗，默认）/ right（右侧滑出抽屉） */
  placement?: 'center' | 'right';
  /** 无障碍标签，读屏用 */
  ariaLabel?: string;
  children: React.ReactNode;
}): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // Escape 关闭 + 焦点圈禁 + 滚动锁定。
  useEffect(() => {
    if (!open) return;

    // 记录打开前的焦点元素，关闭后还原。
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    // 打开后聚焦面板（保证 Tab 循环起始点 + 可读屏聚焦）。
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // 焦点圈禁：Tab / Shift+Tab 在面板内循环。
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    // 锁定 body 滚动并补偿滚动条宽度，避免打开弹窗瞬间页面横向跳动。
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      // 关闭后把焦点还原给触发元素。
      lastFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className={`fixed inset-0 z-[70] ${
        placement === 'right' ? 'flex justify-end bg-ink/20' : 'flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-6 backdrop-blur-[6px]'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* 面板：焦点圈禁的锚点。玻璃样式放内层面板，勿放此处。
          居中弹窗用 justify-center；右侧抽屉用自撑（子组件给 h-full 宽度即可）。 */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`outline-none ${placement === 'right' ? 'w-full' : 'flex w-full justify-center'}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
