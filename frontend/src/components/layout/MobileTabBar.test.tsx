/**
 * The phone tab bar: same doors as the rail, More with the six entries, and an
 * Account sheet with name, role and Logout only.
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
            <MobileTabBar onReport={() => {}} />
          </MemoryRouter>
        </ServerContext.Provider>
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  servers = [];
  logout.mockClear();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function openSheet(label: string) {
  await act(async () => {
    (container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).click();
  });
  await flush();
  return document.body.querySelector('[role="dialog"]');
}

describe("MobileTabBar", () => {
  it("shows the rail's doors with the rail's labels and routes", async () => {
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
    expect(buttons).toEqual(["More", "Algo Trader"]);
    expect(container.textContent).not.toContain("Bots");
    expect(container.textContent).not.toContain("Strategies");
  });

  it("lights Agents on the hub and on an agent, Dashboard only on the home", async () => {
    renderAt("/hub");
    await flush();
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe(
      "Agents",
    );

    act(() => root.unmount());
    root = createRoot(container);
    renderAt("/agents/alpha");
    await flush();
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe(
      "Agents",
    );

    act(() => root.unmount());
    root = createRoot(container);
    renderAt("/");
    await flush();
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe(
      "Dashboard",
    );
  });

  it("lights More on a Settings page", async () => {
    renderAt("/settings?tab=keys");
    await flush();
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe("More");
  });

  it("opens More as a sheet with exactly the six entries", async () => {
    renderAt("/");
    await flush();
    const dialog = await openSheet("More");
    const rows = Array.from(dialog?.querySelectorAll('[role="menuitem"]') ?? []).map((el) =>
      el.textContent?.trim(),
    );
    expect(rows).toEqual([
      "Hummingbot API",
      "Gateway",
      "Keys and Wallets",
      "Servers",
      "Updates",
      "Report an Issue",
    ]);
  });

  it("has no bell and no unread count", async () => {
    renderAt("/");
    await flush();
    expect(container.querySelector('[aria-label*="otification"]')).toBeNull();
    expect(container.textContent).not.toMatch(/[0-9]/);
  });

  it("shows only name, role and Logout in the Account sheet", async () => {
    renderAt("/");
    await flush();
    const dialog = await openSheet("Algo Trader");
    expect(dialog?.getAttribute("aria-label")).toBe("Account");
    expect(dialog?.textContent).toContain("Algo Trader");
    expect(dialog?.textContent).toContain("Admin");
    expect(dialog?.textContent).not.toContain("Settings");
    expect(dialog?.textContent).not.toContain("Notifications");
    expect(dialog?.textContent).not.toContain("Run setup again");
    const items = Array.from(dialog?.querySelectorAll('[role="menuitem"]') ?? []);
    expect(items.map((el) => el.textContent?.trim())).toEqual(["Logout"]);

    await act(async () => {
      (items[0] as HTMLButtonElement).click();
    });
    expect(logout).toHaveBeenCalledTimes(1);
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
