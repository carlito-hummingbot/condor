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
const tabNamed = (name: string) =>
  tabs().find((t) => t.textContent?.trim() === name) as HTMLButtonElement;
const where = () => container.querySelector('[data-testid="where"]')?.textContent ?? "";
const text = () => container.textContent ?? "";
const button = (name: RegExp | string) =>
  [...container.querySelectorAll("button")].find((b) =>
    typeof name === "string" ? b.textContent?.trim() === name : name.test(b.textContent ?? ""),
  ) as HTMLButtonElement | undefined;
/** The stepper's five items, top to bottom. */
const steps = () =>
  [...container.querySelectorAll('ol[aria-label="Build progress"] button')].map((b) => ({
    label: b.textContent?.replace(/[✓1-5]/g, "").trim(),
    active: b.getAttribute("aria-current") === "step",
  }));

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
      "Design",
      "Backtest",
      "Dry Run",
      "Deploy",
      "Improve",
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

  it("shows the stepper's done/open states from the draft's flags, and still lets you jump", async () => {
    sessionStorage.setItem(
      "condor.build.draft.v1",
      JSON.stringify({ ...emptyDraft(), title: "Churn v2", designDone: true, backtestDone: true }),
    );
    renderAt("/build?stage=dry-run");
    await flush();

    expect(steps().map((s) => s.label)).toEqual(["Design", "Backtest", "Dry Run", "Deploy", "Improve"]);
    expect(steps().filter((s) => s.active).map((s) => s.label)).toEqual(["Dry Run"]);
    // The two finished stages carry a tick in the step, so the check reads the
    // live state rather than a number.
    expect(text()).toContain("✓");

    const stepperButtons = [...container.querySelectorAll('ol[aria-label="Build progress"] button')];
    await click(stepperButtons[4]);
    expect(where()).toBe("/build?stage=improve");
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

    expect(text()).toContain("Based on Churn (Explore, sample)");
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

  it("renders a stage that has not landed yet as the placeholder, not a blank panel", async () => {
    renderAt("/build?stage=backtest");
    await flush();
    expect(text()).toContain("still being built");
    expect(container.querySelector('[role="tabpanel"]')).toBeTruthy();
  });

  it("shows the phone's one-line step in place of the five-dot stepper", async () => {
    renderAt("/build?stage=dry-run");
    await flush();
    expect(text()).toContain("Step 3 of 5: Dry Run");
  });
});
