import { Link, useLocation } from "react-router-dom";

import { AnchoredMenu } from "@/components/ui/AnchoredMenu";
import { MORE_ITEMS, REPORT_ISSUE, isMoreEntryActive } from "@/lib/nav";

/**
 * The rail's More menu: the Settings tabs people reach for most, then Report
 * an Issue, which opens the existing dialog rather than navigating.
 *
 * Rows have an icon and a label: the menu has the room the rail does not.
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
  const ReportIcon = REPORT_ISSUE.icon;

  return (
    <AnchoredMenu
      anchor={anchor}
      open={open}
      onClose={onClose}
      align="left"
      role="menu"
      className="min-w-[220px] py-1"
    >
      {MORE_ITEMS.map((entry) => {
        const Icon = entry.icon;
        const active = isMoreEntryActive(entry, pathname, search);
        return (
          <Link
            key={entry.id}
            to={entry.to}
            role="menuitem"
            onClick={onClose}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-hover)] ${
              active ? "bg-[var(--color-primary-fill)]/10 text-[var(--color-primary)]" : "text-[var(--color-text)]"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            {entry.label}
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
        <ReportIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        {REPORT_ISSUE.label}
      </button>
    </AnchoredMenu>
  );
}
