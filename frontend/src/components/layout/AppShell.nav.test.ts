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
  RAIL_BOTTOM,
  RAIL_TOP,
  isBotsActive,
  isDashboardActive,
  isMoreActive,
  isRailEntryActive,
  isSettingsActive,
  isStrategiesActive,
} from "@/lib/nav";

const destinations = [...RAIL_TOP, ...RAIL_BOTTOM, ...MORE_ITEMS];

describe("the nav", () => {
  it("has neither a fleet nor a floor entry: both are somebody else's report now", () => {
    const paths = destinations.map((item) => item.to);
    expect(paths).not.toContain("/fleet");
    expect(paths).not.toContain("/floor");
    expect(paths).toContain("/bots");
  });

  it("keeps Agent Hub under More, not as a twin of Dashboard", () => {
    // FEAT-153 took `/hub` out of the nav. It comes back under More: a second
    // door, Carlito's override of that one-door rule. The rail itself still
    // does not list it beside Dashboard.
    expect(RAIL_TOP.map((item) => item.to)).not.toContain("/hub");
    expect(MORE_ITEMS.map((item) => item.to)).toContain("/hub");
  });

  it("parks Portfolio, Trade, DEX and Routines under More", () => {
    const more = MORE_ITEMS.map((item) => item.to);
    expect(more).toEqual(["/portfolio", "/trade", "/dex", "/routines", "/hub"]);
    expect(RAIL_TOP.map((item) => item.label)).toEqual(["Dashboard", "Bots", "Strategies"]);
  });

  it("gives every entry a distinct address and label", () => {
    expect(new Set(destinations.map((i) => i.to)).size).toBe(destinations.length);
    expect(new Set(destinations.map((i) => i.label)).size).toBe(destinations.length);
  });
});

describe("active state", () => {
  it("lights Dashboard on the chat home, the Hub and an agent workspace", () => {
    expect(isDashboardActive("/")).toBe(true);
    expect(isDashboardActive("/hub")).toBe(true);
    expect(isDashboardActive("/agents/alpha")).toBe(true);
    expect(isDashboardActive("/bots")).toBe(false);
    expect(isDashboardActive("/agents")).toBe(false);
  });

  it("lights Bots on the browser and on a bot detail", () => {
    expect(isBotsActive("/bots")).toBe(true);
    expect(isBotsActive("/bots/grid-1")).toBe(true);
    expect(isBotsActive("/bot")).toBe(false);
  });

  it("lights Strategies on the loops panel and on /strategies", () => {
    expect(isStrategiesActive("/", "?panel=loops")).toBe(true);
    expect(isStrategiesActive("/", "")).toBe(false);
    expect(isStrategiesActive("/strategies", "")).toBe(true);
    expect(isStrategiesActive("/portfolio", "?panel=loops")).toBe(false);
  });

  it("lights More when the page is one of its entries, including a pool", () => {
    expect(isMoreActive("/portfolio")).toBe(true);
    expect(isMoreActive("/trade")).toBe(true);
    expect(isMoreActive("/dex")).toBe(true);
    expect(isMoreActive("/dex/solana/pool")).toBe(true);
    expect(isMoreActive("/routines")).toBe(true);
    expect(isMoreActive("/hub")).toBe(true);
    expect(isMoreActive("/bots")).toBe(false);
    expect(isMoreActive("/")).toBe(false);
  });

  it("lights Settings on the settings page only", () => {
    expect(isSettingsActive("/settings")).toBe(true);
    expect(isSettingsActive("/settings/extra")).toBe(true);
    expect(isRailEntryActive("more", "/settings", "")).toBe(false);
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
