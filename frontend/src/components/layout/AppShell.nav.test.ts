/**
 * The shell's lists, as contract rather than as markup.
 *
 * A page is only reachable if the rail or the More menu names it, and it only
 * lays itself out correctly if the shell knows it is full bleed. Read directly:
 * they are data. `/fleet` is the case that shows why a door onto a redirect is
 * not a door — it lost its page in FEAT-114.
 *
 * Both live in `lib/nav` rather than beside the shell that renders them: a
 * module may not export a component and plain data both (the lint gate's
 * `react-refresh/only-export-components`).
 */

import { describe, expect, it } from "vitest";

import {
  FULL_BLEED_ROUTES,
  MORE_ITEMS,
  RAIL_TOP,
  isAgentsActive,
  isDashboardActive,
  isLabsActive,
  isMoreActive,
  isMoreEntryActive,
  isRailEntryActive,
} from "@/lib/nav";

const destinations = [...RAIL_TOP, ...MORE_ITEMS];

describe("the nav", () => {
  it("has neither a fleet nor a floor entry: both are somebody else's report now", () => {
    const paths = destinations.map((item) => item.to);
    expect(paths).not.toContain("/fleet");
    expect(paths).not.toContain("/floor");
  });

  it("has exactly Dashboard, Agents and Labs on the rail", () => {
    expect(RAIL_TOP.map((item) => item.label)).toEqual(["Dashboard", "Agents", "Labs"]);
    expect(RAIL_TOP.map((item) => item.to)).toEqual(["/", "/hub", "/labs"]);
  });

  it("has exactly five Settings tabs under More, before Report an Issue", () => {
    expect(MORE_ITEMS.map((item) => item.label)).toEqual([
      "Hummingbot API",
      "Gateway",
      "Keys and Wallets",
      "Servers",
      "Updates",
    ]);
    expect(MORE_ITEMS.every((item) => item.to.startsWith("/settings?tab="))).toBe(true);
  });

  it("gives every entry a distinct address and label", () => {
    expect(new Set(destinations.map((i) => i.to)).size).toBe(destinations.length);
    expect(new Set(destinations.map((i) => i.label)).size).toBe(destinations.length);
  });
});

describe("active state", () => {
  it("lights Dashboard on the home only", () => {
    expect(isDashboardActive("/")).toBe(true);
    expect(isDashboardActive("/hub")).toBe(false);
    expect(isDashboardActive("/agents/alpha")).toBe(false);
    expect(isDashboardActive("/labs")).toBe(false);
  });

  it("lights Agents on the Hub and on an agent workspace", () => {
    expect(isAgentsActive("/hub")).toBe(true);
    expect(isAgentsActive("/agents/alpha")).toBe(true);
    expect(isAgentsActive("/agents")).toBe(false);
    expect(isAgentsActive("/bots")).toBe(false);
  });

  it("lights Labs on /labs and below it", () => {
    expect(isLabsActive("/labs")).toBe(true);
    expect(isLabsActive("/labs/new")).toBe(true);
    expect(isLabsActive("/laboratory")).toBe(false);
  });

  it("lights More on every Settings page", () => {
    expect(isMoreActive("/settings")).toBe(true);
    expect(isMoreActive("/settings/extra")).toBe(true);
    expect(isMoreActive("/portfolio")).toBe(false);
    expect(isRailEntryActive("more", "/settings", "?tab=keys")).toBe(true);
  });

  it("lights the More entry whose tab is open, and Servers when no tab is given", () => {
    const keys = MORE_ITEMS.find((i) => i.id === "keys")!;
    const servers = MORE_ITEMS.find((i) => i.id === "servers")!;
    expect(isMoreEntryActive(keys, "/settings", "?tab=keys")).toBe(true);
    expect(isMoreEntryActive(keys, "/settings", "?tab=gateway")).toBe(false);
    expect(isMoreEntryActive(servers, "/settings", "")).toBe(true);
    expect(isMoreEntryActive(servers, "/", "?tab=servers")).toBe(false);
  });
});

describe("full bleed", () => {
  it("includes the browser, a scope sidebar beside a report column", () => {
    expect(FULL_BLEED_ROUTES).toContain("/bots");
    expect(FULL_BLEED_ROUTES as readonly string[]).not.toContain("/floor");
  });

  it("includes the home, which scrolls its own transcript", () => {
    expect(FULL_BLEED_ROUTES).toContain("/");
    expect(FULL_BLEED_ROUTES as readonly string[]).not.toContain("/fleet");
  });
});
