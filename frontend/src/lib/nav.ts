import {
  Bot,
  Brain,
  Droplets,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  Swords,
  Wallet,
  Workflow,
  Zap,
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
 * The top bar is a left icon rail now. Dashboard is the chat home (lit on
 * `/hub` and `/agents/*` as Agents used to be). Portfolio, Trade, DEX and
 * Routines sit under More until those pages are redesigned. Agent Hub is
 * under More too: a second door, which overrides the FEAT-153 one-door rule
 * on purpose. Strategies points at the cross-agent loops panel
 * (`/?panel=loops`) until `/strategies` is its own page.
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
  { id: "bots", to: "/bots", icon: Bot, label: "Bots" },
  { id: "strategies", to: "/?panel=loops", icon: Workflow, label: "Strategies" },
];

/** The ⋯ menu. No route of its own; it lights when the page is one of these. */
export const MORE_ITEMS: readonly NavEntry[] = [
  { id: "portfolio", to: "/portfolio", icon: Wallet, label: "Portfolio" },
  { id: "trade", to: "/trade", icon: Swords, label: "Trade" },
  { id: "dex", to: "/dex", icon: Droplets, label: "DEX" },
  { id: "routines", to: "/routines", icon: Zap, label: "Routines" },
  { id: "hub", to: "/hub", icon: Brain, label: "Agent Hub" },
];

export const MORE_ICON = MoreHorizontal;

/** Rail, bottom group, besides the bell and the avatar (those are controls, not routes). */
export const RAIL_BOTTOM: readonly NavEntry[] = [
  { id: "settings", to: "/settings", icon: Settings, label: "Settings" },
];

/** The chat home, and the two pages that are still that home with a different column. */
export function isDashboardActive(pathname: string): boolean {
  return pathname === "/" || pathname === "/hub" || pathname.startsWith("/agents/");
}

export function isBotsActive(pathname: string): boolean {
  return pathname === "/bots" || pathname.startsWith("/bots/");
}

/**
 * The strategies door. `/strategies` once that page exists; until then the
 * bookmarked loops panel on the home (`?panel=loops`).
 */
export function isStrategiesActive(pathname: string, search: string): boolean {
  if (pathname === "/strategies" || pathname.startsWith("/strategies/")) return true;
  return pathname === "/" && new URLSearchParams(search).get("panel") === "loops";
}

export function isSettingsActive(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

function matchesEntry(pathname: string, to: string): boolean {
  if (to === "/dex") return pathname === "/dex" || pathname.startsWith("/dex/");
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** True when the page is one of the More menu's routes, so the ⋯ stays lit. */
export function isMoreActive(pathname: string): boolean {
  return MORE_ITEMS.some((item) => matchesEntry(pathname, item.to));
}

export function isRailEntryActive(id: string, pathname: string, search: string): boolean {
  switch (id) {
    case "dashboard":
      return isDashboardActive(pathname);
    case "bots":
      return isBotsActive(pathname);
    case "strategies":
      return isStrategiesActive(pathname, search);
    case "settings":
      return isSettingsActive(pathname);
    case "more":
      return isMoreActive(pathname);
    default: {
      const parked = MORE_ITEMS.find((entry) => entry.id === id);
      return parked ? matchesEntry(pathname, parked.to) : false;
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
