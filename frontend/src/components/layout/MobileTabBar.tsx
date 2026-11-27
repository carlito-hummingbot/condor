import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { initialsFrom, useDisplayName } from "@/hooks/useDisplayName";
import { useServerRoster } from "@/hooks/useServerRoster";
import { RAIL_TOP, isRailItemLit, isSettingsActive, type RailOverlayId } from "@/lib/nav";
import { AccountDialog } from "./AccountDialog";
import { AccountSheet } from "./AccountSheet";

/**
 * The phone's nav. Below `md` the rail is hidden and four tabs sit at the
 * bottom, with labels under the icons — there is no hover on a touch screen.
 *
 * Dashboard, Agents and Labs are the rail's doors (`RAIL_TOP` in `lib/nav`).
 * Account is the rail's avatar: it opens a sheet with the name and role, then
 * Account, Settings and Logout (see `AccountSheet`). A red dot on it means the
 * selected server is offline. The Account tab is fixed: it is the only home
 * for Account, Settings and Logout on a phone. The Account row opens the shared
 * `AccountDialog` after the sheet has closed (one layer at a time on a small
 * screen); closing the dialog puts focus back on this tab.
 */
export function MobileTabBar({ onReport }: { onReport: () => void }) {
  const { pathname, search } = useLocation();
  const name = useDisplayName();
  const { current } = useServerRoster();
  const serverOffline = !!current && !current.online;
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountDialog, setAccountDialog] = useState(false);
  const [tab, setTab] = useState<HTMLButtonElement | null>(null);
  // Same rule as the rail (`isRailItemLit`): while the sheet is open only Account
  // is lit; with it closed the route decides, and a Settings page is one of the
  // sheet's lists, so it lights Account.
  const overlay: RailOverlayId | null = accountOpen ? "account" : null;
  const accountActive = accountOpen || isSettingsActive(pathname);

  return (
    <>
      <nav
        aria-label="Primary"
        className="flex h-14 shrink-0 items-stretch border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {RAIL_TOP.map((item) => {
          const active = isRailItemLit(item.id, overlay, pathname, search);
          return (
            <Link
              key={item.id}
              to={item.to}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => setAccountOpen(false)}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-md ${
                  active
                    ? "bg-[var(--color-nav-active)] text-[var(--on-nav-active)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                <item.icon className="h-5 w-5" />
              </span>
              <span
                className={`truncate text-[10px] font-medium ${
                  active ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          ref={setTab}
          type="button"
          aria-label={name}
          aria-expanded={accountOpen}
          aria-haspopup="dialog"
          aria-current={accountActive && !accountOpen ? "page" : undefined}
          onClick={() => setAccountOpen((open) => !open)}
          className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary-fill)] text-[10px] font-bold text-[var(--on-primary)] ${
              accountActive ? "ring-2 ring-[var(--color-primary)]" : ""
            }`}
          >
            {initialsFrom(name)}
          </span>
          {serverOffline && (
            <span
              className="absolute right-[calc(50%-18px)] top-1 h-2.5 w-2.5 rounded-full border border-[var(--color-surface)] bg-[var(--color-red)]"
              aria-label="Server offline"
            />
          )}
          <span
            className={`truncate text-[10px] font-medium ${
              accountActive ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
            }`}
          >
            Account
          </span>
        </button>
      </nav>

      <AccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onReport={onReport}
        onAccount={() => setAccountDialog(true)}
      />
      <AccountDialog open={accountDialog} onOpenChange={setAccountDialog} returnFocusTo={tab} />
    </>
  );
}
