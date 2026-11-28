/**
 * The page nav: the short row of sections under a page's heading.
 *
 * One look for every page that has one — Dashboard, Explore and Build — taken
 * from Build's tab row: the selected item is yellow on a yellow tint
 * (`bg-[var(--color-primary)]/15 text-[var(--color-primary)]`), the rest stay
 * muted, and the row scrolls sideways on a phone rather than wrapping. This is
 * the page's own nav; the side rail (Dashboard, Explore, Build) is separate and
 * unchanged.
 *
 * It is a real `tablist`: one selected tab, roving `tabIndex`, and arrow, Home
 * and End keys, so a keyboard user can move along it. What a tab shows is the
 * caller's business — Explore's four sections, Build's five stages, the
 * Dashboard's sample panels.
 *
 * Showcase only, like the pages that use it.
 */

import type { KeyboardEvent, ReactNode } from "react";

export interface PageNavItem {
  id: string;
  /** What the tab reads. Build passes "1 Design", Explore "Strategies". */
  label: string;
  /** An optional count or dot after the label. */
  badge?: ReactNode;
}

const TAB =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors";
const ON = "bg-[var(--color-primary)]/15 text-[var(--color-primary)]";
const OFF =
  "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]";

export function PageNav({
  label,
  items,
  current,
  onSelect,
  idPrefix,
}: {
  /** The tablist's accessible name: "Dashboard sections", "Build stages". */
  label: string;
  items: readonly PageNavItem[];
  current: string;
  onSelect: (id: string) => void;
  /** Prefix for the tab and panel ids, so two pages never share one. */
  idPrefix: string;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === current);
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight"
        ? Math.min(index + 1, last)
        : event.key === "ArrowLeft"
          ? Math.max(index - 1, 0)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onSelect(items[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const selected = item.id === current;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(item.id)}
            className={`${TAB} ${selected ? ON : OFF}`}
          >
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}
