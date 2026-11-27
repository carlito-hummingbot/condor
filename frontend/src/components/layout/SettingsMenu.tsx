import { Link, useLocation } from "react-router-dom";

import { AnchoredMenu } from "@/components/ui/AnchoredMenu";
import { SETTINGS_ITEMS, isSettingsEntryActive } from "@/lib/nav";

/**
 * The rail's Settings menu: five Settings tabs, none of them in More.
 *
 * Same row layout as the More menu. Each row opens the matching tab of the
 * Settings page.
 */
export function SettingsMenu({
  anchor,
  open,
  onClose,
}: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}) {
  const { pathname, search } = useLocation();

  return (
    <AnchoredMenu
      anchor={anchor}
      open={open}
      onClose={onClose}
      align="left"
      role="menu"
      className="min-w-[220px] py-1"
    >
      {SETTINGS_ITEMS.map((entry) => {
        const Icon = entry.icon;
        const active = isSettingsEntryActive(entry, pathname, search);
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
    </AnchoredMenu>
  );
}
