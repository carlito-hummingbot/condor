/**
 * The rail's active item and the More menu.
 *
 * Active-state rules live in `lib/nav` and are tested there. This checks that
 * the rail actually paints them, and that More opens onto the parked pages
 * plus Report an issue. The avatar has no menu yet: it is the initials and it
 * goes to Settings.
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
  it("lights Dashboard on an agent workspace and not on Bots", async () => {
    renderAt("/agents/alpha");
    await flush();
    expect(currentLabels()).toContain("Dashboard");
    expect(currentLabels()).not.toContain("Bots");
  });

  it("lights Bots on a bot detail", async () => {
    renderAt("/bots/grid-1");
    await flush();
    expect(currentLabels()).toEqual(["Bots"]);
  });

  it("lights Strategies when the home has the loops panel open", async () => {
    renderAt("/?panel=loops");
    await flush();
    expect(currentLabels()).toContain("Strategies");
  });

  it("lights More on a parked page and lists every door, including Agent Hub", async () => {
    renderAt("/dex/solana/abc");
    await flush();
    expect(currentLabels()).toContain("More");

    const more = [...container.querySelectorAll("button")].find(
      (el) => el.textContent?.trim() === "More",
    ) as HTMLButtonElement;
    await act(async () => {
      more.click();
    });
    await flush();

    const items = [...document.body.querySelectorAll('[role="menuitem"]')].map(
      (el) => el.textContent?.trim(),
    );
    expect(items).toEqual([
      "Portfolio",
      "Trade",
      "DEX",
      "Routines",
      "Agent Hub",
      "Report an issue",
    ]);
    const dex = [...document.body.querySelectorAll('[role="menuitem"]')].find(
      (el) => el.textContent?.includes("DEX"),
    );
    expect(dex?.getAttribute("aria-current")).toBe("page");
  });

  it("prints a text label under every rail icon", async () => {
    renderAt("/");
    await flush();
    const nav = container.querySelector('nav[aria-label="Primary"]')!;
    const labels = [...nav.querySelectorAll("a span, button span")].map((el) => el.textContent);
    expect(labels).toEqual(["Dashboard", "Bots", "Strategies", "More", "Alerts", "Settings"]);
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
    expect(text).toContain("local");
    expect(text).toContain("Gateway: running");
    expect(text).toContain("USDT");
    expect(text).toContain("Run setup again");
    expect(text).toContain("Logout");

    const setup = [...document.body.querySelectorAll("a")].find((a) =>
      a.textContent?.includes("Run setup again"),
    );
    expect(setup?.getAttribute("href")).toBe("/welcome");

    const bell = container.querySelector('button[aria-label="Notifications"]');
    expect(bell).not.toBeNull();
  });
});
