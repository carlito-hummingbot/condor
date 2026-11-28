/**
 * The shell's lists, as contract rather than as markup.
 *
 * A page is only reachable if the rail or the Settings panel names it, and it
 * only lays itself out correctly if the shell knows it is full bleed. Read
 * directly: they are data. `/fleet` is the case that shows why a door onto a
 * redirect is not a door — it lost its page in FEAT-114.
 *
 * Both live in `lib/nav` rather than beside the shell that renders them: a
 * module may not export a component and plain data both (the lint gate's
 * `react-refresh/only-export-components`).
 */

import { describe, expect, it } from "vitest";

import {
  FULL_BLEED_ROUTES,
  RAIL_TOP,
  REPORT_ISSUE,
  SETTINGS_ENTRIES,
  SETTINGS_GROUPS,
  isExploreActive,
  isDashboardActive,
  isBuildActive,
  isRailEntryActive,
  isRailItemLit,
  isReportEntry,
  isSettingsActive,
  isSettingsEntryActive,
} from "@/lib/nav";

const destinations = [...RAIL_TOP, ...SETTINGS_ENTRIES];

describe("the nav", () => {
  it("has neither a fleet nor a floor entry: both are somebody else's report now", () => {
    const paths = destinations.map((item) => item.to);
    expect(paths).not.toContain("/fleet");
    expect(paths).not.toContain("/floor");
  });

  it("has exactly Dashboard, Explore and Build on the rail, and no More", () => {
    expect(RAIL_TOP.map((item) => item.label)).toEqual(["Dashboard", "Explore", "Build"]);
    expect(RAIL_TOP.map((item) => item.to)).toEqual(["/", "/explore", "/build"]);
  });

  it("has the Settings panel in three groups, in this order", () => {
    expect(SETTINGS_GROUPS.map((g) => g.map((e) => e.label))).toEqual([
      ["Hummingbot API", "Gateway", "Keys and Wallets", "Servers", "Updates"],
      ["Agents", "LLM Endpoints", "Voice & AI", "Appearance", "Privacy"],
      ["Report an Issue"],
    ]);
  });

  it("points every Settings row at its tab, and Report an Issue at a dialog", () => {
    expect(SETTINGS_ENTRIES.map((e) => e.to)).toEqual([
      "/settings?tab=api",
      "/settings?tab=gateway",
      "/settings?tab=keys",
      "/settings?tab=servers",
      "/settings?tab=updates",
      "/settings?tab=agents",
      "/settings?tab=llm",
      "/settings?tab=voice",
      "/settings?tab=appearance",
      "/settings?tab=privacy",
    ]);
    const last = SETTINGS_GROUPS[2][0];
    expect(last).toBe(REPORT_ISSUE);
    expect(isReportEntry(last)).toBe(true);
    expect(SETTINGS_ENTRIES).not.toContain(REPORT_ISSUE);
  });

  it("gives every entry a distinct address, id and label", () => {
    expect(new Set(destinations.map((i) => i.to)).size).toBe(destinations.length);
    const all = [...RAIL_TOP, ...SETTINGS_GROUPS.flat()];
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    // "Agents" is only the Settings row now; the rail door is Explore.
    expect(all.filter((i) => i.label === "Agents")).toHaveLength(1);
    expect(all.filter((i) => i.label === "Explore")).toHaveLength(1);
  });
});

