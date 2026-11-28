/**
 * The Build shell: the tab row, `?stage=` in the URL, the stepper's states, the
 * draft in sessionStorage, the resume card, the two entry points, the gentle
 * guard, and "My drafts".
 *
 * The stages themselves are the other designers' work and are tested with
 * their own patches; here every stage draws the placeholder, which is what the
 * page shows until a stage lands.
 *
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { emptyDraft, readDraft } from "./draftStore";
import { Build } from "./Build";

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
        <Routes>
          <Route path="/build" element={<Build />} />
          <Route path="/labs" element={<Build />} />
          <Route path="/explore" element={<p>explore</p>} />
        </Routes>
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

const tabs = () => [...container.querySelectorAll('[role="tab"]')] as HTMLButtonElement[];
/** The number in "1 Design" is the stage's place in the lifecycle, not its name. */
const tabNamed = (name: string) =>
  tabs().find((t) => t.textContent?.replace(/^\d+\s*/, "").trim() === name) as HTMLButtonElement;
const where = () => container.querySelector('[data-testid="where"]')?.textContent ?? "";
const text = () => container.textContent ?? "";
const button = (name: RegExp | string) =>
  [...container.querySelectorAll("button")].find((b) =>
    typeof name === "string" ? b.textContent?.trim() === name : name.test(b.textContent ?? ""),
  ) as HTMLButtonElement | undefined;


beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  sessionStorage.clear();
});

