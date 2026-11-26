import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { initialsFrom, useDisplayName } from "@/hooks/useDisplayName";
import { NOTIFICATIONS_KEY } from "@/hooks/useChatSocket";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MORE_ICON, RAIL_TOP, isRailEntryActive } from "@/lib/nav";
import { AccountMenu } from "./AccountMenu";
import { MoreMenu } from "./MoreMenu";

/**
 * The phone's nav. Below `md` the rail is hidden and these five tabs sit at
 * the bottom, with labels under the icons — there is no hover on a touch
 * screen. More and the avatar open as sheets. Settings and the bell live in
 * the avatar sheet; the unread count stays on the avatar tab.
 */
export function MobileTabBar({ onReport }: { onReport: () => void }) {
  const { pathname, search } = useLocation();
  const name = useDisplayName();
  const { token } = useAuth();
  const { data } = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => api.getNotifications(50),
    enabled: !!token,
    staleTime: 60_000,
  });
  const unread = data?.unread ?? 0;
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
          {unread > 0 && (
            <span className="absolute right-[calc(50%-18px)] top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--color-red)] px-1 text-[9px] font-bold leading-none text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <span className="truncate text-[10px] font-medium text-[var(--color-text-muted)]">
            Account
          </span>
        </button>
      </nav>

      <MoreMenu
        variant="sheet"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onReport={onReport}
      />
      <AccountMenu
        variant="sheet"
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </>
  );
}
