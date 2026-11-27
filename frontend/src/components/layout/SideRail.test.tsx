/**
 * The rail's active item and the Settings panel.
 *
 * Active-state rules live in `lib/nav` and are tested there. This checks that
 * the rail actually paints them, and that the Settings gear opens one panel
 * beside it with three groups of rows. There is no More. The avatar has no
 * menu yet: it is the initials and it goes to Settings.
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: {
    getPreferences: async () => ({ profile: { display_name: "Algo Trader" } }),
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    token: "t",
    user: { id: 1, username: "local", first_name: "Local", role: "admin" },
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
        <MemoryRouter initialEntries={[path]}>
          <SideRail onReport={onReport} />
        </MemoryRouter>
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
    rerenderAt("/hub");
    await flush();
    expect(currentLabels()).toEqual(["Agents"]);
  });

  it("lights Labs on /labs", async () => {
    renderAt("/labs");
    await flush();
    expect(currentLabels()).toEqual(["Labs"]);
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
    expect(labels).toEqual(["Dashboard", "Agents", "Labs", "Settings"]);
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
    expect(order.slice(-5)).toEqual(["Dashboard", "Agents", "Labs", "Settings", "Algo Trader"]);
  });

  it("shows the initials and sends the avatar to Settings", async () => {
    renderAt("/");
    await flush();
    const avatar = container.querySelector('a[aria-label="Algo Trader"]');
    expect(avatar?.textContent).toBe("AT");
    expect(avatar?.getAttribute("href")).toBe("/settings");
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
      renderAt("/labs");
      await flush();
      expect(lit()).toEqual(["Labs"]);
      await click(button("Settings"));
      expect(lit()).toEqual(["Settings"]);
      await click(button("Settings"));
      expect(lit()).toEqual(["Labs"]);
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
  });
});
