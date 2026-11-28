/**
 * The showcase Dashboard: sample data, labelled as such, and nothing on it goes anywhere.
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prefs = vi.hoisted(() => ({
  current: { profile: { display_name: "Algo Trader" } } as Record<string, unknown>,
}));

vi.mock("@/lib/api", () => ({
  api: { getPreferences: async () => prefs.current },
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "t", user: { id: 1, username: "local", first_name: "Local", role: "admin" } }),
}));

const { Dashboard } = await import("./Dashboard");
const { Home } = await import("./Home");
const { SAMPLE } = await import("./dashboard/sampleData");
const { isChatLink } = await import("@/lib/chatLinks");

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

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

function renderAt(path: string, element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={element} />
            <Route path="/chat" element={<div>chat home</div>} />
          </Routes>
          <Where />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  prefs.current = { profile: { display_name: "Algo Trader" } };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Dashboard", () => {
  it("shows the title, the greeting with the display name and the four summary cards", async () => {
    renderAt("/", <Dashboard />);
    await flush();
    const text = container.textContent ?? "";
    expect(container.querySelector("h1")?.textContent).toBe("Condor Dashboard");
    expect(text).toContain("Welcome back, Algo Trader.");
    expect(text).toMatch(/Updated [A-Z][a-z]{2} \d{1,2} \d{2}:\d{2}/);
    for (const card of ["Combined Funds", "Combined P&L", "BTC Meter", "BTC Price Timeframes"]) {
      expect(text).toContain(card);
    }
    expect(text).toContain("Daily P&L (Combined)");
    expect(text).toContain("Hourly P&L (Combined)");
    expect(text).toContain("Top News");
  });

  it("uses the saved dashboard title and name in place of the sample heading", async () => {
    prefs.current = { profile: { display_name: "Ada" }, ui: { dashboard_title: "Ada Desk" } };
    renderAt("/", <Dashboard />);
    await flush();
    await flush();
    expect(container.querySelector("h1")?.textContent).toBe("Ada Desk");
    expect(container.textContent).toContain("Welcome back, Ada.");
  });

  it("shows the three live agents with their subtitles and the five field rows", async () => {
    renderAt("/", <Dashboard />);
    await flush();
    const cards = [...container.querySelectorAll('section[aria-label="Live agents"] article')];
    expect(cards.map((c) => c.querySelector("h3")?.textContent)).toEqual(["Stable Churn", "GateForum", "JEV"]);
    expect(cards.map((c) => c.querySelector("p")?.textContent)).toEqual(["Binance (spot)", "Gate (perps)", "Meteora"]);
    for (const card of cards) {
      expect(card.textContent).toContain("Realized / Unrealized");
      expect([...card.querySelectorAll("dt")].map((d) => d.textContent)).toEqual([
        "Pair",
        "Filled Orders Qty",
        "Volume",
        "Agent Started",
        "Total Runtime",
      ]);
    }
    const started = cards.map((c) => c.querySelectorAll("dd")[3]?.textContent);
    const runtime = cards.map((c) => c.querySelectorAll("dd")[4]?.textContent);
    expect(started).toEqual(["25-Nov-26 at 12:55 pm", "26-Nov-26 at 9:40 am", "28-Nov-26 at 12:55 pm"]);
    expect(runtime).toEqual(["3D 2H 30Mins", "2D 5H 45Mins", "2H 30Mins"]);
  });

  it("keeps every sample value different for each live agent", () => {
    const fields = [
      "pnl",
      "pnlPct",
      "realized",
      "unrealized",
      "pair",
      "filledOrders",
      "volume",
      "agentStarted",
      "totalRuntime",
    ] as const;
    for (const field of fields) {
      const values = SAMPLE.agents.map((a) => a[field]);
      expect(new Set(values).size, `${field} repeats across the live agents`).toBe(SAMPLE.agents.length);
    }
  });

  it("labels the page and the news card as sample data", async () => {
    renderAt("/", <Dashboard />);
    await flush();
    const badges = [...container.querySelectorAll("span")].filter((s) => s.textContent === "Sample data");
    expect(badges.length).toBeGreaterThanOrEqual(2);
    const news = [...container.querySelectorAll("article")].find((a) => a.textContent?.includes("Top News"));
    expect(news?.textContent).toContain("Sample data");
  });

  it("has no link that goes anywhere", async () => {
    renderAt("/", <Dashboard />);
    await flush();
    const links = [...container.querySelectorAll("a")];
    expect(links).toHaveLength(5);
    for (const a of links) expect(a.getAttribute("href")).toBe("#");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => {
      links[0].dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
  });

  it("draws every chart without a network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderAt("/", <Dashboard />);
    await flush();
    expect(container.querySelectorAll("svg[role='img']").length).toBeGreaterThanOrEqual(4);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("Home", () => {
  it("shows the Dashboard at a bare /", async () => {
    renderAt("/", <Home />);
    await flush();
    expect(container.querySelector("h1")?.textContent).toBe("Condor Dashboard");
  });

  it("keeps the wizard's address on the Dashboard", async () => {
    renderAt("/?onboarding=1", <Home />);
    await flush();
    expect(container.querySelector("h1")?.textContent).toBe("Condor Dashboard");
    expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/?onboarding=1");
  });

  it("forwards chat deep links to /chat with their query string", async () => {
    renderAt("/?panel=loops", <Home />);
    await flush();
    expect(container.querySelector('[data-testid="where"]')?.textContent).toBe("/chat?panel=loops");
    expect(container.textContent).toContain("chat home");
  });

  it("knows which parameters are chat links", () => {
    expect(isChatLink("?conversation=abc")).toBe(true);
    expect(isChatLink("?agent=condor&ask=hi")).toBe(true);
    expect(isChatLink("?panel=desk&desk=execution")).toBe(true);
    expect(isChatLink("?onboarding=1")).toBe(false);
    expect(isChatLink("")).toBe(false);
  });
});
