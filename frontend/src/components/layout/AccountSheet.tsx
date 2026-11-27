import { ChevronLeft, ChevronRight, LogOut, UserRound } from "lucide-react";
import { Fragment, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useDisplayName } from "@/hooks/useDisplayName";
import { useAuth } from "@/lib/auth";
import {
  SETTINGS_GROUPS,
  SETTINGS_ICON,
  SETTINGS_TITLE,
  isReportEntry,
  isSettingsActive,
  isSettingsEntryActive,
} from "@/lib/nav";
import { BottomSheet } from "./BottomSheet";

/**
 * The phone's Account sheet. First level: who is signed in (name and role),
 * then three rows: Account, Settings, Logout. Account closes the sheet and
 * opens the shared `AccountDialog` (see `onAccount`). Settings opens a second
 * level inside the same sheet, with a back arrow: the rail panel's list
 * (`SETTINGS_GROUPS` in `lib/nav`, not a copy), in its three groups with a thin
 * divider between them. The list is longer than a short phone screen, so the
 * sheet scrolls (`BottomSheet` caps its height) and the last row stays reachable.
 */
const ROW =
  "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-[var(--color-surface-hover)]";
const LIT = "bg-[var(--color-primary-fill)]/10 text-[var(--color-primary)]";
const PLAIN = "text-[var(--color-text)]";

export function AccountSheet({
  open,
  onClose,
  onReport,
  onAccount,
}: {
  open: boolean;
  onClose: () => void;
  onReport: () => void;
  /** Called after the sheet has closed itself, to open the Account dialog. */
  onAccount: () => void;
}) {
  // The body mounts only while open, so it always starts on the first level.
  return open ? <AccountSheetBody onClose={onClose} onReport={onReport} onAccount={onAccount} /> : null;
}

function AccountSheetBody({
  onClose,
  onReport,
  onAccount,
}: {
  onClose: () => void;
  onReport: () => void;
  onAccount: () => void;
}) {
  const { pathname, search } = useLocation();
  const name = useDisplayName();
  const { user, logout } = useAuth();
  const role = user?.role === "admin" ? "Admin" : user?.role === "user" ? "User" : user?.role;
  const [settingsOpen, setSettingsOpen] = useState(false);

  const SettingsIcon = SETTINGS_ICON;

  if (settingsOpen) {
    return (
      <BottomSheet open onClose={onClose} label={SETTINGS_TITLE}>
        <div className="flex items-center gap-1 px-2 pb-1 pt-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => setSettingsOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {SETTINGS_TITLE}
          </h2>
        </div>
        <div role="menu" aria-label={SETTINGS_TITLE} className="pb-2">
          {SETTINGS_GROUPS.map((group, index) => (
            <Fragment key={index}>
              {index > 0 && (
                <div role="separator" className="mx-4 my-1 border-t border-[var(--color-border)]" />
              )}
              {group.map((entry) => {
                const Icon = entry.icon;
                if (isReportEntry(entry)) {
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onClose();
                        onReport();
                      }}
                      className={`${ROW} ${PLAIN}`}
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
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={`${ROW} ${active ? LIT : PLAIN}`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                    {entry.label}
                  </Link>
                );
              })}
            </Fragment>
          ))}
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} label="Account">
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
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onAccount();
          }}
          className={`${ROW} ${PLAIN}`}
        >
          <UserRound className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          Account
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => setSettingsOpen(true)}
          className={`${ROW} ${isSettingsActive(pathname) ? LIT : PLAIN}`}
        >
          <SettingsIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          <span className="flex-1">{SETTINGS_TITLE}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            logout();
          }}
          className={`${ROW} ${PLAIN} hover:text-[var(--color-red)]`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </BottomSheet>
  );
}
