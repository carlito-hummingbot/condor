import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { Tooltip } from "@/components/ui/Tooltip";
import { initialsFrom, useDashboardTitle, useDisplayName } from "@/hooks/useDisplayName";
import { useGatewayStatus } from "@/hooks/useGatewayStatus";
import { useServer } from "@/hooks/useServer";
import {
  MORE_ICON,
  RAIL_BOTTOM,
  RAIL_TOP,
  isRailEntryActive,
  type NavEntry,
} from "@/lib/nav";
import { AccountMenu } from "./AccountMenu";
import { MoreMenu } from "./MoreMenu";
import { NotificationBell } from "./NotificationBell";
import { useServerRoster } from "@/hooks/useServerRoster";

/**
 * The 64px rail that replaces the top bar.
 *
 * Every door shows its name under the icon (10px, like the panel rail on the
 * right), so nothing depends on a hover. The logo and the avatar have no text
 * label and keep a tooltip. The avatar opens the account menu; a red dot on it
 * means the selected server is offline, and a red dot on Settings means
 * Gateway is down.
 */
function itemClass(active: boolean): string {
  return `flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-md transition-colors ${
    active
      ? "bg-[var(--color-nav-active)] text-[var(--on-nav-active)]"
      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
  }`;
}

function RailLink({ item }: { item: NavEntry }) {
  const { pathname, search } = useLocation();
  const active = isRailEntryActive(item.id, pathname, search);
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={itemClass(active)}
    >
      <item.icon className="h-5 w-5" />
      <span className="text-[10px] font-medium leading-none">{item.label}</span>
    </Link>
  );
}

export function SideRail({ onReport }: { onReport: () => void }) {
  const { pathname, search } = useLocation();
  const title = useDashboardTitle();
  const name = useDisplayName();
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const moreActive = isRailEntryActive("more", pathname, search);
  const MoreIcon = MORE_ICON;
  // Keeps a deleted server from staying selected while the menu is closed.
  const { current } = useServerRoster();
  const { server } = useServer();
  const gateway = useGatewayStatus(server);
  const gatewayDown = gateway.known && !gateway.running;
  const serverOffline = !!current && !current.online;

  return (
    <nav
      aria-label="Primary"
      className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-[var(--color-border)] bg-[var(--color-surface)] py-2"
    >
      <Tooltip label={title}>
        <Link to="/" aria-label={title} className="mb-1 flex h-10 w-10 items-center justify-center rounded-md">
          <img src="/condor_old.jpeg" alt="" className="h-7 w-7 rounded-full" />
        </Link>
      </Tooltip>

      {RAIL_TOP.map((item) => (
        <RailLink key={item.id} item={item} />
      ))}

      <button
        ref={setMoreAnchor}
        type="button"
        aria-expanded={moreOpen}
        aria-haspopup="menu"
        aria-current={moreActive ? "page" : undefined}
        onClick={() => setMoreOpen((open) => !open)}
        className={itemClass(moreActive || moreOpen)}
      >
        <MoreIcon className="h-5 w-5" />
        <span className="text-[10px] font-medium leading-none">More</span>
      </button>

      <div className="flex-1" />

      <NotificationBell rail align="left" />

      {RAIL_BOTTOM.map((item) => (
        <span key={item.id} className="relative inline-flex">
          <RailLink item={item} />
          {item.id === "settings" && gatewayDown && (
            <span
              className="pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--color-red)]"
              aria-hidden
            />
          )}
        </span>
      ))}

      <Tooltip label={name}>
        <button
          ref={setAccountAnchor}
          type="button"
          aria-label={name}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          onClick={() => setAccountOpen((open) => !open)}
          className={`relative mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-fill)] text-[11px] font-bold text-[var(--on-primary)] ${
            accountOpen ? "ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-surface)]" : ""
          }`}
        >
          {initialsFrom(name)}
          {serverOffline && (
            <span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-[var(--color-surface)] bg-[var(--color-red)]"
              aria-label="Server offline"
            />
          )}
        </button>
      </Tooltip>

      <MoreMenu
        anchor={moreAnchor}
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onReport={onReport}
      />
      <AccountMenu
        anchor={accountAnchor}
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </nav>
  );
}