describe("active state", () => {
  it("lights Dashboard on the home only", () => {
    expect(isDashboardActive("/")).toBe(true);
    expect(isDashboardActive("/hub")).toBe(false);
    expect(isDashboardActive("/agents/alpha")).toBe(false);
    expect(isDashboardActive("/build")).toBe(false);
  });

  it("lights Explore on /explore, not on the old Hub or the chat", () => {
    expect(isExploreActive("/explore")).toBe(true);
    expect(isExploreActive("/hub")).toBe(false);
    expect(isExploreActive("/chat")).toBe(false);
    expect(isExploreActive("/agents/alpha")).toBe(false);
    expect(isExploreActive("/agents")).toBe(false);
    expect(isExploreActive("/bots")).toBe(false);
  });

  it("lights Build on /build and below it, and not on the old addresses", () => {
    expect(isBuildActive("/build")).toBe(true);
    expect(isBuildActive("/build/design")).toBe(true);
    expect(isBuildActive("/labs")).toBe(false);
    expect(isBuildActive("/builder")).toBe(false);
  });

  it("lights Settings on every Settings page, whatever the tab", () => {
    for (const tab of [
      "api",
      "gateway",
      "keys",
      "servers",
      "updates",
      "agents",
      "llm",
      "voice",
      "appearance",
      "privacy",
      "notifications",
      "admin",
    ]) {
      expect(isSettingsActive("/settings")).toBe(true);
      expect(isRailEntryActive("settings", "/settings", `?tab=${tab}`)).toBe(true);
    }
    expect(isRailEntryActive("settings", "/settings", "")).toBe(true);
    expect(isSettingsActive("/settings/extra")).toBe(true);
    expect(isSettingsActive("/hub")).toBe(false);
    expect(isSettingsActive("/portfolio")).toBe(false);
  });

  it("lights the row whose tab is open, and Servers when no tab is given", () => {
    const find = (id: string) => SETTINGS_ENTRIES.find((e) => e.id === id)!;
    expect(isSettingsEntryActive(find("keys"), "/settings", "?tab=keys")).toBe(true);
    expect(isSettingsEntryActive(find("keys"), "/settings", "?tab=gateway")).toBe(false);
    expect(isSettingsEntryActive(find("set-privacy"), "/settings", "?tab=privacy")).toBe(true);
    expect(isSettingsEntryActive(find("servers"), "/settings", "")).toBe(true);
    expect(isSettingsEntryActive(find("servers"), "/", "?tab=servers")).toBe(false);
    expect(isRailEntryActive("set-voice", "/settings", "?tab=voice")).toBe(true);
    expect(isRailEntryActive("more", "/settings", "?tab=keys")).toBe(false);
  });
});

describe("full bleed", () => {
  it("includes the browser, a scope sidebar beside a report column", () => {
    expect(FULL_BLEED_ROUTES).toContain("/bots");
    expect(FULL_BLEED_ROUTES as readonly string[]).not.toContain("/floor");
  });

  it("includes the chat home, which scrolls its own transcript, but not the Dashboard at /", () => {
    // Showcase (preview/combined): the Dashboard took `/` and is an ordinary padded, scrolling page.
    expect(FULL_BLEED_ROUTES).toContain("/chat");
    expect(FULL_BLEED_ROUTES as readonly string[]).not.toContain("/");
    expect(FULL_BLEED_ROUTES as readonly string[]).not.toContain("/fleet");
  });
});

describe("lit state with an overlay open", () => {
  it("lights only the opener, whatever the route", () => {
    expect(isRailItemLit("dashboard", "settings", "/", "")).toBe(false);
    expect(isRailItemLit("settings", "settings", "/", "")).toBe(true);
    expect(isRailItemLit("build", "settings", "/build", "")).toBe(false);
    expect(isRailItemLit("account", "account", "/", "")).toBe(true);
    expect(isRailItemLit("settings", "account", "/settings", "?tab=voice")).toBe(false);
    expect(isRailItemLit("explore", "account", "/explore", "")).toBe(false);
  });

  it("follows the route when nothing is open", () => {
    expect(isRailItemLit("dashboard", null, "/", "")).toBe(true);
    expect(isRailItemLit("explore", null, "/explore", "")).toBe(true);
    expect(isRailItemLit("settings", null, "/settings", "?tab=keys")).toBe(true);
    expect(isRailItemLit("settings", null, "/settings", "?tab=privacy")).toBe(true);
  });
});
