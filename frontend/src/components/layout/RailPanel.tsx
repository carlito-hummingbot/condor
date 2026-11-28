import { Fragment, useEffect, useId, useRef, type KeyboardEvent, type RefObject } from "react";
import { Link, useLocation } from "react-router-dom";

import { useDismissOnOutsideClick } from "@/hooks/useDismissOnOutsideClick";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  SETTINGS_GROUPS,
  SETTINGS_TITLE,
  isReportEntry,
  isSettingsEntryActive,
} from "@/lib/nav";

/**
 * The Settings panel beside the rail.
 *
 * Fixed to the rail's right edge, from under the top bar to the bottom of the
 * window, so it overlays the page and never reflows it. The rows come from
 * `SETTINGS_GROUPS`: three groups with a thin divider between them and no group
 * titles. A window too short for all of them scrolls the list, title fixed.
 *
 * It closes on Escape, on a click outside it and the rail button, and after a
 * row is chosen. Focus moves to the open tab's row (or the first) and returns
 * to the rail button on close. Dividers are separators; the arrow keys skip
 * them.
 */
const ITEM_CLASS =
  "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-hover)] focus:bg-[var(--color-surface-hover)] focus:outline-none";

export function RailPanel({
  open,
  id,
  button,
  onClose,
  onReport,
}: {
  open: boolean;
  /** The panel's own id, which the open rail button names in `aria-controls`. */
  id: string;
  /** The rail button that opens it; a click on it is the button's, not "outside". */
  button: RefObject<HTMLButtonElement | null>;
  /** `restoreFocus` is false when the close came from a click elsewhere. */
  onClose: (restoreFocus: boolean) => void;
  onReport: () => void;
}) {
  const { pathname, search } = useLocation();
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();

  useEscapeKey(open, () => onClose(true));
  useDismissOnOutsideClick(open, () => onClose(false), [ref, button]);

  // Focus the open tab's row, or the first, whenever the panel opens.
  useEffect(() => {
    if (!open) return;
    const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]');
    const lit = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    (lit ?? first)?.focus({ preventScroll: true });
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (at + 1) % items.length;
    else if (e.key === "ArrowUp") next = (at - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    items[next]?.focus();
  };

  return (
    <aside
      ref={ref}
      id={id}
      aria-labelledby={titleId}
      className="fixed bottom-0 left-16 top-10 z-40 flex w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
    >
      <h2
        id={titleId}
        className="shrink-0 px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
      >
        {SETTINGS_TITLE}
      </h2>
      <div
        role="menu"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2"
      >
        {SETTINGS_GROUPS.map((group, g) => (
          <Fragment key={g}>
            {g > 0 && <div role="separator" className="mx-4 my-1 border-t border-[var(--color-border)]" />}
            {group.map((entry) => {
              const Icon = entry.icon;
              if (isReportEntry(entry)) {
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose(true);
                      onReport();
                    }}
                    className={`${ITEM_CLASS} text-[var(--color-text)]`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                    {entry.label}
                  </button>
                );
              }
              const active = isSettingsEntryActive(entry, pathname, search);
              return (
                <Link
                  key={entry.id}
                  to={entry.to}
                  role="menuitem"
                  onClick={() => onClose(true)}
                  aria-current={active ? "page" : undefined}
                  className={`${ITEM_CLASS} ${
                    active ? "bg-[var(--color-primary-fill)]/10 text-[var(--color-primary)]" : "text-[var(--color-text)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                  {entry.label}
                </Link>
              );
            })}
          </Fragment>
        ))}
      </div>
    </aside>
  );
}
