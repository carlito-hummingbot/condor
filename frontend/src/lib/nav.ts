import {
  Bot,
  Bug,
  Download,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  Network,
  Server,
  ServerCog,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * The main nav.
 *
 * Routines left it in FEAT-077 and came back in FEAT-091: the library still
 * opens beside the conversation that wants it and from an agent's own page, but
 * plenty of work starts at the library rather than at a chat, and for that the
 * nav was the only door. `/routines` is now the same full-screen browser those
 * two surfaces open, at full width.
 *
 * Executors left it in FEAT-086, for a different reason: they are not a
 * separate thing to look at. A controller is a bag of executors, so both are
 * scopes of the one browser behind Bots, and two doors to one report was the
 * problem that feature exists to fix.
 *
 * Fleet left it in FEAT-114, for the same reason one level up. *What is every
 * agent doing* is now the Execution panel of the chat's right rail, read owner
 * first — beside the conversation it is asked in, rather than a tab away from
 * it — so the nav loses an entry and the reader loses nothing. `/fleet`
 * redirects to that panel's own address.
 *
 * Floor left it in FEAT-116, for the reason Executors left it. *What does the
 * fleet add up to* is the report the browser behind Bots already draws — at its
 * own root, split by the level below it — so the floor is the fleet scope of
 * that browser rather than a second door onto the same records. `/floor`
 * redirects to `/bots`.
 *
 * Hub joined it in FEAT-153 and left it again. `/hub` mounts the Agents
 * workspace with its transcript column swapped for the catalogue, so a tab of
 * its own sat beside Agents saying the same thing twice. Its door was the card
 * at the foot of the Agents rail.
 *
 * The top bar is a left icon rail now, with four doors: Dashboard, Agents,
 * Labs and More. Dashboard is `/` (the chat home until the stats page lands).
 * Agents is `/hub`, the Agents workspace, and stays lit on an agent's own
 * page. Labs is `/labs`, a placeholder page for now (Design, Backtest and
 * Test Run come later); `/strategies` redirects to it. More is the gear at the foot of
 * the rail and opens the Settings tabs people reach for most. Portfolio,
 * Trade, DEX, Routines and Bots have no door in the nav for now; their routes
 * still work by address.
 */
export interface NavEntry {
  id: string;
  to: string;
  icon: LucideIcon;
  label: string;
}

/** Rail, top group. The logo is not an entry: it is the brand, and it never lights. */
export const RAIL_TOP: readonly NavEntry[] = [
  { id: "dashboard", to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { id: "agents", to: "/hub", icon: Bot, label: "Agents" },
  { id: "labs", to: "/labs", icon: FlaskConical, label: "Labs" },
];

/**
 * The More menu: Settings tabs, in the order a person reaches for them. Each
 * `to` is a Settings tab (`/settings?tab=...`). Report an Issue is last and is
 * not a route: it opens the existing dialog.
 */
export const MORE_ITEMS: readonly NavEntry[] = [
  { id: "api", to: "/settings?tab=api", icon: ServerCog, label: "Hummingbot API" },
  { id: "gateway", to: "/settings?tab=gateway", icon: Network, label: "Gateway" },
  { id: "keys", to: "/settings?tab=keys", icon: KeyRound, label: "Keys and Wallets" },
  { id: "servers", to: "/settings?tab=servers", icon: Server, label: "Servers" },
  { id: "updates", to: "/settings?tab=updates", icon: Download, label: "Updates" },
];

export const REPORT_ISSUE = { label: "Report an Issue", icon: Bug } as const;

/** The gear at the foot of the rail. It opens the More menu; it is not a link. */
export const MORE_ICON = Settings;

/** The chat home only. The Hub and an agent's page belong to Agents now. */
export function isDashboardActive(pathname: string): boolean {
  return pathname === "/";
}

/** The Agents workspace: the Hub, and a single agent's page. */
export function isAgentsActive(pathname: string): boolean {
  return pathname === "/hub" || pathname.startsWith("/agents/");
}

export function isLabsActive(pathname: string): boolean {
  return pathname === "/labs" || pathname.startsWith("/labs/");
}

/** True on any Settings page, so the gear stays lit while More's pages are open. */
export function isMoreActive(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

/** The More entry whose Settings tab is on screen. `/settings` alone opens Servers. */
export function isMoreEntryActive(entry: NavEntry, pathname: string, search: string): boolean {
  if (!isMoreActive(pathname)) return false;
  const want = new URL(entry.to, "http://x").searchParams.get("tab");
  const have = new URLSearchParams(search).get("tab") ?? "servers";
  return want === have;
}

export function isRailEntryActive(id: string, pathname: string, search: string): boolean {
  switch (id) {
    case "dashboard":
      return isDashboardActive(pathname);
    case "agents":
      return isAgentsActive(pathname);
    case "labs":
      return isLabsActive(pathname);
    case "more":
      return isMoreActive(pathname);
    default: {
      const entry = MORE_ITEMS.find((item) => item.id === id);
      return entry ? isMoreEntryActive(entry, pathname, search) : false;
    }
  }
}

/**
 * Routes that lay themselves out edge to edge and scroll inside their own panes,
 * so `main` gives them no padding and no scrollbar of its own.
 *
 * `/bots` joined the chat workspace when the controller browser became the page
 * (FEAT-084): a scope sidebar and a report column, both screen-tall, have
 * nothing to do with `main`'s 24px. `/routines` is the same shape, for the same
 * reason (FEAT-091).
 *
 * `/` left this list for the length of FEAT-104, when it mounted two screens
 * under one path and the answer had to be read off the query string. The home
 * is the conversation again — a pathname with one body owning the viewport,
 * scrolling its own transcript — and the fleet overview it briefly shared the
 * route with is a panel of that conversation's rail now (FEAT-114).
 *
 * `/floor` was full bleed for its own two-part layout (FEAT-112) and is not a
 * route with a body any more (FEAT-116): a layout rule for it would be a rule
 * about a redirect. What it used to draw is `/bots`, which is on this list.
 */
export const FULL_BLEED_ROUTES = ["/", "/hub", "/bots", "/routines"];
