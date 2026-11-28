/**
 * The rail's active item, the Settings panel and the account menu.
 *
 * Active-state rules live in `lib/nav` and are tested there. This checks that
 * the rail actually paints them, and that the Settings gear opens one panel
 * beside it with three groups of rows. There is no More. The avatar opens the
 * account menu: the name, the role, Account (which opens the Your account
 * dialog) and Logout, nothing else.
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

function renderAt(path: string, onReport: () => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <ServerContext.Provider value={{ server: "local", setServer: () => {} }}>
          <MemoryRouter initialEntries={[path]}>
            <SideRail onReport={onReport} />
          </MemoryRouter>
        </ServerContext.Provider>
      </QueryClientProvider>,
    );
  });
}

/** Rendering again at another path: the previous tree goes first. */
function rerenderAt(path: string) {
  act(() => root.unmount());
  root = createRoot(container);
  renderAt(path);
}

function currentLabels(): string[] {
  return [...container.querySelectorAll('[aria-current="page"]')].map(
    (el) => el.getAttribute("aria-label") || el.textContent?.trim() || "",
  );
}

const button = (name: string) =>
  [...container.querySelectorAll("button")].find((el) => el.textContent?.trim() === name) as HTMLButtonElement;

async function click(el: Element) {
  await act(async () => {
    (el as HTMLElement).click();
  });
  await flush();
}

