/**
 * The showcase Explore page: four tabs in the URL, the two lists, the source
 * filter and the one set of real links.
 *
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BOTCAMP_URL, CHANNELS, LESSONS, LIVE_NOW, NEWS, STRATEGIES } from "./explore/sampleData";

const { Explore, HubRedirect } = await import("./Explore");

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

function renderAt(path: string) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Explore />
        <Where />
      </MemoryRouter>,
    );
  });
}

async function click(el: Element | null | undefined) {
  await act(async () => {
    (el as HTMLElement).click();
  });
  await flush();
}

const panel = () => container.querySelector('[role="tabpanel"]') as HTMLElement;
const tabs = () => [...container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[];
const tabNamed = (name: string) =>
  tabs().find((t) => t.textContent?.replace(/\d+/g, "").trim() === name) as HTMLButtonElement;
const chips = () =>
  [...container.querySelectorAll('[role="group"] button')] as HTMLButtonElement[];
const chipNamed = (name: string) =>
  chips().find((c) => c.textContent?.replace(/\d+/g, "").trim() === name) as HTMLButtonElement;
const where = () => container.querySelector('[data-testid="where"]')?.textContent ?? "";

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

describe("Explore", () => {
  it("renders four tabs — Get Started, Live Bots, Bots, What's new — with Get Started first", async () => {
    renderAt("/explore");
    await flush();
    expect(tabs().map((t) => t.textContent?.replace(/\d+/g, "").trim())).toEqual([
      "Get Started",
      "Live Bots",
      "Bots",
      "What's new",
    ]);
    // No separate Strategies or Agents tab any more.
    const names = tabs().map((t) => t.textContent?.replace(/\d+/g, "").trim());
    expect(names).not.toContain("Strategies");
    expect(names).not.toContain("Agents");
    expect(tabNamed("Get Started").getAttribute("aria-selected")).toBe("true");
    expect(panel().textContent).toContain("Get started");
    expect(panel().textContent).toContain("Next livestream");
    // Live now and Browse left this tab.
    expect(panel().textContent).not.toContain("Live now");
    expect(panel().textContent).not.toContain("Browse");
  });

  it("keeps the overview id, so an old ?tab=overview link still opens it", async () => {
    renderAt("/explore?tab=overview");
    await flush();
    expect(tabNamed("Get Started").getAttribute("aria-selected")).toBe("true");
    expect(panel().textContent).toContain("Four short lessons");
  });

  it("puts the selected tab in ?tab= when Bots is clicked", async () => {
    renderAt("/explore");
    await flush();
    await click(tabNamed("Bots"));
    expect(where()).toBe("/explore?tab=bots");
    expect(tabNamed("Bots").getAttribute("aria-selected")).toBe("true");
    expect(panel().textContent).toContain("Rule-based: fixed rules decide when to quote, enter and exit.");
    for (const strategy of STRATEGIES) expect(panel().textContent).toContain(strategy.name);
  });

  it("maps the old ?tab=strategies and ?tab=agents links onto Bots", async () => {
    for (const legacy of ["strategies", "agents"]) {
      renderAt(`/explore?tab=${legacy}`);
      await flush();
      expect(tabNamed("Bots").getAttribute("aria-selected")).toBe("true");
      // The address is rewritten, so the tab and the URL agree.
      expect(where()).toBe("/explore?tab=bots");
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it("moves tabs with the arrow, Home and End keys", async () => {
    renderAt("/explore");
    await flush();
    tabNamed("Get Started").focus();
    await act(async () => {
      tabNamed("Get Started").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    await flush();
    expect(tabNamed("Live Bots").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabNamed("Live Bots"));

    await act(async () => {
      tabNamed("Live Bots").dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    await flush();
    expect(tabNamed("What's new").getAttribute("aria-selected")).toBe("true");

    await act(async () => {
      tabNamed("What's new").dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    await flush();
    expect(tabNamed("Get Started").getAttribute("aria-selected")).toBe("true");
  });

  it("opens Live Bots from ?tab=live-bots and lists all six sample bots", async () => {
    renderAt("/explore?tab=live-bots");
    await flush();
    expect(tabNamed("Live Bots").getAttribute("aria-selected")).toBe("true");
    expect(panel().textContent).toContain("Live bots");
    expect(panel().textContent).toContain("Sample data");
    const cards = [...panel().querySelectorAll('section[aria-label="Live bots"] article')];
    expect(cards).toHaveLength(6);
    expect(cards.map((c) => c.querySelector("h3")?.textContent)).toEqual(LIVE_NOW.map((n) => n.name));
    // No dead chart button and no Improve on a catalogue card.
    expect(panel().textContent).not.toContain("coming soon");
    expect(panel().textContent).not.toContain("Improve");
  });

  it("draws green and red P&L bars with a zero line and the seven day labels", async () => {
    renderAt("/explore?tab=live-bots");
    await flush();
    const cards = [...panel().querySelectorAll('section[aria-label="Live bots"] article')] as HTMLElement[];
    expect(cards).toHaveLength(6);

    const redDays = cards.map((card) => {
      const svg = card.querySelector('svg[role="img"]') as SVGElement;
      expect(svg.getAttribute("aria-label")).toContain("daily P&L");
      expect(svg.getAttribute("aria-label")).toContain("sample data");
      const green = [...svg.querySelectorAll('rect[fill="var(--color-green)"]')];
      const red = [...svg.querySelectorAll('rect[fill="var(--color-red)"]')];
      expect(green.length).toBeGreaterThan(0);
      expect(red.length).toBeGreaterThan(0);
      expect(svg.querySelectorAll('[data-zero="true"]')).toHaveLength(1);
      // One bar per day, and the day labels under them.
      expect(green.length + red.length).toBe(7);
      for (const day of ["22", "23", "24", "25", "26", "27", "28"]) {
        expect(svg.textContent).toContain(day);
      }
      return red.map((bar) => bar.getAttribute("x")).join(",");
    });

    // Red days are not in the same place on every card.
    expect(new Set(redDays).size).toBeGreaterThan(1);
    // No price ticks survive from the old price line.
    expect(panel().textContent).not.toContain("1.0003");
  });

  it("puts the chart after the P&L block and the Exchange row before the other rows", async () => {
    renderAt("/explore?tab=live-bots");
    await flush();
    const card = panel().querySelector('section[aria-label="Live bots"] article') as HTMLElement;
    const chart = card.querySelector('svg[role="img"]') as SVGElement;
    expect(chart.getAttribute("aria-label")).toContain("sample data");
    const realized = [...card.querySelectorAll("span")].find((s) => s.textContent === "Realized / Unrealized")!;
    const dl = card.querySelector("dl")!;
    expect(realized.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chart.compareDocumentPosition(dl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...card.querySelectorAll("dt")].map((d) => d.textContent)).toEqual([
      "Exchange",
      "Pair",
      "Filled Orders Qty",
      "Volume",
      "Agent Started",
      "Total Runtime",
    ]);
    // The venue shows once, as that row — never twice.
    expect(card.textContent?.split("Binance (spot)").length).toBe(2);
    expect(card.textContent).not.toContain("Open chart");
    // The day labels the chart draws.
    expect(chart.textContent).toContain("22");
    expect(chart.textContent).toContain("28");
  });

  it("shows the four lessons as rows: a plain title, no panel, no toggle", async () => {
    renderAt("/explore");
    await flush();
    expect(panel().textContent).toContain("Four short lessons. Play the video on a row.");
    for (const lesson of LESSONS) {
      expect(panel().textContent).toContain(lesson.title);
      expect(panel().textContent).toContain(lesson.description);
    }
    // Plain headings, not buttons: a title neither opens nor closes anything.
    const headings = [...panel().querySelectorAll("h3")].filter((h) =>
      LESSONS.some((l) => h.textContent?.trim() === l.title),
    );
    expect(headings).toHaveLength(4);
    expect(panel().querySelector("h3 button")).toBeNull();
    expect(panel().querySelector("[aria-expanded]")).toBeNull();
    // The old detail panel and its "Video summary" are gone.
    expect(panel().querySelector("#explore-lesson-detail")).toBeNull();
    expect(panel().textContent).not.toContain("Video summary");
    for (const gone of ["Watch", "Try in Build", "Import", "video coming", "Live now", "Browse"]) {
      expect(panel().textContent).not.toContain(gone);
    }
    // Like a Strategy row, without its Risk / difficulty / venue line.
    expect(panel().textContent).not.toContain("Risk:");
    expect(panel().textContent).not.toContain("Improve this");
  });

  it("opens one lesson video in a dialog, and closes it on Escape", async () => {
    renderAt("/explore");
    await flush();
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    const playButtons = () => [...panel().querySelectorAll("button")];
    const first = playButtons()[0];
    expect(first.getAttribute("aria-label")).toContain("Play the");
    await click(first);

    const dialogs = () => container.querySelectorAll('[role="dialog"]');
    expect(dialogs()).toHaveLength(1);
    expect(dialogs()[0].getAttribute("aria-label")).toBe(LESSONS[0].title);
    const frame = dialogs()[0].querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe(
      `https://www.youtube-nocookie.com/embed/${LESSONS[0].youtube}`,
    );
    expect(frame.getAttribute("src")).not.toContain("?");
    expect(dialogs()[0].textContent).toContain("Sample data");
    // Only the open lesson's id is mounted.
    expect(container.querySelectorAll("iframe")).toHaveLength(1);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await flush();
    expect(dialogs()).toHaveLength(0);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("keeps Strategies exactly as they were, in the right-hand column", async () => {
    renderAt("/explore?tab=bots");
    await flush();
    const strategies = panel().querySelector('section[aria-label="Strategies"]') as HTMLElement;
    expect(strategies.textContent).toContain("Strategies");
    expect(strategies.textContent).toContain("Risk:");
    expect(strategies.textContent).toContain("Video coming");
    for (const strategy of STRATEGIES) expect(strategies.textContent).toContain(strategy.name);
    // No dialog from a Strategies video box.
    await click([...strategies.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.includes("video, coming soon"))!);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("puts Agents left of Strategies, with the four ready agents first", async () => {
    renderAt("/explore?tab=bots");
    await flush();
    const agents = panel().querySelector('section[aria-label="Agents"]') as HTMLElement;
    const strategies = panel().querySelector('section[aria-label="Strategies"]') as HTMLElement;
    // Agents come first in the DOM, so they stack first on a phone too.
    expect(agents.compareDocumentPosition(strategies) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const ready = [...agents.querySelectorAll('ul[aria-label="Agents, ready to use"] li')];
    expect(ready).toHaveLength(4);
    expect(ready.map((row) => row.querySelector("h3")?.textContent)).toEqual([
      "Directional Trader",
      "Fundamental Analyst",
      "Market Making Expert",
      "Solana DEX LP Expert",
    ]);
    // They are normal rows: no lock, and they carry the Agents tab's old action.
    for (const row of ready) {
      expect(row.getAttribute("aria-disabled")).toBeNull();
      expect(row.querySelector("button")).toBeTruthy();
      expect(row.textContent).toContain("Sample data");
    }
    expect(agents.querySelectorAll('[aria-label="Hackathon agents"] li')).toHaveLength(14);
  });

  it("locks the 14 hackathon agents while signed out, with the Botcamp panel above them", async () => {
    renderAt("/explore?tab=bots");
    await flush();
    const agents = panel().querySelector('section[aria-label="Agents"]') as HTMLElement;
    const locked = [...agents.querySelectorAll('ul[aria-label="Hackathon agents"] li')];
    expect(locked).toHaveLength(14);
    expect(agents.textContent).toContain("14 Hackathon Agents");
    expect(agents.textContent).toContain("Locked");
    for (const row of locked) {
      expect(row.getAttribute("aria-disabled")).toBe("true");
      expect(row.textContent).toContain("Locked");
      expect(row.querySelector("button")).toBeNull();
      expect(row.querySelector("a")).toBeNull();
    }
    // The panel sits between the sub-heading and the 14.
    const panelEl = agents.querySelector("label")?.closest("div.rounded-xl") as HTMLElement;
    expect(panelEl?.textContent).toContain("Sign in to Botcamp to unlock the 14 hackathon agents");
    expect(panelEl!.compareDocumentPosition(agents.querySelector('ul[aria-label="Hackathon agents"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sends Log in and Create account to Botcamp in a new tab", async () => {
    renderAt("/explore?tab=bots");
    await flush();
    const links = [...panel().querySelectorAll('a[href*="botcamp"]')] as HTMLAnchorElement[];
    expect(links.map((a) => a.textContent?.trim())).toEqual(["Log in", "Create account"]);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("https://www.botcamp.xyz");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("unlocks the 14 when the demo switch says signed in", async () => {
    renderAt("/explore?tab=bots");
    await flush();
    const agents = () => panel().querySelector('section[aria-label="Agents"]') as HTMLElement;
    expect(agents().textContent).toContain("Locked");

    const toggle = panel().querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    await act(async () => {
      toggle.click();
    });
    await flush();

    expect(agents().textContent).not.toContain("Locked");
    expect(agents().textContent).toContain("Signed in to Botcamp (sample)");
    const rows = [...agents().querySelectorAll('ul[aria-label="Hackathon agents"] li')];
    expect(rows).toHaveLength(14);
    for (const row of rows) {
      expect(row.getAttribute("aria-disabled")).toBeNull();
      expect(row.querySelector("button")).toBeTruthy();
    }
    // The flag is what the helper reads, so a reload keeps the demo state.
    expect(localStorage.getItem("botcampSignedIn")).toBe("1");
  });

  it("has no real href except the three channel links and the two Botcamp links", async () => {
    renderAt("/explore");
    await flush();
    const collect = () => [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!);
    const hrefs = collect();
    await click(tabNamed("Bots"));
    hrefs.push(...collect());
    await click(tabNamed("What's new"));
    hrefs.push(...collect());

    const allowed = new Set(["#", BOTCAMP_URL, ...CHANNELS.map((c) => c.url)]);
    for (const href of hrefs) expect(allowed.has(href), `unexpected href ${href}`).toBe(true);
    expect(new Set(hrefs.filter((h) => h !== "#"))).toEqual(new Set([BOTCAMP_URL, ...CHANNELS.map((c) => c.url)]));
  });

  it("filters the What's new timeline by source", async () => {
    renderAt("/explore?tab=news");
    await flush();
    expect(chipNamed("All").textContent).toContain(String(NEWS.length));
    expect(chipNamed("Livestream").textContent).toContain("3");
    expect(chipNamed("X").textContent).toContain("3");
    expect(chipNamed("Discord").textContent).toContain("2");

    await click(chipNamed("Discord"));
    const discord = NEWS.filter((n) => n.kind === "discord");
    expect(panel().querySelectorAll("ol > li")).toHaveLength(discord.length);
    for (const item of discord) expect(panel().textContent).toContain(item.title);
    expect(panel().textContent).not.toContain(NEWS.find((n) => n.kind === "livestream")!.title);
  });

  it("opens the three channel links in a new tab without a referrer", async () => {
    renderAt("/explore?tab=news");
    await flush();
    const links = [...container.querySelectorAll("a[target='_blank']")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(CHANNELS.map((c) => c.url));
    for (const link of links) expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("marks sample text as sample, and leaves the real strategy list unmarked", async () => {
    renderAt("/explore");
    await flush();
    // Get Started and its sample videos.
    expect(panel().textContent).toContain("Sample data");

    await click(tabNamed("Bots"));
    const strategies = panel().querySelector('section[aria-label="Strategies"]') as HTMLElement;
    expect(strategies.textContent).not.toContain("Sample data");

    // The four ready agents are written for the showcase, so they say so.
    const ready = [...panel().querySelectorAll('ul[aria-label="Agents, ready to use"] li')];
    expect(ready.filter((row) => row.textContent?.includes("Sample data"))).toHaveLength(4);
  });
});

describe("the old Agent Hub address", () => {
  it("redirects /hub to /explore", async () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/hub"]}>
          <Routes>
            <Route path="/hub" element={<HubRedirect />} />
            <Route path="/explore" element={<div data-testid="explore-page">Explore page</div>} />
          </Routes>
          <Where />
        </MemoryRouter>,
      );
    });
    await flush();
    expect(where()).toBe("/explore");
    expect(container.querySelector('[data-testid="explore-page"]')).not.toBeNull();
  });
});
