import { useEffect, useId, useRef, type KeyboardEvent, type RefObject } from "react";
import { Link, useLocation } from "react-router-dom";

import { useDismissOnOutsideClick } from "@/hooks/useDismissOnOutsideClick";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  RAIL_PANELS,
  REPORT_ISSUE,
  isMoreEntryActive,
  isSettingsEntryActive,
  type NavEntry,
  type RailPanelId,
} from "@/lib/nav";

/**
 * The panel beside the rail that lists More and Settings.
 *
 * One component, two contents (`RAIL_PANELS`). It is fixed to the rail's right
 * edge, from under the top bar to the bottom of the window, so it overlays the
 * page and never reflows it. It closes on Escape, on a click outside it and
 * the rail buttons, and after an entry is chosen. Focus moves to the open
 * entry (or the first) and returns to the rail button on close.
 */
const ITEM_CLASS =
  "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-hover)] focus:bg-[var(--color-surface-hover)] focus:outline-none";

export function RailPanel({
  panel,
  id,
  buttons,
  onClose,
  onReport,
}: {
  panel: RailPanelId | null;
  /** The panel's own id, which the open rail button names in `aria-controls`. */
  id: string;
  /** The rail buttons that open it; a click on them is theirs, not "outside". */
  buttons: Record<RailPanelId, RefObject<HTMLButtonElement | null>>;
  /** `restoreFocus` is false when the close came from a click elsewhere. */
  onClose: (restoreFocus: boolean) => void;
  onReport: () => void;
}) {
  const { pathname, search } = useLocation();
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const open = panel !== null;

  useEscapeKey(open, () => onClose(true));
  useDismissOnOutsideClick(open, () => onClose(false), [ref, buttons.more, buttons.settings]);

  // Focus the open entry, or the first, whenever the panel opens or its
  // content switches.
  useEffect(() => {
    if (!panel) return;
    const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]');
    const lit = ref.current?.querySelector<HTMLElement>('[aria-current="page"]');
    (lit ?? first)?.focus({ preventScroll: true });
  }, [panel]);

  if (!panel) return null;
  const { title, entries, report } = RAIL_PANELS[panel];
  const isActive = (entry: NavEntry) =>
    panel === "more"
      ? isMoreEntryActive(entry, pathname, search)
      : isSettingsEntryActive(entry, pathname, search);

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

  const ReportIcon = REPORT_ISSUE.icon;

  return (
    <aside
      ref={ref}
      id={id}
      aria-labelledby={titleId}
      className="fixed bottom-0 left-16 top-10 z-40 flex w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
    >
      <h2
        id={titleId}
        className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
      >
        {title}
      </h2>
      <div
        role="menu"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="flex flex-1 flex-col overflow-y-auto pb-2"
      >
        {entries.map((entry) => {
          const Icon = entry.icon;
          const active = isActive(entry);
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
        {report && (
          <>
            <div className="mx-4 my-1 border-t border-[var(--color-border)]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose(true);
                onReport();
              }}
              className={`${ITEM_CLASS} text-[var(--color-text)]`}
            >
              <ReportIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              {REPORT_ISSUE.label}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