beforeEach(() => {
  updatePreferences.mockClear();
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

describe("SideRail", () => {
  it("wears the Hummingbot mark at the top, still linking home", async () => {
    renderAt("/");
    await flush();
    const brand = container.querySelector('nav[aria-label="Primary"] > div a, nav[aria-label="Primary"] a[href="/"]');
    expect(brand?.getAttribute("href")).toBe("/");
    const mark = brand?.querySelector("img");
    expect(mark?.getAttribute("src")).toBe("/hummingbot-logo.png");
    // No circle: the bird's beak and tail must not be clipped.
    expect(mark?.getAttribute("class")).not.toContain("rounded-full");
    expect(mark?.getAttribute("alt")).toBe("");
    // The old Condor circle is gone from the rail.
    expect(container.querySelector('img[src="/condor_old.jpeg"]')).toBeNull();
  });

  it("lights Dashboard on the home only", async () => {
    renderAt("/");
    await flush();
    expect(currentLabels()).toEqual(["Dashboard"]);
  });

  it("lights Explore on /explore, not on Dashboard", async () => {
    renderAt("/explore");
    await flush();
    expect(currentLabels()).toEqual(["Explore"]);
    rerenderAt("/build");
    await flush();
    expect(currentLabels()).toEqual(["Build"]);
  });

  it("lights Build on /build", async () => {
    renderAt("/build");
    await flush();
    expect(currentLabels()).toEqual(["Build"]);
  });

  it("lights Settings on a Settings page, whatever the tab, and marks the open tab in the panel", async () => {
    renderAt("/settings?tab=gateway");
    await flush();
    expect(currentLabels()).toEqual(["Settings"]);

    await click(button("Settings"));
    const rows = [...document.body.querySelectorAll('[role="menuitem"]')];
    const lit = rows.filter((el) => el.getAttribute("aria-current") === "page");
    expect(lit.map((el) => el.textContent?.trim())).toEqual(["Gateway"]);
  });

  it("lights Settings on Notifications and Admin, which have no row in the panel", async () => {
    for (const tab of ["notifications", "admin", "privacy"]) {
      rerenderAt(`/settings?tab=${tab}`);
      await flush();
      expect(currentLabels()).toEqual(["Settings"]);
    }
  });

  it("prints a text label under every rail icon, has no More and no bell", async () => {
    renderAt("/");
    await flush();
    const nav = container.querySelector('nav[aria-label="Primary"]')!;
    const labels = [...nav.querySelectorAll("a span, button span")].map((el) => el.textContent);
    expect(labels).toEqual(["Dashboard", "Explore", "Build", "Settings"]);
    expect(nav.textContent).not.toContain("More");
    expect(nav.querySelector('[aria-label*="otification"]')).toBeNull();
  });

  it("puts Settings last, above the avatar", async () => {
    renderAt("/");
    await flush();
    const nav = container.querySelector('nav[aria-label="Primary"]')!;
    const order = [...nav.querySelectorAll("a, button")].map(
      (el) => el.getAttribute("aria-label") || el.textContent?.trim(),
    );
    expect(order.slice(-5)).toEqual(["Dashboard", "Explore", "Build", "Settings", "Algo Trader"]);
  });

  it("shows Algo Trader's initials and opens the account menu", async () => {
    renderAt("/");
    await flush();
    const avatar = container.querySelector('button[aria-label="Algo Trader"]') as HTMLButtonElement;
    expect(avatar?.textContent).toBe("AT");

    await click(avatar);

    const text = document.body.textContent || "";
    expect(text).toContain("Algo Trader");
    expect(text).toContain("Admin");
    expect(text).toContain("Logout");

    // Only user functions: Account and Logout, and none of the old top-bar controls.
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
    await click(logoutItem);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  describe("the account menu", () => {
    const avatar = () =>
      container.querySelector('button[aria-label="Algo Trader"]') as HTMLButtonElement;
    const panel = () => document.body.querySelector("aside");
    const accountMenu = () =>
      [...document.body.querySelectorAll('[role="menu"]')].find((m) => !m.closest("aside"));
    const dialog = () => document.body.querySelector('[role="dialog"]') as HTMLElement | null;
    const accountRow = () =>
      [...document.body.querySelectorAll('[role="menuitem"]')].find(
        (el) => el.textContent?.trim() === "Account",
      ) as HTMLElement;

    it("never has both open: each one closes the other", async () => {
      renderAt("/");
      await flush();
      await click(button("Settings"));
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

    it("has the name, the role, Account and Logout and no panel content", async () => {
      renderAt("/");
      await flush();
      await click(avatar());
      expect(panel()).toBeNull();
      expect(accountMenu()?.textContent ?? "").toBe("Algo TraderAdminAccountLogout");
    });

    it("opens the Your account dialog from the Account row and closes the menu", async () => {
      renderAt("/");
      await flush();
      await click(avatar());
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
      expect(avatar().getAttribute("aria-expanded")).toBe("false");
    });

    it("keeps the dialog open when the Settings panel is opened behind it", async () => {
      renderAt("/");
      await flush();
      await click(avatar());
      await click(accountRow());
      await click(button("Settings"));
      expect(dialog()).not.toBeNull();
    });
  });

  describe("the Settings panel", () => {
    const panel = () => document.body.querySelector("aside");
    const rows = () => [...(panel()?.querySelectorAll('[role="menuitem"]') ?? [])] as HTMLElement[];
    const key = async (target: Element | Window, k: string) => {
      await act(async () => {
        target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
      });
    };

    it("is closed until the gear is pressed, then titles itself Settings", async () => {
      renderAt("/");
      await flush();
      expect(panel()).toBeNull();
      expect(button("Settings").getAttribute("aria-expanded")).toBe("false");

      await click(button("Settings"));
      expect(panel()?.querySelector("h2")?.textContent).toBe("Settings");
      expect(panel()?.getAttribute("aria-labelledby")).toBe(panel()?.querySelector("h2")?.id);
      expect(panel()?.querySelector('[role="menu"]')).not.toBeNull();
      expect(button("Settings").getAttribute("aria-expanded")).toBe("true");
      expect(button("Settings").getAttribute("aria-controls")).toBe(panel()?.id);
    });

    it("lists the eleven rows in three groups with two dividers and no group titles", async () => {
      renderAt("/");
      await flush();
      await click(button("Settings"));
      expect(rows().map((el) => el.textContent?.trim())).toEqual([
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
      ]);
      expect(rows().slice(0, 10).map((el) => el.getAttribute("href"))).toEqual([
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
      const menu = panel()!.querySelector('[role="menu"]')!;
      expect([...menu.children].map((el) => el.getAttribute("role"))).toEqual([
        ...Array(5).fill("menuitem"),
        "separator",
        ...Array(5).fill("menuitem"),
        "separator",
        "menuitem",
      ]);
      expect(panel()!.querySelectorAll("h2")).toHaveLength(1);
    });

    it("closes when the gear is pressed again", async () => {
      renderAt("/");
      await flush();
      await click(button("Settings"));
      await click(button("Settings"));
      expect(panel()).toBeNull();
    });

    it("overlays the page and scrolls its list on a short window", async () => {
      renderAt("/");
      await flush();
      await click(button("Settings"));
      const cls = panel()!.className;
      expect(cls).toContain("fixed");
      expect(cls).toContain("left-16");
      expect(cls).toContain("top-10");
      expect(cls).toContain("bottom-0");
      expect(cls).toContain("w-60");
      // A short window scrolls the list, not the page; the title stays put.
      const menu = panel()!.querySelector('[role="menu"]')!;
      expect(menu.className).toContain("overflow-y-auto");
      expect(menu.className).toContain("min-h-0");
    });

    it("moves focus into the panel and returns it to the gear on Escape", async () => {
      renderAt("/");
      await flush();
      await click(button("Settings"));
      expect(document.activeElement).toBe(rows()[0]);
      await key(window, "Escape");
      await flush();
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(button("Settings"));
    });

    it("closes on a click outside, but not on a click inside", async () => {
      renderAt("/");
      await flush();
      await click(button("Settings"));
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

    it("closes after a row is chosen", async () => {
      renderAt("/");
      await flush();
      await click(button("Settings"));
      await click(rows()[8]);
      expect(panel()).toBeNull();
    });

    it("opens the report dialog from the last row and closes the panel", async () => {
      const onReport = vi.fn();
      renderAt("/", onReport);
      await flush();
      await click(button("Settings"));
      const report = rows().find((el) => el.textContent?.trim() === "Report an Issue")!;
      await click(report);
      expect(onReport).toHaveBeenCalledOnce();
      expect(panel()).toBeNull();
    });

    it("walks the rows with the arrow keys, wrapping at both ends and skipping the dividers", async () => {
      renderAt("/");
      await flush();
      await click(button("Settings"));
      const items = rows();
      expect(document.activeElement).toBe(items[0]);
      await key(items[0], "ArrowDown");
      expect(document.activeElement).toBe(items[1]);
      await key(items[1], "ArrowUp");
      await key(items[0], "ArrowUp");
      expect(document.activeElement).toBe(items[10]);
      await key(items[10], "Home");
      expect(document.activeElement).toBe(items[0]);
      await key(items[0], "End");
      expect(document.activeElement).toBe(items[10]);
      // Over the dividers: Updates to Agents, and Privacy to Report an Issue.
      items[4].focus();
      await key(items[4], "ArrowDown");
      expect(document.activeElement).toBe(items[5]);
      items[9].focus();
      await key(items[9], "ArrowDown");
      expect(document.activeElement).toBe(items[10]);
    });

    it("starts on the row whose tab is open", async () => {
      renderAt("/settings?tab=privacy");
      await flush();
      await click(button("Settings"));
      expect(document.activeElement?.textContent?.trim()).toBe("Privacy");
    });
  });

  describe("the lit state", () => {
    const lit = () =>
      [...container.querySelectorAll('nav[aria-label="Primary"] a, nav[aria-label="Primary"] button')]
        .filter((el) => el.className.includes("bg-[var(--color-nav-active)]"))
        .map((el) => el.textContent?.trim());

    it("lights the route's item when nothing is open", async () => {
      renderAt("/");
      await flush();
      expect(lit()).toEqual(["Dashboard"]);
    });

    it("lights only Settings while the panel is open, not the page behind it", async () => {
      renderAt("/build");
      await flush();
      expect(lit()).toEqual(["Build"]);
      await click(button("Settings"));
      expect(lit()).toEqual(["Settings"]);
      await click(button("Settings"));
      expect(lit()).toEqual(["Build"]);
    });

    it("lights Settings on every Settings tab when closed", async () => {
      for (const tab of ["keys", "updates", "voice", "notifications"]) {
        rerenderAt(`/settings?tab=${tab}`);
        await flush();
        expect(lit()).toEqual(["Settings"]);
      }
    });

    it("does not mark the open opener as the current page", async () => {
      renderAt("/settings?tab=keys");
      await flush();
      expect(currentLabels()).toEqual(["Settings"]);
      await click(button("Settings"));
      // The panel's own open row still says "page"; the rail's gear does not.
      expect(currentLabels()).toEqual(["Keys and Wallets"]);
      expect(button("Settings").getAttribute("aria-current")).toBeNull();
      expect(lit()).toEqual(["Settings"]);
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

      // Opening the Settings panel moves the lit state to the gear and clears the avatar.
      await click(button("Settings"));
      expect(lit()).toEqual(["Settings"]);
      expect(avatar.className).not.toContain("ring-2");

      // Closing the popup brings the route's item back.
      await click(avatar);
      expect(avatar.className).toContain("ring-2");
      await click(avatar);
      expect(lit()).toEqual(["Dashboard"]);
      expect(avatar.className).not.toContain("ring-2");
    });

    it("clears the avatar's lit state after Logout", async () => {
      renderAt("/build");
      await flush();
      const avatar = container.querySelector('button[aria-label="Algo Trader"]') as HTMLButtonElement;
      await click(avatar);
      const logoutItem = [...document.body.querySelectorAll('[role="menuitem"]')].find((el) =>
        el.textContent?.includes("Logout"),
      ) as HTMLElement;
      await click(logoutItem);
      expect(avatar.className).not.toContain("ring-2");
      expect(lit()).toEqual(["Build"]);
    });
  });
});
