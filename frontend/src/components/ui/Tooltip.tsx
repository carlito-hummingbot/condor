import {
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * A label that appears beside its trigger, on hover and on keyboard focus.
 *
 * The rail is icon-only. The name of each item lives here and on `aria-label`,
 * not under the glyph. Rendered into `document.body` for the same reason
 * `AnchoredMenu` is: an `overflow-hidden` pane must not clip it. The look is
 * `HintBubble`'s — a small bordered surface, not a new style.
 */
const SHOW_DELAY_MS = 300;

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const show = () => {
    clear();
    timer.current = setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }, SHOW_DELAY_MS);
  };

  const hide = () => {
    clear();
    setPos(null);
  };

  // Focus does not bubble, but it does participate in capture. A tooltip on
  // the wrapper then follows whichever control inside it received focus.
  const onFocusCapture = (event: FocusEvent<HTMLSpanElement>) => {
    if (event.currentTarget.contains(event.target as Node)) show();
  };

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={onFocusCapture}
      onBlurCapture={hide}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translateY(-50%)",
            }}
            className="pointer-events-none z-50 whitespace-nowrap rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-text)] shadow-lg"
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}
