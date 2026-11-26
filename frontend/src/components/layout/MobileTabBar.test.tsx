/**
 * The phone tab bar: which tab is lit, and that More opens the parked pages.
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
    getServers: async () => [],
    getNotifications: async () => ({ items: [], unread: 2 }),
    getGatewayStatus: async () => ({ running: false, info: {} }),
    markNotificationsRead: async () => ({ unread: 0 }),
    clearNotifications: async () => ({ unread: 0 }),
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    token: "t",
    user: { id: 1, username: "local", first_name: "Local", role: "admin" },
    logout: () => {},
  }),
}));

vi.mock("@/lib/appBadge", () => ({ setAppBadge: () => {} }));
vi.mock("@/lib/push", () => ({ onPushNavigate: () => () => {} }));
vi.mock("@/hooks/useChatSocket", () => ({ NOTIFICATIONS_KEY: ["notifications"] }));

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
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("MobileTabBar", () => {
  it("lights Bots on a bot detail and Dashboard on an agent", async () => {
    renderAt("/bots/grid-1");
    await flush();
    const current = container.querySelector('[aria-current="page"]');
    expect(current?.getAttribute("aria-label")).toBe("Bots");

    act(() => root.unmount());
    root = createRoot(container);
    renderAt("/agents/alpha");
    await flush();
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe(
      "Dashboard",
    );
  });

  it("opens More as a sheet with the parked pages and Agent Hub", async () => {
    renderAt("/portfolio");
    await flush();
    expect(container.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe("More");

    await act(async () => {
      (container.querySelector('button[aria-label="More"]') as HTMLButtonElement).click();
    });
    await flush();

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Portfolio");
    expect(dialog?.textContent).toContain("Trade");
    expect(dialog?.textContent).toContain("DEX");
    expect(dialog?.textContent).toContain("Routines");
    expect(dialog?.textContent).toContain("Agent Hub");
    expect(dialog?.textContent).toContain("Report an issue");
  });

  it("puts Settings and the unread count on the account tab", async () => {
    renderAt("/");
    // The count arrives with the notifications query; one tick is not always enough.
    for (let i = 0; i < 20 && !container.textContent?.includes("2"); i++) await flush();
    expect(container.textContent).toContain("2");

    await act(async () => {
      (container.querySelector('button[aria-label="Algo Trader"]') as HTMLButtonElement).click();
    });
    await flush();

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Settings");
    expect(dialog?.textContent).toContain("Notifications");
    expect(dialog?.textContent).toContain("Run setup again");
    expect(dialog?.textContent).toContain("Logout");
  });
});
