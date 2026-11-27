import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { initialsFrom, useDisplayName } from "@/hooks/useDisplayName";
import { useServerRoster } from "@/hooks/useServerRoster";
import { MORE_ICON, RAIL_TOP, isRailEntryActive } from "@/lib/nav";
import { AccountMenu } from "./AccountMenu";
import { MoreMenu } from "./MoreMenu";

/**
 * Drop the Account tab (and its sheet) by setting this to false. It is the
 * rail's avatar: the only place on a phone that shows who is signed in and
 * holds Logout. Kept until the product owner decides whether a phone needs it.
 */
const SHOW_ACCOUNT_TAB = true;

/**
 * The phone's nav. Below `md` the rail is hidden and its doors sit at the
 * bottom, with labels under the icons — there is no hover on a touch screen.
 * The doors and the More list come from `lib/nav`, the same source as the
 * rail. More opens a sheet; so does Account (name, role, Logout), where a red
 * dot means the selected server is offline.
 */
export function MobileTabBar({ onReport }: { onReport: () => void }) {
  const { pathname, search } = useLocation();
  const name = useDisplayName();
  const { current } = useServerRoster();
  const serverOffline = !!current && !current.online;
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const MoreIcon = MORE_ICON;
  const moreActive = isRailEntryActive("more", pathname, search);

  const close = () => {
    setMoreOpen(false);
    setAccountOpen(false);
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="flex h-14 shrink-0 items-stretch border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {RAIL_TOP.map((item) => {
          const active = isRailEntryActive(item.id, pathname, search);
          return (
            <Link
              key={item.id}
              to={item.to}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={close}
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
          type="button"
          aria-label="More"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          aria-current={moreActive ? "page" : undefined}
          onClick={() => {
            setAccountOpen(false);
            setMoreOpen((open) => !open);
          }}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md ${
              moreActive || moreOpen
                ? "bg-[var(--color-nav-active)] text-[var(--on-nav-active)]"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            <MoreIcon className="h-5 w-5" />
          </span>
          <span
            className={`text-[10px] font-medium ${
              moreActive ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
            }`}
          >
            More
          </span>
        </button>

        {SHOW_ACCOUNT_TAB && (
          <button
            type="button"
            aria-label={name}
            aria-expanded={accountOpen}
            aria-haspopup="dialog"
            onClick={() => {
              setMoreOpen(false);
              setAccountOpen((open) => !open);
            }}
            className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary-fill)] text-[10px] font-bold text-[var(--on-primary)] ${
                accountOpen ? "ring-2 ring-[var(--color-primary)]" : ""
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
            <span className="truncate text-[10px] font-medium text-[var(--color-text-muted)]">
              Account
            </span>
          </button>
        )}
      </nav>

      <MoreMenu
        variant="sheet"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onReport={onReport}
      />
      {SHOW_ACCOUNT_TAB && (
        <AccountMenu
          variant="sheet"
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
        />
      )}
    </>
  );
}
