import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useDisplayName } from "@/hooks/useDisplayName";
import { useAuth } from "@/lib/auth";
import {
  MORE_ICON,
  RAIL_PANELS,
  REPORT_ISSUE,
  SETTINGS_ICON,
  isMoreActive,
  isMoreEntryActive,
  isSettingsActive,
  isSettingsEntryActive,
  type NavEntry,
  type RailPanelId,
} from "@/lib/nav";
import { BottomSheet } from "./BottomSheet";

/**
 * The phone's Account sheet. Its first level is who is signed in and three
 * rows: More, Settings, Logout. More and Settings open a second level inside
 * the same sheet, with a back arrow, so the sheet stays one short list at a
 * time. The lists are the rail panel's (`RAIL_PANELS` in `lib/nav`), not copies.
 */
const ROW =
  "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--color-surface-hover)]";

export function AccountSheet({
  open,
  onClose,
  onReport,
}: {
  open: boolean;
  onClose: () => void;
  onReport: () => void;
}) {
  const { pathname, search } = useLocation();
  const name = useDisplayName();
  const { user, logout } = useAuth();
  const role = user?.role === "admin" ? "Admin" : user?.role === "user" ? "User" : user?.role;
  const [level, setLevel] = useState<RailPanelId | null>(null);

  // Always reopen on the first level.
  useEffect(() => {
    if (!open) setLevel(null);
  }, [open]);

  const MoreIcon = MORE_ICON;
  const SettingsIcon = SETTINGS_ICON;
  const ReportIcon = REPORT_ISSUE.icon;

  if (level) {
    const { title, entries, report } = RAIL_PANELS[level];
    const lit = (entry: NavEntry) =>
      level === "more"
        ? isMoreEntryActive(entry, pathname, search)
        : isSettingsEntryActive(entry, pathname, search);
    return (
      <BottomSheet open={open} onClose={onClose} label={title}>
        <div className="flex items-center gap-1 px-2 pb-1 pt-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => setLevel(null)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {title}
          </h2>
        </div>
        <div role="menu" aria-label={title} className="pb-2">
          {entries.map((entry) => {
            const Icon = entry.icon;
            const active = lit(entry);
            return (
              <Link
                key={entry.id}
                to={entry.to}
                role="menuitem"
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`${ROW} ${
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
                  onClose();
                  onReport();
                }}
                className={`${ROW} text-[var(--color-text)]`}
              >
                <ReportIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                {REPORT_ISSUE.label}
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    );
  }

  const moreLit = isMoreActive(pathname, search);
  const settingsLit = isSettingsActive(pathname, search);
  const rowClass = (active: boolean) =>
    `${ROW} ${active ? "bg-[var(--color-primary-fill)]/10 text-[var(--color-primary)]" : "text-[var(--color-text)]"}`;

  return (
    <BottomSheet open={open} onClose={onClose} label="Account">
      <div className="px-4 pb-2 pt-3">
        <div className="truncate text-sm font-medium text-[var(--color-text)]">{name}</div>
        {role && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            {role}
          </div>
        )}
      </div>
      <div className="mx-4 border-t border-[var(--color-border)]" />
      <div role="menu" aria-label="Account" className="py-1">
        <button type="button" role="menuitem" onClick={() => setLevel("more")} className={rowClass(moreLit)}>
          <MoreIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          <span className="flex-1">{RAIL_PANELS.more.title}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        </button>
        <button type="button" role="menuitem" onClick={() => setLevel("settings")} className={rowClass(settingsLit)}>
          <SettingsIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          <span className="flex-1">{RAIL_PANELS.settings.title}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            logout();
          }}
          className={`${ROW} text-[var(--color-text)] hover:text-[var(--color-red)]`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </BottomSheet>
  );
}
