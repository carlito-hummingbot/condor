import { Bug } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { AnchoredMenu } from "@/components/ui/AnchoredMenu";
import { MORE_ITEMS, isRailEntryActive } from "@/lib/nav";

/**
 * The rail's ⋯ menu: the pages that left the top bar and still need a door.
 *
 * Rows have an icon and a label — the menu has the room the rail does not.
 * Report an issue sits under a divider; it opens the existing dialog rather
 * than navigating.
 */
export function MoreMenu({
  anchor,
  open,
  onClose,
  onReport,
}: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onReport: () => void;
}) {
  const { pathname, search } = useLocation();
  const current = MORE_ITEMS.find((item) => isRailEntryActive(item.id, pathname, search));

  return (
    <AnchoredMenu
      anchor={anchor}
      open={open}
      onClose={onClose}
      align="left"
      role="menu"
      className="min-w-[220px] py-1"
    >
      {current && (
        <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          {current.label}
        </div>
      )}
      {MORE_ITEMS.map(({ id, to, icon: Icon, label }) => {
        const active = isRailEntryActive(id, pathname, search);
        return (
          <Link
            key={id}
            to={to}
            role="menuitem"
            onClick={onClose}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-hover)] ${
              active ? "bg-[var(--color-primary-fill)]/10 text-[var(--color-primary)]" : "text-[var(--color-text)]"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            {label}
          </Link>
        );
      })}
      <div className="mx-3 my-1 border-t border-[var(--color-border)]" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onReport();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]"
      >
        <Bug className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        Report an issue
      </button>
    </AnchoredMenu>
  );
}
