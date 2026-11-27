/**
 * The phone tab bar: four tabs, and an Account sheet with name, role, More,
 * Settings and Logout; More and Settings open a second level with a back arrow.
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServerContext } from "@/hooks/useServer";

let servers: Array<{ name: string; online: boolean }> = [];

vi.mock("@/lib/api", () => ({
  api: {
    getPreferences: async () => ({ profile: { display_name: "Algo Trader" } }),
    getServers: async () => servers,
    getGatewayStatus: async () => ({ running: false, info: {} }),
    markNotificationsRead: async () => ({ unread: 0 }),
    clearNotifications: async () => ({ unread: 0 }),
  },
}));

const logout = vi.fn();

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    token: "t",
    user: { id: 1, username: "local", first_name: "Local", role: "admin" },
    logout,
  }),
}));

vi.mock("@/lib/appBadge", () => ({ setAppBadge: () => {} }));
vi.mock("@/lib/push", () => ({ onPushNavigate: () => () => {} }));

const reported = vi.fn();

const { MobileTabBar } = await import("./MobileTabBar");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <ServerContext.Provider value={{ server: "local", setServer: () => {} }}>
          <MemoryRouter initialEntries={[path]}>
            <MobileTabBar onReport={reported} />
          </MemoryRouter>
        </ServerContext.Provider>
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  servers = [];
  logout.mockClear();
  reported.mockClear();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function click(el: Element | null | undefined) {
  await act(async () => {
    (el as HTMLElement).click();
  });
  await flush();
}

function dialog() {
  return document.body.querySelector('[role="dialog"]');
}

function rows(root: Element | null) {
  return Array.from(root?.querySelectorAll('[role="menuitem"]') ?? []).map((el) =>
    el.textContent?.trim(),
  );
}

async function openAccount() {
  await click(container.querySelector('button[aria-label="Algo Trader"]'));
  return dialog();
}

describe("MobileTabBar", () => {
  it("shows exactly four tabs: the rail's three doors, then Account", async () => {
    renderAt("/");
    await flush();
    const links = Array.from(container.querySelectorAll("nav a")).map((a) => [
      a.getAttribute("aria-label"),
      a.getAttribute("href"),
    ]);
    expect(links).toEqual([
      ["Dashboard", "/"],
      ["Agents", "/hub"],
      ["Labs", "/labs"],
    ]);
    const buttons = Array.from(container.querySelectorAll("nav button")).map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(buttons).toEqual(["Algo Trader"]);
    expect(container.querySelectorAll("nav > a, nav > button")).toHaveLength(4);
    expect(container.textContent).not.toContain("More");
    expect(container.textContent).not.toContain("Settings");
    expect(container.textContent).not.toContain("Bots");
  });

  it("lights Agents on the hub and on an agent, Dashboard only on the home", async () => {
    for (const [path, label] of [
      ["/hub", "Agents"],
      ["/agents/alpha", "Agents"],
      ["/", "Dashboard"],
    ] as const) {
      renderAt(path);
      await flush();
      expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe(label);
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it("lights Account on a Settings page", async () => {
    renderAt("/settings?tab=keys");
    await flush();
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe(
      "Algo Trader",
    );
  });

  it("lights only Account while the sheet is open, then the route again", async () => {
    renderAt("/");
    await flush();
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe(
      "Dashboard",
    );
    await openAccount();
    expect(container.querySelector('nav a[aria-current="page"]')).toBeNull();
    expect(container.querySelector('nav button[aria-expanded="true"]')).not.toBeNull();
    await click(container.querySelector('button[aria-label="Algo Trader"]'));
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe(
      "Dashboard",
    );
  });

  it("opens the Account sheet with name, role and three rows", async () => {
    renderAt("/");
    await flush();
    const sheet = await openAccount();
    expect(sheet?.getAttribute("aria-label")).toBe("Account");
    expect(sheet?.textContent).toContain("Algo Trader");
    expect(sheet?.textContent).toContain("Admin");
    expect(rows(sheet)).toEqual(["More", "Settings", "Logout"]);
  });

  it("More opens the six entries inside the sheet, and Back returns", async () => {
    renderAt("/");
    await flush();
    const sheet = await openAccount();
    await click(sheet?.querySelectorAll('[role="menuitem"]')[0]);
    expect(rows(dialog())).toEqual([
      "Hummingbot API",
      "Gateway",
      "Keys and Wallets",
      "Servers",
      "Updates",
      "Report an Issue",
    ]);
    const hrefs = Array.from(dialog()?.querySelectorAll("a") ?? []).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/settings?tab=api",
      "/settings?tab=gateway",
      "/settings?tab=keys",
      "/settings?tab=servers",
      "/settings?tab=updates",
    ]);

    await click(dialog()?.querySelector('button[aria-label="Back"]'));
    expect(rows(dialog())).toEqual(["More", "Settings", "Logout"]);
  });

  it("Settings opens the five entries inside the sheet", async () => {
    renderAt("/");
    await flush();
    const sheet = await openAccount();
    await click(sheet?.querySelectorAll('[role="menuitem"]')[1]);
    expect(rows(dialog())).toEqual([
      "Agents",
      "LLM Endpoints",
      "Voice & AI",
      "Appearance",
      "Privacy",
    ]);
    const hrefs = Array.from(dialog()?.querySelectorAll("a") ?? []).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/settings?tab=agents",
      "/settings?tab=llm",
      "/settings?tab=voice",
      "/settings?tab=appearance",
      "/settings?tab=privacy",
    ]);
  });

  it("lights the open Settings entry in its list", async () => {
    renderAt("/settings?tab=appearance");
    await flush();
    const sheet = await openAccount();
    await click(sheet?.querySelectorAll('[role="menuitem"]')[1]);
    const lit = dialog()?.querySelector('[aria-current="page"]');
    expect(lit?.textContent?.trim()).toBe("Appearance");
  });

  it("closes the sheet after choosing an entry, and Report an Issue opens the dialog", async () => {
    renderAt("/");
    await flush();
    let sheet = await openAccount();
    await click(sheet?.querySelectorAll('[role="menuitem"]')[0]);
    await click(dialog()?.querySelector("a"));
    expect(dialog()).toBeNull();

    sheet = await openAccount();
    await click(sheet?.querySelectorAll('[role="menuitem"]')[0]);
    const items = dialog()?.querySelectorAll('[role="menuitem"]') ?? [];
    await click(items[items.length - 1]);
    expect(reported).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it("reopens on the first level", async () => {
    renderAt("/");
    await flush();
    let sheet = await openAccount();
    await click(sheet?.querySelectorAll('[role="menuitem"]')[1]);
    await click(container.querySelector('button[aria-label="Algo Trader"]'));
    expect(dialog()).toBeNull();
    sheet = await openAccount();
    expect(rows(sheet)).toEqual(["More", "Settings", "Logout"]);
  });

  it("Logout logs out and closes the sheet", async () => {
    renderAt("/");
    await flush();
    const sheet = await openAccount();
    await click(sheet?.querySelectorAll('[role="menuitem"]')[2]);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it("has no bell and no unread count", async () => {
    renderAt("/");
    await flush();
    expect(container.querySelector('[aria-label*="otification"]')).toBeNull();
    expect(container.textContent).not.toMatch(/[0-9]/);
  });

  it("puts a red dot on the Account tab while the selected server is offline", async () => {
    servers = [{ name: "local", online: false }];
    renderAt("/");
    for (let i = 0; i < 20 && !container.querySelector('[aria-label="Server offline"]'); i++) {
      await flush();
    }
    expect(container.querySelector('[aria-label="Server offline"]')).not.toBeNull();
  });
});
