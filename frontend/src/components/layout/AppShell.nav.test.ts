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
  SETTINGS_ITEMS,
  isAgentsActive,
  isDashboardActive,
  isLabsActive,
  isMoreActive,
  isMoreEntryActive,
  isRailEntryActive,
  isRailItemLit,
  isSettingsActive,
  isSettingsEntryActive,
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

  it("has exactly five Settings tabs behind the gear, none of them in More", () => {
    expect(SETTINGS_ITEMS.map((item) => item.label)).toEqual([
      "Agents",
      "LLM Endpoints",
      "Voice & AI",
      "Appearance",
      "Privacy",
    ]);
    const more = new Set(MORE_ITEMS.map((item) => item.to));
    expect(SETTINGS_ITEMS.some((item) => more.has(item.to))).toBe(false);
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

  it("lights More on its own tabs, and Servers when no tab is given", () => {
    expect(isMoreActive("/settings", "")).toBe(true);
    expect(isMoreActive("/settings", "?tab=keys")).toBe(true);
    expect(isMoreActive("/settings", "?tab=appearance")).toBe(false);
    expect(isMoreActive("/portfolio", "?tab=keys")).toBe(false);
    expect(isRailEntryActive("more", "/settings", "?tab=updates")).toBe(true);
  });

  it("lights Settings on every other Settings tab, never both together", () => {
    for (const tab of ["agents", "llm", "voice", "appearance", "privacy", "notifications", "admin"]) {
      expect(isSettingsActive("/settings", `?tab=${tab}`)).toBe(true);
      expect(isMoreActive("/settings", `?tab=${tab}`)).toBe(false);
    }
    expect(isSettingsActive("/settings", "")).toBe(false);
    expect(isSettingsActive("/hub", "?tab=privacy")).toBe(false);
    const privacy = SETTINGS_ITEMS.find((i) => i.id === "set-privacy")!;
    expect(isSettingsEntryActive(privacy, "/settings", "?tab=privacy")).toBe(true);
    expect(isSettingsEntryActive(privacy, "/settings", "?tab=voice")).toBe(false);
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

describe("lit state with an overlay open", () => {
  it("lights only the opener, whatever the route", () => {
    expect(isRailItemLit("dashboard", "more", "/", "")).toBe(false);
    expect(isRailItemLit("more", "more", "/", "")).toBe(true);
    expect(isRailItemLit("settings", "more", "/settings", "?tab=voice")).toBe(false);
    expect(isRailItemLit("settings", "settings", "/", "")).toBe(true);
    expect(isRailItemLit("account", "account", "/", "")).toBe(true);
    expect(isRailItemLit("agents", "account", "/hub", "")).toBe(false);
  });

  it("follows the route when nothing is open", () => {
    expect(isRailItemLit("dashboard", null, "/", "")).toBe(true);
    expect(isRailItemLit("agents", null, "/hub", "")).toBe(true);
    expect(isRailItemLit("more", null, "/settings", "?tab=keys")).toBe(true);
    expect(isRailItemLit("settings", null, "/settings", "?tab=privacy")).toBe(true);
  });
});
