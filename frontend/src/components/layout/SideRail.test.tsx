/**
 * The rail's active item and the More menu.
 *
 * Active-state rules live in `lib/nav` and are tested there. This checks that
 * the rail actually paints them, and that More opens onto its six entries.
 * The avatar opens the account menu: the name, the role and Logout, nothing
 * else.
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServerContext } from "@/hooks/useServer";

vi.mock("@/lib/api", () => ({
  api: {
    getPreferences: async () => ({ profile: { display_name: "Algo Trader" } }),
    getServers: async () => [
      { name: "local", host: "h", port: 8000, online: true, permission: "owner", is_default: true },
    ],
    getNotifications: async () => ({ items: [], unread: 0 }),
    getGatewayStatus: async () => ({ running: true, info: {} }),
    markNotificationsRead: async () => ({ unread: 0 }),
    clearNotifications: async () => ({ unread: 0 }),
  },
}));

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    token: "t",
    user: { id: 1, username: "local", first_name: "Local", role: "admin" },
    logout,
  }),
}));

vi.mock("@/lib/appBadge", () => ({ setAppBadge: () => {} }));
vi.mock("@/lib/push", () => ({ onPushNavigate: () => () => {} }));
vi.mock("@/hooks/useChatSocket", () => ({ NOTIFICATIONS_KEY: ["notifications"] }));

const { SideRail } = await import("./SideRail");

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
            <SideRail onReport={() => {}} />
          </MemoryRouter>
        </ServerContext.Provider>
      </QueryClientProvider>,
    );
  });
}

function currentLabels(): string[] {
  return [...container.querySelectorAll('[aria-current="page"]')].map(
    (el) => el.getAttribute("aria-label") || el.textContent?.trim() || "",
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SideRail", () => {
  it("lights Dashboard on the home only", async () => {
    renderAt("/");
    await flush();
    expect(currentLabels()).toEqual(["Dashboard"]);
  });

  it("lights Agents on the Hub and on an agent workspace, not on Dashboard", async () => {
    renderAt("/agents/alpha");
    await flush();
    expect(currentLabels()).toEqual(["Agents"]);
    act(() => root.unmount());
    root = createRoot(container);
    renderAt("/hub");
    await flush();
    expect(currentLabels()).toEqual(["Agents"]);
  });

  it("lights Labs on /labs", async () => {
    renderAt("/labs");
    await flush();
    expect(currentLabels()).toEqual(["Labs"]);
  });

  it("lights More on a Settings page and marks the open tab in the menu", async () => {
    renderAt("/settings?tab=gateway");
    await flush();
    expect(currentLabels()).toContain("More");

    const more = [...container.querySelectorAll("button")].find(
      (el) => el.textContent?.trim() === "More",
    ) as HTMLButtonElement;
    await act(async () => {
      more.click();
    });
    await flush();

    const rows = [...document.body.querySelectorAll('[role="menuitem"]')];
    expect(rows.map((el) => el.textContent?.trim())).toEqual([
      "Hummingbot API",
      "Gateway",
      "Keys and Wallets",
      "Servers",
      "Updates",
      "Report an Issue",
    ]);
    const lit = rows.filter((el) => el.getAttribute("aria-current") === "page");
    expect(lit.map((el) => el.textContent?.trim())).toEqual(["Gateway"]);
  });

  it("opens the report dialog from the last More row", async () => {
    const onReport = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/"]}>
            <SideRail onReport={onReport} />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    await flush();
    const more = [...container.querySelectorAll("button")].find(
      (el) => el.textContent?.trim() === "More",
    ) as HTMLButtonElement;
    await act(async () => {
      more.click();
    });
    await flush();
    const report = [...document.body.querySelectorAll('[role="menuitem"]')].find(
      (el) => el.textContent?.trim() === "Report an Issue",
    ) as HTMLElement;
    await act(async () => {
      report.click();
    });
    expect(onReport).toHaveBeenCalledOnce();
  });

  it("prints a text label under every rail icon, and has no bell", async () => {
    renderAt("/");
    await flush();
    const nav = container.querySelector('nav[aria-label="Primary"]')!;
    const labels = [...nav.querySelectorAll("a span, button span")].map((el) => el.textContent);
    expect(labels).toEqual(["Dashboard", "Agents", "Labs", "More"]);
    expect(nav.querySelector('[aria-label*="otification"]')).toBeNull();
  });

  it("shows Algo Trader's initials and opens the account menu", async () => {
    renderAt("/");
    await flush();
    const avatar = container.querySelector('button[aria-label="Algo Trader"]') as HTMLButtonElement;
    expect(avatar?.textContent).toBe("AT");

    await act(async () => {
      avatar.click();
    });
    await flush();

    const text = document.body.textContent || "";
    expect(text).toContain("Algo Trader");
    expect(text).toContain("Admin");
    expect(text).toContain("Logout");

    // Only user functions: one action, and none of the old top-bar controls.
    const items = [...document.body.querySelectorAll('[role="menuitem"]')].map((el) =>
      el.textContent?.trim(),
    );
    expect(items).toEqual(["Logout"]);
    for (const gone of [
      "API Servers",
      "Display Currency",
      "USDT",
      "Theme",
      "Run setup again",
      "Gateway",
      "local",
    ]) {
      expect(text).not.toContain(gone);
    }
    expect(document.body.querySelector('a[href="/welcome"]')).toBeNull();
    expect(document.body.querySelector('[aria-label="Theme"]')).toBeNull();

    const logoutItem = [...document.body.querySelectorAll('[role="menuitem"]')].find((el) =>
      el.textContent?.includes("Logout"),
    ) as HTMLButtonElement;
    await act(async () => {
      logoutItem.click();
    });
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
