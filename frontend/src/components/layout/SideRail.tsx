import { useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { Tooltip } from "@/components/ui/Tooltip";
import { initialsFrom, useDashboardTitle, useDisplayName } from "@/hooks/useDisplayName";
import {
  MORE_ICON,
  RAIL_TOP,
  SETTINGS_ICON,
  isRailItemLit,
  type NavEntry,
  type RailOverlayId,
  type RailPanelId,
} from "@/lib/nav";
import { useServerRoster } from "@/hooks/useServerRoster";
import { AccountDialog } from "./AccountDialog";
import { AccountMenu } from "./AccountMenu";
import { RailPanel } from "./RailPanel";

/**
 * The 64px rail that replaces the top bar.
 *
 * Every door shows its name under the icon (10px, like the panel rail on the
 * right), so nothing depends on a hover. The logo and the avatar are the two
 * items without a text label and keep a tooltip. The avatar opens the account
 * menu (name, role, Logout); a red dot on it means the selected server is
 * offline. The account menu is the third overlay: it and the panel are never
 * open together, and while it is open only the avatar is lit.
 *
 * Dashboard, Agents, Labs and More (three dots) on top. The Settings gear and
 * the avatar sit at the foot. More and Settings open one panel beside the
 * rail (`RailPanel`) with their own list. There is no bell in the rail.
 */
function itemClass(active: boolean): string {
  return `flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-md transition-colors ${
    active
      ? "bg-[var(--color-nav-active)] text-[var(--on-nav-active)]"
      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
  }`;
}

function RailLink({ item, overlay }: { item: NavEntry; overlay: RailOverlayId | null }) {
  const { pathname, search } = useLocation();
  const active = isRailItemLit(item.id, overlay, pathname, search);
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
  // The one open overlay (see `RailOverlayId`). While it is set, only its
  // opener is lit.
  const [overlay, setOverlay] = useState<RailOverlayId | null>(null);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const accountOpen = overlay === "account";
  // The Account dialog is a modal above the rail, not an overlay of it: it
  // never touches `overlay`, and the menu that opens it has closed already.
  const [accountDialog, setAccountDialog] = useState(false);
  // Also keeps a deleted server from staying selected while the menu is closed.
  const { current } = useServerRoster();
  const serverOffline = !!current && !current.online;
  const panel: RailPanelId | null = overlay === "more" || overlay === "settings" ? overlay : null;
  const panelId = useId();
  const moreRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const buttons = { more: moreRef, settings: settingsRef };
  const toggle = (id: RailOverlayId) => setOverlay((open) => (open === id ? null : id));
  const close = (restoreFocus: boolean) => {
    const was = panel;
    setOverlay(null);
    if (restoreFocus && was) buttons[was].current?.focus();
  };
  const moreLit = isRailItemLit("more", overlay, pathname, search);
  const settingsLit = isRailItemLit("settings", overlay, pathname, search);
  const MoreIcon = MORE_ICON;
  const SettingsIcon = SETTINGS_ICON;

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
        <RailLink key={item.id} item={item} overlay={overlay} />
      ))}

      <Tooltip label="More">
        <button
          ref={moreRef}
          type="button"
          aria-expanded={panel === "more"}
          aria-controls={panel === "more" ? panelId : undefined}
          aria-haspopup="menu"
          aria-current={moreLit && overlay === null ? "page" : undefined}
          onClick={() => toggle("more")}
          className={itemClass(moreLit)}
        >
          <MoreIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </Tooltip>

      <div className="flex-1" />

      <Tooltip label="Settings">
        <button
          ref={settingsRef}
          type="button"
          aria-expanded={panel === "settings"}
          aria-controls={panel === "settings" ? panelId : undefined}
          aria-haspopup="menu"
          aria-current={settingsLit && overlay === null ? "page" : undefined}
          onClick={() => toggle("settings")}
          className={itemClass(settingsLit)}
        >
          <SettingsIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Settings</span>
        </button>
      </Tooltip>

      <Tooltip label={name}>
        <button
          ref={setAccountAnchor}
          type="button"
          aria-label={name}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          onClick={() => toggle("account")}
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

      <RailPanel
        panel={panel}
        id={panelId}
        buttons={buttons}
        onClose={close}
        onReport={onReport}
      />
      <AccountMenu
        anchor={accountAnchor}
        open={accountOpen}
        onClose={() => setOverlay(null)}
        onAccount={() => setAccountDialog(true)}
      />
      <AccountDialog
        open={accountDialog}
        onOpenChange={setAccountDialog}
        returnFocusTo={accountAnchor}
      />
    </nav>
  );
}