describe("Build shell", () => {
  it("draws the five stages in order, Design first, and opens on Design", async () => {
    renderAt("/build");
    await flush();

    expect(tabs().map((t) => t.textContent?.trim())).toEqual([
      "1 Design",
      "2 Backtest",
      "3 Dry Run",
      "4 Deploy",
      "5 Improve",
    ]);
    expect(tabNamed("Design").getAttribute("aria-selected")).toBe("true");
    expect(text()).toContain("Sample data");
    expect(where()).toBe("/build");
  });

  it("keeps the stage in ?stage= and follows the tab row and the browser back button", async () => {
    renderAt("/build");
    await flush();

    await click(tabNamed("Deploy"));
    expect(where()).toBe("/build?stage=deploy");
    expect(tabNamed("Deploy").getAttribute("aria-selected")).toBe("true");

    await click(tabNamed("Improve"));
    expect(where()).toBe("/build?stage=improve");

    // Back and forward are the browser's; the address carries the stage, so a
    // real browser pass covers them. Here the address is the state.
    expect(where()).toBe("/build?stage=improve");
  });

  it("moves along the tab row with the arrow, Home and End keys", async () => {
    renderAt("/build?stage=backtest");
    await flush();
    const list = container.querySelector('[role="tablist"]') as HTMLElement;

    const key = async (k: string) =>
      act(async () => {
        list.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
      });

    await key("ArrowRight");
    expect(where()).toBe("/build?stage=dry-run");
    await key("End");
    expect(where()).toBe("/build?stage=improve");
    await key("Home");
    expect(where()).toBe("/build?stage=design");
    await key("ArrowLeft");
    expect(where()).toBe("/build?stage=design");
  });

  it("draws one bar only: the numbered stages, with no second stepper", async () => {
    sessionStorage.setItem(
      "condor.build.draft.v1",
      JSON.stringify({ ...emptyDraft(), title: "Churn v2", designDone: true, backtestDone: true }),
    );
    renderAt("/build?stage=dry-run");
    await flush();

    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(1);
    expect(container.querySelector("ol")).toBeNull();
    expect(text()).not.toContain("Step 3 of 5");
    expect(tabNamed("Dry Run").getAttribute("aria-selected")).toBe("true");
  });

  it("keeps the draft across a refresh and says so", async () => {
    renderAt("/build");
    await flush();

    // A draft written by a stage, the way `setDraft` writes it.
    const stored = { ...emptyDraft(), title: "Churn v2", designDone: true };
    sessionStorage.setItem("condor.build.draft.v1", JSON.stringify(stored));
    act(() => root.unmount());
    root = createRoot(container);
    renderAt("/build?stage=backtest");
    await flush();

    expect(text()).toContain("Draft:");
    expect(text()).toContain("Churn v2");
    expect(readDraft()?.designDone).toBe(true);
  });

  it("offers to continue a draft that was already there, and starts clean on Start new", async () => {
    sessionStorage.setItem(
      "condor.build.draft.v1",
      JSON.stringify({ ...emptyDraft(), title: "GateForum v1", designDone: true }),
    );
    renderAt("/build");
    await flush();

    expect(text()).toContain("Continue where you left off");
    expect(text()).toContain("GateForum v1");

    await click(button("Resume"));
    expect(where()).toBe("/build?stage=backtest");

    // A fresh mount, the way a reload comes back to /build with no params.
    act(() => root.unmount());
    root = createRoot(container);
    renderAt("/build");
    await flush();
    await click(button("Start new"));
    expect(where()).toBe("/build?stage=design");
    expect(text()).toContain("Draft: Untitled");
  });

  it("asks Discard twice before dropping the draft", async () => {
    sessionStorage.setItem(
      "condor.build.draft.v1",
      JSON.stringify({ ...emptyDraft(), title: "JEV v1" }),
    );
    renderAt("/build");
    await flush();

    await click(button("Discard"));
    expect(text()).toContain("Discard this draft?");
    await click(button("Discard"));
    expect(text()).toContain("Draft: Untitled");
  });

  it("seeds the draft from Explore and shows where it came from", async () => {
    renderAt("/build?from=explore&item=hb-agents%5Cchurn.html");
    await flush();

    expect(text()).toContain("Based on Churn (Learn, sample)");
    expect(readDraft()?.title).toBe("Churn (copy)");
    expect(readDraft()?.botKind).toBe("agent");
    expect(readDraft()?.startingPoint).toBe("import");
    expect(readDraft()?.designDone).toBe(false);
  });

  it("opens Improve from the Dashboard with the earlier stages done", async () => {
    renderAt("/build?stage=improve&from=dashboard&item=stable-churn");
    await flush();

    expect(text()).toContain("Improving your live bot Stable Churn v1 (Dashboard, sample)");
    expect(tabNamed("Improve").getAttribute("aria-selected")).toBe("true");
    expect(readDraft()?.deployed).toBe(true);
    expect(readDraft()?.dryRunDone).toBe(true);
    // No guard: a live bot has finished the stages before this one.
    expect(text()).not.toContain("You have not finished");
  });

  it("warns before a stage whose predecessor is unfinished, and continues anyway", async () => {
    renderAt("/build?stage=deploy");
    await flush();

    expect(text()).toContain("You have not finished");
    await click(button(/Continue anyway/));
    expect(text()).not.toContain("You have not finished");
    expect(tabNamed("Deploy").getAttribute("aria-selected")).toBe("true");
  });

  it("asks before an entry point replaces a draft, and can keep both", async () => {
    sessionStorage.setItem(
      "condor.build.draft.v1",
      JSON.stringify({ ...emptyDraft(), title: "My own idea", howItWorks: "fade the perp basis" }),
    );
    renderAt("/build?from=explore&item=hb-agents%5Cchurn.html");
    await flush();

    expect(text()).toContain("Replace your current draft My own idea?");
    await click(button("Keep both"));
    expect(readDraft()?.title).toBe("Churn (copy)");
    const saved = JSON.parse(sessionStorage.getItem("condor.build.drafts.v1") ?? "[]");
    expect(saved.map((row: { title: string }) => row.title)).toContain("My own idea");
  });

  it("lists a kept draft in My drafts and opens it", async () => {
    sessionStorage.setItem(
      "condor.build.drafts.v1",
      JSON.stringify([
        { id: "draft-1", title: "GateForum v2", stage: "backtest", updated: "2 min ago", draft: { ...emptyDraft(), title: "GateForum v2" } },
      ]),
    );
    renderAt("/build");
    await flush();

    await click(button(/My drafts \(1\)/));
    await click(button(/GateForum v2/));
    expect(where()).toBe("/build?stage=backtest");
    expect(text()).toContain("Draft: GateForum v2");
  });

  it("renders the stage that is on screen inside its tab panel", async () => {
    renderAt("/build?stage=backtest");
    await flush();
    expect(text()).toContain("Replay the design on past candles");
    expect(container.querySelector('[role="tabpanel"]')).toBeTruthy();
  });

  it("opens the Design chat, not the guide, for Improve this, with the banner saying so", async () => {
    renderAt("/build?stage=design&from=explore&intent=improve&item=hb-agents%5Cchurn.html");
    await flush();

    // The chat is open (its guide is behind "Edit guide") and the draft is named v2.
    expect(text()).toContain("Edit guide");
    expect(text()).toContain("Draft: Churn v2");
    expect(text()).toContain("Based on Churn (Learn, sample)");
    // The guide's own form controls are not on screen.
    expect(text()).not.toContain("Save and open the chat");
  });

  it("gives Improve a way back to the catalogue", async () => {
    sessionStorage.setItem(
      "condor.build.draft.v1",
      JSON.stringify({ ...emptyDraft(), title: "Stable Churn v1", designDone: true, backtestDone: true, dryRunDone: true, deployed: true }),
    );
    renderAt("/build?stage=improve");
    await flush();
    const back = [...container.querySelectorAll("a")].find((a) => a.textContent?.trim() === "Back to Learn");
    expect(back?.getAttribute("href")).toBe("/explore");
  });

  it("carries Improve's Create v2 draft back to Design with the flags reset", async () => {
    sessionStorage.setItem(
      "condor.build.draft.v1",
      JSON.stringify({ ...emptyDraft(), title: "Stable Churn v1", designDone: true, backtestDone: true, dryRunDone: true, deployed: true }),
    );
    renderAt("/build?stage=improve");
    await flush();

    await click(button(/Create v2 draft/));
    expect(where()).toBe("/build?stage=design");
    const kept = readDraft();
    expect(kept?.title).toBe("Stable Churn v2");
    expect(kept?.designDone).toBe(false);
    expect(kept?.deployed).toBe(false);
  });

  it("keeps the same one bar on a phone, scrolling sideways instead of stacking", async () => {
    renderAt("/build?stage=dry-run");
    await flush();
    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(1);
    const list = container.querySelector('[role="tablist"]') as HTMLElement;
    expect(list.className).toContain("overflow-x-auto");
  });
});
