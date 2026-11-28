/**
 * The phone tab bar: four tabs, and an Account sheet with name, role, then
 * Account, Settings and Logout. Settings opens the rail panel's list (three
 * groups) inside the sheet with a back arrow; Account opens the shared dialog.
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

/** The bottom sheet, when open. The account dialog is a different dialog (aria-modal). */
function sheet() {
  return document.body.querySelector('[role="dialog"]:not([aria-modal="true"])');
}

function accountDialog() {
  return document.body.querySelector('[role="dialog"][aria-modal="true"]');
}

function rows(from: Element | null) {
  return Array.from(from?.querySelectorAll('[role="menuitem"]') ?? []).map((el) =>
    el.textContent?.trim(),
  );
}

async function openAccount() {
  await click(container.querySelector('button[aria-label="Algo Trader"]'));
  return sheet();
}

const SETTINGS_ROWS = [
  "Hummingbot API",
  "Gateway",
  "Keys and Wallets",
  "Servers",
  "Updates",
  "Agents",
  "LLM Endpoints",
  "Voice & AI",
  "Appearance",
  "Privacy",
  "Report an Issue",
];

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
      ["Learn", "/explore"],
      ["Build", "/build"],
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

  it("lights Explore on the catalogue, Dashboard only on the home", async () => {
    for (const [path, label] of [
      ["/explore", "Learn"],
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

  it("opens the Account sheet with name, role and exactly Account, Settings, Logout", async () => {
    renderAt("/");
    await flush();
    const open = await openAccount();
    expect(open?.getAttribute("aria-label")).toBe("Account");
    expect(open?.textContent).toContain("Algo Trader");
    expect(open?.textContent).toContain("Admin");
    expect(rows(open)).toEqual(["Account", "Settings", "Logout"]);
  });

  it("has no More anywhere: not on the bar, in the sheet or in the Settings list", async () => {
    renderAt("/");
    await flush();
    const open = await openAccount();
    expect(open?.textContent).not.toMatch(/\bMore\b/);
    await click(open?.querySelectorAll('[role="menuitem"]')[1]);
    expect(sheet()?.textContent).not.toMatch(/\bMore\b/);
    expect(container.textContent).not.toMatch(/\bMore\b/);
  });

  it("Settings opens the full list in three groups, with separators and no group titles", async () => {
    renderAt("/");
    await flush();
    const open = await openAccount();
    await click(open?.querySelectorAll('[role="menuitem"]')[1]);
    const list = sheet();
    expect(list?.getAttribute("aria-label")).toBe("Settings");
    expect(rows(list)).toEqual(SETTINGS_ROWS);
    expect(list?.querySelectorAll('[role="separator"]')).toHaveLength(2);
    // The dividers sit after Updates and after Privacy; Report an Issue is last.
    const order = Array.from(list?.querySelectorAll('[role="menuitem"], [role="separator"]') ?? []).map(
      (el) => (el.getAttribute("role") === "separator" ? "|" : el.textContent?.trim()),
    );
    expect(order.indexOf("|")).toBe(order.indexOf("Updates") + 1);
    expect(order.lastIndexOf("|")).toBe(order.indexOf("Privacy") + 1);
    expect(order[order.length - 1]).toBe("Report an Issue");
    const hrefs = Array.from(list?.querySelectorAll("a") ?? []).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
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
  });

  it("Back returns to the first level", async () => {
    renderAt("/");
    await flush();
    const open = await openAccount();
    await click(open?.querySelectorAll('[role="menuitem"]')[1]);
    await click(sheet()?.querySelector('button[aria-label="Back"]'));
    expect(rows(sheet())).toEqual(["Account", "Settings", "Logout"]);
  });

  it("lights the open Settings entry in its list", async () => {
    renderAt("/settings?tab=appearance");
    await flush();
    const open = await openAccount();
    await click(open?.querySelectorAll('[role="menuitem"]')[1]);
    expect(sheet()?.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe("Appearance");
  });

  it("closes the sheet after choosing an entry", async () => {
    renderAt("/");
    await flush();
    const open = await openAccount();
    await click(open?.querySelectorAll('[role="menuitem"]')[1]);
    await click(sheet()?.querySelector("a"));
    expect(sheet()).toBeNull();
  });

  it("Report an Issue closes the sheet and opens the report dialog", async () => {
    renderAt("/");
    await flush();
    const open = await openAccount();
    await click(open?.querySelectorAll('[role="menuitem"]')[1]);
    const items = sheet()?.querySelectorAll('[role="menuitem"]') ?? [];
    await click(items[items.length - 1]);
    expect(reported).toHaveBeenCalledTimes(1);
    expect(sheet()).toBeNull();
  });

  it("the Account row closes the sheet, then opens the account dialog; closing returns focus to the tab", async () => {
    renderAt("/");
    await flush();
    const open = await openAccount();
    await click(open?.querySelectorAll('[role="menuitem"]')[0]);
    // One layer at a time: the sheet is gone, the dialog is up.
    expect(sheet()).toBeNull();
    const dlg = accountDialog();
    expect(dlg).not.toBeNull();
    expect(dlg?.textContent).toContain("Your account");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await flush();
    expect(accountDialog()).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('button[aria-label="Algo Trader"]'));
  });

  it("reopens on the first level", async () => {
    renderAt("/");
    await flush();
    let open = await openAccount();
    await click(open?.querySelectorAll('[role="menuitem"]')[1]);
    await click(container.querySelector('button[aria-label="Algo Trader"]'));
    expect(sheet()).toBeNull();
    open = await openAccount();
    expect(rows(open)).toEqual(["Account", "Settings", "Logout"]);
  });

  it("Logout logs out and closes the sheet", async () => {
    renderAt("/");
    await flush();
    const open = await openAccount();
    await click(open?.querySelectorAll('[role="menuitem"]')[2]);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(sheet()).toBeNull();
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
