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

import { AGENTS, CHANNELS, LESSONS, NEWS, STRATEGIES } from "./explore/sampleData";

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
  it("renders the four tabs, with Get Started selected first", async () => {
    renderAt("/explore");
    await flush();
    expect(tabs().map((t) => t.textContent?.replace(/\d+/g, "").trim())).toEqual([
      "Get Started",
      "Strategies",
      "Agents",
      "What's new",
    ]);
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

  it("puts the selected tab in ?tab= when it is clicked", async () => {
    renderAt("/explore");
    await flush();
    await click(tabNamed("Strategies"));
    expect(where()).toBe("/explore?tab=strategies");
    expect(tabNamed("Strategies").getAttribute("aria-selected")).toBe("true");
    expect(panel().textContent).toContain("a rule-based setup: fixed rules decide when to quote, enter and exit.");
    for (const strategy of STRATEGIES) expect(panel().textContent).toContain(strategy.name);

    await click(tabNamed("Agents"));
    expect(where()).toBe("/explore?tab=agents");
    expect(panel().textContent).toContain("an AI-driven setup: a model decides, inside the limits you set.");
  });

  it("opens the tab named in ?tab=", async () => {
    renderAt("/explore?tab=agents");
    await flush();
    expect(tabNamed("Agents").getAttribute("aria-selected")).toBe("true");
    expect(panel().textContent).toContain("an AI-driven setup: a model decides, inside the limits you set.");
    expect(panel().textContent).not.toContain("Four short lessons");
  });

  it("moves tabs with the arrow, Home and End keys", async () => {
    renderAt("/explore");
    await flush();
    tabNamed("Get Started").focus();
    await act(async () => {
      tabNamed("Get Started").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    await flush();
    expect(tabNamed("Strategies").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabNamed("Strategies"));

    await act(async () => {
      tabNamed("Strategies").dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    await flush();
    expect(tabNamed("What's new").getAttribute("aria-selected")).toBe("true");

    await act(async () => {
      tabNamed("What's new").dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    await flush();
    expect(tabNamed("Get Started").getAttribute("aria-selected")).toBe("true");
  });

  it("shows the four lessons, underlined, with no video, build or import actions", async () => {
    renderAt("/explore");
    await flush();
    for (const lesson of LESSONS) {
      expect(panel().textContent).toContain(lesson.title);
      expect(panel().textContent).toContain(lesson.description);
    }
    const titles = [...panel().querySelectorAll("h3 button")] as HTMLButtonElement[];
    expect(titles).toHaveLength(4);
    expect(titles[0].className).toContain("underline");
    for (const gone of ["Watch", "Try in Build", "Import", "video coming"]) {
      expect(panel().textContent).not.toContain(gone);
    }
  });

  it("opens one lesson's video and summary under the box, and closes it on a second click", async () => {
    renderAt("/explore");
    await flush();
    // Nothing is open on first load.
    expect(panel().querySelector("#explore-lesson-detail")).toBeNull();

    const titles = () => [...panel().querySelectorAll("h3 button")] as HTMLButtonElement[];
    await click(titles()[1]);
    const detail = panel().querySelector("#explore-lesson-detail") as HTMLElement;
    expect(detail).toBeTruthy();
    expect(detail.textContent).toContain(LESSONS[1].title);
    expect(detail.textContent).toContain(LESSONS[1].videoSummary);
    expect(detail.textContent).toContain("Sample video");
    expect(detail.textContent).toContain("Sample data");
    expect(titles()[1].getAttribute("aria-expanded")).toBe("true");

    // One at a time.
    await click(titles()[3]);
    expect(panel().querySelector("#explore-lesson-detail")?.textContent).toContain(LESSONS[3].videoSummary);

    // The open title closes it.
    await click(titles()[3]);
    expect(panel().querySelector("#explore-lesson-detail")).toBeNull();
  });

  it("shows the source counts and filters the agent cards", async () => {
    renderAt("/explore?tab=agents");
    await flush();
    expect(chipNamed("All").textContent).toContain(String(AGENTS.length));
    expect(chipNamed("Hummingbot").textContent).toContain("1");
    expect(chipNamed("Botcamp Hackathon").textContent).toContain("14");
    expect(chipNamed("Community").textContent).toContain("2");
    // The final design opens on the 14 real hackathon agents.
    expect(chipNamed("Botcamp Hackathon").getAttribute("aria-pressed")).toBe("true");

    const botcamp = AGENTS.filter((a) => a.sourceKind === "botcamp");
    const hummingbot = AGENTS.filter((a) => a.sourceKind === "hummingbot");
    const community = AGENTS.filter((a) => a.sourceKind === "community");

    await click(chipNamed("Botcamp Hackathon"));
    expect(chipNamed("Botcamp Hackathon").getAttribute("aria-pressed")).toBe("true");
    for (const agent of botcamp) expect(panel().textContent).toContain(agent.name);
    expect(panel().textContent).not.toContain(hummingbot[0].name);
    expect(panel().textContent).toContain("From the Botcamp Agent Builders Cup");
    expect(panel().textContent).toContain("by wei hong · Botcamp");

    await click(chipNamed("Hummingbot"));
    expect(panel().textContent).toContain(hummingbot[0].name);
    expect(panel().textContent).not.toContain(botcamp[0].name);

    await click(chipNamed("Community"));
    for (const agent of community) expect(panel().textContent).toContain(agent.name);
    expect(panel().textContent).not.toContain(botcamp[0].name);
  });

  it("lists all 14 hackathon agents under Botcamp Hackathon", async () => {
    renderAt("/explore?tab=agents");
    await flush();
    const botcamp = AGENTS.filter((a) => a.sourceKind === "botcamp");
    expect(botcamp).toHaveLength(14);
    const cards = [...container.querySelectorAll('section[aria-label="Agents, video first"] article')];
    expect(cards).toHaveLength(botcamp.length);
    for (const agent of botcamp) {
      const card = cards.find((c) => c.textContent?.includes(agent.name));
      expect(card, `${agent.name} is missing`).toBeTruthy();
      expect(card?.textContent).toContain("Botcamp Hackathon");
    }
    // And one click reveals the 3 sample agents through the same filter row.
    await click(chipNamed("All"));
    expect(container.querySelectorAll('section[aria-label="Agents, video first"] article')).toHaveLength(AGENTS.length);
  });

  it("has no real href except the three verified channel links", async () => {
    renderAt("/explore");
    await flush();
    const collect = () => [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!);
    const hrefs = collect();
    await click(tabNamed("Strategies"));
    hrefs.push(...collect());
    await click(tabNamed("Agents"));
    hrefs.push(...collect());
    await click(tabNamed("What's new"));
    hrefs.push(...collect());

    const allowed = new Set(["#", ...CHANNELS.map((c) => c.url)]);
    for (const href of hrefs) expect(allowed.has(href), `unexpected href ${href}`).toBe(true);
    expect(new Set(hrefs.filter((h) => h !== "#"))).toEqual(new Set(CHANNELS.map((c) => c.url)));
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

  it("marks sample blocks, not the real strategy list", async () => {
    renderAt("/explore");
    await flush();
    expect(panel().textContent).toContain("Sample data");
    await click(tabNamed("Strategies"));
    expect(panel().textContent).not.toContain("Sample data");
    await click(tabNamed("Agents"));
    await click(chipNamed("All"));
    const sampleCards = [...container.querySelectorAll('section[aria-label="Agents, video first"] article')].filter(
      (c) => c.textContent?.includes("Sample data"),
    );
    expect(sampleCards).toHaveLength(3);
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
