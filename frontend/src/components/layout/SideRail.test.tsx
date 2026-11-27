/**
 * The rail's active item, the side panel and the account menu.
 *
 * Active-state rules live in `lib/nav` and are tested there. This checks that
 * the rail actually paints them, and that More and Settings open one panel
 * beside it with their own entries. The avatar opens the account menu: the
 * name, the role, Account (which opens the Your account dialog) and Logout,
 * nothing else.
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServerContext } from "@/hooks/useServer";

const { updatePreferences } = vi.hoisted(() => ({
  updatePreferences: vi.fn(async (updates: Record<string, unknown>) => ({ ...updates })),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getPreferences: async () => ({ profile: { display_name: "Algo Trader" } }),
    updatePreferences,
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
    expect(currentLabels()).toEqual(["More"]);

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

  it("puts More right after Labs, and Settings last, above the avatar", async () => {
    renderAt("/");
    await flush();
    const nav = container.querySelector('nav[aria-label="Primary"]')!;
    const order = [...nav.querySelectorAll("a, button")].map(
      (el) => el.getAttribute("aria-label") || el.textContent?.trim(),
    );
    expect(order.slice(-6)).toEqual(["Dashboard", "Agents", "Labs", "More", "Settings", "Algo Trader"]);
  });

  it("opens the Settings menu with five entries of its own and lights the open tab", async () => {
    renderAt("/settings?tab=appearance");
    await flush();
    expect(currentLabels()).toEqual(["Settings"]);

    const gear = [...container.querySelectorAll("button")].find(
      (el) => el.textContent?.trim() === "Settings",
    ) as HTMLButtonElement;
    await act(async () => {
      gear.click();
    });
    await flush();

    const rows = [...document.body.querySelectorAll('[role="menuitem"]')];
    expect(rows.map((el) => el.textContent?.trim())).toEqual([
      "Agents",
      "LLM Endpoints",
      "Voice & AI",
      "Appearance",
      "Privacy",
    ]);
    expect(rows.map((el) => el.getAttribute("href"))).toEqual([
      "/settings?tab=agents",
      "/settings?tab=llm",
      "/settings?tab=voice",
      "/settings?tab=appearance",
      "/settings?tab=privacy",
    ]);
    const lit = rows.filter((el) => el.getAttribute("aria-current") === "page");
    expect(lit.map((el) => el.textContent?.trim())).toEqual(["Appearance"]);
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
    expect(labels).toEqual(["Dashboard", "Agents", "Labs", "More", "Settings"]);
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
    expect(items).toEqual(["Account", "Logout"]);
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
  describe("the panel beside the rail", () => {
    const button = (name: string) =>
      [...container.querySelectorAll("button")].find(
        (el) => el.textContent?.trim() === name,
      ) as HTMLButtonElement;
    const panel = () => document.body.querySelector("aside");
    const click = async (el: Element) => {
      await act(async () => {
        (el as HTMLElement).click();
      });
      await flush();
    };
    const key = async (target: Element, k: string) => {
      await act(async () => {
        target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
      });
    };

    it("is closed until a rail button is pressed, and then titles itself More or Settings", async () => {
      renderAt("/");
      await flush();
      expect(panel()).toBeNull();
      expect(button("More").getAttribute("aria-expanded")).toBe("false");

      await click(button("More"));
      expect(panel()?.querySelector("h2")?.textContent).toBe("More");
      expect(panel()?.getAttribute("aria-labelledby")).toBe(panel()?.querySelector("h2")?.id);
      expect(panel()?.querySelector('[role="menu"]')).not.toBeNull();
      expect(button("More").getAttribute("aria-expanded")).toBe("true");
      expect(button("More").getAttribute("aria-controls")).toBe(panel()?.id);
    });

    it("switches its content when the other rail button is pressed", async () => {
      renderAt("/");
      await flush();
      await click(button("More"));
      await click(button("Settings"));
      expect(panel()?.querySelector("h2")?.textContent).toBe("Settings");
      expect(button("More").getAttribute("aria-expanded")).toBe("false");
      expect(button("Settings").getAttribute("aria-expanded")).toBe("true");
      expect(panel()?.querySelectorAll('[role="menuitem"]')).toHaveLength(5);
    });

    it("closes when its own button is pressed again", async () => {
      renderAt("/");
      await flush();
      await click(button("More"));
      await click(button("More"));
      expect(panel()).toBeNull();
    });

    it("overlays the page: fixed beside the rail, under the top bar, not in the page flow", async () => {
      renderAt("/");
      await flush();
      await click(button("More"));
      const cls = panel()!.className;
      expect(cls).toContain("fixed");
      expect(cls).toContain("left-16");
      expect(cls).toContain("top-10");
      expect(cls).toContain("bottom-0");
      expect(cls).toContain("w-60");
    });

    it("moves focus into the panel and returns it to the rail button on Escape", async () => {
      renderAt("/");
      await flush();
      await click(button("Settings"));
      const first = panel()!.querySelector('[role="menuitem"]');
      expect(document.activeElement).toBe(first);

      await key(window as unknown as Element, "Escape");
      await flush();
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(button("Settings"));
    });

    it("closes on a click outside, but not on a click inside or on a rail button", async () => {
      renderAt("/");
      await flush();
      await click(button("More"));
      await act(async () => {
        panel()!.querySelector("h2")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      expect(panel()).not.toBeNull();
      await act(async () => {
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      await flush();
      expect(panel()).toBeNull();
    });

    it("closes after an entry is chosen", async () => {
      renderAt("/");
      await flush();
      await click(button("Settings"));
      await click(panel()!.querySelectorAll('[role="menuitem"]')[3]);
      expect(panel()).toBeNull();
    });

    it("walks the entries with the arrow keys, wrapping at both ends", async () => {
      renderAt("/");
      await flush();
      await click(button("More"));
      const items = [...panel()!.querySelectorAll('[role="menuitem"]')] as HTMLElement[];
      expect(document.activeElement).toBe(items[0]);
      await key(items[0], "ArrowDown");
      expect(document.activeElement).toBe(items[1]);
      await key(items[1], "ArrowUp");
      await key(items[0], "ArrowUp");
      expect(document.activeElement).toBe(items[items.length - 1]);
      await key(items[items.length - 1], "Home");
      expect(document.activeElement).toBe(items[0]);
      await key(items[0], "End");
      expect(document.activeElement).toBe(items[items.length - 1]);
    });

    it("starts on the entry whose tab is open", async () => {
      renderAt("/settings?tab=privacy");
      await flush();
      await click(button("Settings"));
      expect(document.activeElement?.textContent?.trim()).toBe("Privacy");
    });

    describe("with the account menu", () => {
      const avatar = () =>
        container.querySelector('button[aria-label="Algo Trader"]') as HTMLButtonElement;
      const accountMenu = () =>
        [...document.body.querySelectorAll('[role="menu"]')].find((m) => !m.closest("aside"));

      it("never has both open: each one closes the other", async () => {
        renderAt("/");
        await flush();
        await click(button("More"));
        expect(panel()).not.toBeNull();

        await click(avatar());
        expect(panel()).toBeNull();
        expect(accountMenu()?.textContent).toContain("Logout");
        expect(avatar().getAttribute("aria-expanded")).toBe("true");

        await click(button("Settings"));
        expect(accountMenu()).toBeUndefined();
        expect(panel()?.querySelector("h2")?.textContent).toBe("Settings");
        expect(avatar().getAttribute("aria-expanded")).toBe("false");
      });

      it("closes the account menu on Escape and on a click outside", async () => {
        renderAt("/");
        await flush();
        await click(avatar());
        expect(accountMenu()).toBeDefined();
        await act(async () => {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        });
        await flush();
        expect(accountMenu()).toBeUndefined();

        await click(avatar());
        expect(accountMenu()).toBeDefined();
        await act(async () => {
          document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        });
        await flush();
        expect(accountMenu()).toBeUndefined();
      });

      const dialog = () => document.body.querySelector('[role="dialog"]') as HTMLElement | null;
      const accountRow = () =>
        [...document.body.querySelectorAll('[role="menuitem"]')].find(
          (el) => el.textContent?.trim() === "Account",
        ) as HTMLElement;

      it("opens the Your account dialog from the Account row and closes the popup", async () => {
        renderAt("/");
        await flush();
        await click(avatar());
        expect(accountMenu()).toBeDefined();
        expect(dialog()).toBeNull();

        await click(accountRow());
        expect(accountMenu()).toBeUndefined();
        expect(avatar().getAttribute("aria-expanded")).toBe("false");
        expect(avatar().className).not.toContain("ring-2");
        expect(dialog()).not.toBeNull();
        expect(dialog()?.textContent).toContain("Your account");
        // Prefilled with the name the rail shows.
        const nameField = dialog()!.querySelector("input") as HTMLInputElement;
        expect(nameField.value).toBe("Algo Trader");
        expect(accountRow()).toBeUndefined();
      });

      it("closes the dialog on Escape first and puts focus back on the avatar", async () => {
        renderAt("/");
        await flush();
        await click(avatar());
        await click(accountRow());
        expect(dialog()).not.toBeNull();

        await act(async () => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        });
        await flush();
        expect(dialog()).toBeNull();
        expect(updatePreferences).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(avatar());
        // The rail is as it was: route item lit, no overlay.
        expect(avatar().getAttribute("aria-expanded")).toBe("false");
      });

      it("keeps the dialog open when a panel is opened behind it", async () => {
        renderAt("/");
        await flush();
        await click(avatar());
        await click(accountRow());
        await click(button("Settings"));
        expect(dialog()).not.toBeNull();
      });

      it("has no panel content inside it", async () => {
        renderAt("/");
        await flush();
        await click(avatar());
        expect(panel()).toBeNull();
        const text = accountMenu()?.textContent ?? "";
        expect(text).toBe("Algo TraderAdminAccountLogout");
      });
    });
  });
  describe("the lit state", () => {
    const button = (name: string) =>
      [...container.querySelectorAll("button")].find(
        (el) => el.textContent?.trim() === name,
      ) as HTMLButtonElement;
    const click = async (el: Element) => {
      await act(async () => {
        (el as HTMLElement).click();
      });
      await flush();
    };
    /** Rail items that are painted lit, by their label. */
    const lit = () =>
      [...container.querySelectorAll('nav[aria-label="Primary"] a, nav[aria-label="Primary"] button')]
        .filter((el) => el.className.includes("bg-[var(--color-nav-active)]"))
        .map((el) => el.textContent?.trim());

    it("lights the route's item when nothing is open", async () => {
      renderAt("/");
      await flush();
      expect(lit()).toEqual(["Dashboard"]);
    });

    it("lights only More while the More panel is open, not the page behind it", async () => {
      renderAt("/");
      await flush();
      await click(button("More"));
      expect(lit()).toEqual(["More"]);
    });

    it("lights only Settings while the Settings panel is open", async () => {
      renderAt("/labs");
      await flush();
      expect(lit()).toEqual(["Labs"]);
      await click(button("Settings"));
      expect(lit()).toEqual(["Settings"]);
    });

    it("moves the lit state when the panel switches, and restores the route when it closes", async () => {
      renderAt("/hub");
      await flush();
      expect(lit()).toEqual(["Agents"]);
      await click(button("More"));
      expect(lit()).toEqual(["More"]);
      await click(button("Settings"));
      expect(lit()).toEqual(["Settings"]);
      await click(button("Settings"));
      expect(lit()).toEqual(["Agents"]);
    });

    it("keeps the route lit rule for More's tabs and the other Settings tabs when closed", async () => {
      renderAt("/settings?tab=keys");
      await flush();
      expect(lit()).toEqual(["More"]);
      act(() => root.unmount());
      root = createRoot(container);
      renderAt("/settings?tab=voice");
      await flush();
      expect(lit()).toEqual(["Settings"]);
    });

    it("does not mark the open opener as the current page", async () => {
      renderAt("/settings?tab=keys");
      await flush();
      expect(currentLabels()).toEqual(["More"]);
      await click(button("More"));
      // The panel's own open tab still says "page"; the rail's opener does not.
      expect(currentLabels()).toEqual(["Keys and Wallets"]);
      expect(button("More").getAttribute("aria-current")).toBeNull();
      expect(lit()).toEqual(["More"]);
    });

    it("lights only the avatar while the account popup is open, not the page behind it", async () => {
      renderAt("/");
      await flush();
      const avatar = container.querySelector('button[aria-label="Algo Trader"]') as HTMLButtonElement;
      // Closed: the route's item is lit and the avatar is plain.
      expect(lit()).toEqual(["Dashboard"]);
      expect(avatar.className).not.toContain("ring-2");

      await click(avatar);
      expect(lit()).toEqual([]);
      expect(avatar.className).toContain("ring-2");
      expect(avatar.getAttribute("aria-expanded")).toBe("true");
      expect(avatar.getAttribute("aria-current")).toBeNull();
      expect(currentLabels()).toEqual([]);

      // Switching to a panel moves the lit state to its opener and clears the avatar.
      await click(button("More"));
      expect(lit()).toEqual(["More"]);
      expect(avatar.className).not.toContain("ring-2");

      // Closing the popup brings the route's item back.
      await click(avatar);
      expect(avatar.className).toContain("ring-2");
      await click(avatar);
      expect(lit()).toEqual(["Dashboard"]);
      expect(avatar.className).not.toContain("ring-2");
    });

    it("clears the avatar's lit state after Logout", async () => {
      renderAt("/labs");
      await flush();
      const avatar = container.querySelector('button[aria-label="Algo Trader"]') as HTMLButtonElement;
      await click(avatar);
      const logoutItem = [...document.body.querySelectorAll('[role="menuitem"]')].find((el) =>
        el.textContent?.includes("Logout"),
      ) as HTMLElement;
      await click(logoutItem);
      expect(avatar.className).not.toContain("ring-2");
      expect(lit()).toEqual(["Labs"]);
    });
  });
});
