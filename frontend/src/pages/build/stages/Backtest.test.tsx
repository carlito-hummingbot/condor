/**
 * Backtest, the second Build stage: setup, run, results, decide.
 *
 * The run is canned, so the interesting behaviour is the three states and the
 * two things this stage is allowed to change: `backtestDone` and the stage it
 * sends the operator to. Timers are fake, so a run is 2.5 s of a test's time.
 *
 * Needs a DOM, so this file overrides vitest's default `node` environment.
 *
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Draft, StageId } from "../types";

const { default: Backtest } = await import("./Backtest");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const EMPTY: Draft = {
  botKind: null,
  strategyType: null,
  exchange: null,
  marketType: null,
  pair: null,
  pairs: [],
  pairsText: "",
  pairsDynamic: false,
  marketQty: null,
  maxPositions: null,
  maxPositionsMode: "fixed",
  spreads: "",
  targetProfit: null,
  stopLoss: null,
  startingPoint: null,
  howItWorks: "",
  title: "",
  designDone: false,
  backtestDone: false,
  dryRunDone: false,
  deployed: false,
};

const DESIGNED: Draft = {
  ...EMPTY,
  botKind: "strategy",
  strategyType: "Market Making",
  exchange: "Binance",
  marketType: "Perps",
  pair: "USDC-USDT",
  pairs: ["USDC-USDT"],
  pairsText: "USDC-USDT",
  pairsDynamic: false,
  designDone: true,
};

let container: HTMLDivElement;
let root: Root;
let setDraft: (patch: Partial<Draft>) => void;
let goTo: (stage: StageId) => void;

function mount(draft: Draft = EMPTY) {
  setDraft = vi.fn();
  goTo = vi.fn();
  act(() => {
    root.render(<Backtest draft={draft} setDraft={setDraft} goTo={goTo} />);
  });
}

async function elapse(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function byText(pattern: RegExp): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find((b) =>
    pattern.test(b.textContent ?? ""),
  );
  if (!found) throw new Error(`no button matching ${pattern}`);
  return found;
}

function click(b: HTMLElement) {
  act(() => b.click());
}

function testid(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}

/** Setup, then a full canned run, so a test that only cares about results
 *  does not repeat the wait. */
async function runToResults() {
  click(byText(/^Run backtest$/));
  await elapse(2600);
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("Backtest", () => {
  it("names a sample draft when the demo opens on the stage with nothing designed", () => {
    mount(EMPTY);
    expect(testid("sample-draft")?.textContent).toContain(
      "Sample draft: Stable Churn on Binance, USDC-USDT",
    );
    expect(testid("backtest-setup")).not.toBeNull();
  });

  it("shows the draft's pair and market type as read-only chips", () => {
    mount(DESIGNED);
    expect(testid("sample-draft")).toBeNull();
    const text = container.textContent ?? "";
    expect(text).toContain("Market Making");
    expect(text).toContain("Perps");
    expect(text).toContain("USDC-USDT");
    // The pair is not a field on this card: only chips name it.
    expect(container.querySelectorAll("input[value='USDC-USDT']")).toHaveLength(0);
  });

  it("runs through its three steps and then shows the results", async () => {
    mount(DESIGNED);
    click(byText(/^Run backtest$/));
    expect(testid("backtest-running")).not.toBeNull();
    expect(testid("backtest-results")).toBeNull();
    expect(testid("backtest-progress")?.getAttribute("aria-valuenow")).toBe("8");

    await elapse(950);
    expect(testid("backtest-progress")?.getAttribute("aria-valuenow")).toBe("45");
    await elapse(800);
    expect(testid("backtest-progress")?.getAttribute("aria-valuenow")).toBe("78");
    await elapse(800);

    expect(testid("backtest-running")).toBeNull();
    expect(testid("backtest-results")).not.toBeNull();
    expect(testid("backtest-kpis")?.textContent).toContain("Net return");
    expect(testid("backtest-kpis")?.textContent).toContain("+18.4%");
    expect(testid("backtest-trades")?.textContent).toContain("USDC-USDT");
    // The equity summary is there for a screen reader, not just in the picture.
    expect(container.textContent).toContain("Equity curve: the strategy ends at");
  });

  it("cancels a run back to setup and leaves no timer behind", async () => {
    mount(DESIGNED);
    click(byText(/^Run backtest$/));
    await elapse(950);
    click(byText(/^Cancel$/));
    expect(testid("backtest-setup")).not.toBeNull();
    expect(testid("backtest-running")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    // Nothing from the cancelled run lands later.
    await elapse(4000);
    expect(testid("backtest-results")).toBeNull();
  });

  it("only offers Continue to Dry Run after a run, and marks the draft", async () => {
    mount(DESIGNED);
    expect(testid("continue-dry-run")).toBeNull();

    await runToResults();
    click(testid("continue-dry-run")!);

    expect(setDraft).toHaveBeenCalledWith({ backtestDone: true });
    expect(goTo).toHaveBeenCalledWith("dry-run");
    expect(goTo).toHaveBeenCalledTimes(1);
  });

  it("sends the operator back to Design to change the draft", async () => {
    mount(DESIGNED);
    await runToResults();
    click(byText(/^Refine the design$/));
    expect(goTo).toHaveBeenCalledWith("design");
  });

  it("returns to the setup card to run again with changes", async () => {
    mount(DESIGNED);
    await runToResults();
    click(byText(/^Run again with changes$/));
    expect(testid("backtest-setup")).not.toBeNull();
    expect(testid("backtest-results")).toBeNull();
  });

  it("sorts the trades table by a column and says which way", async () => {
    mount(DESIGNED);
    await runToResults();

    const pnlHeader = Array.from(container.querySelectorAll("th")).find((th) =>
      /P&L/.test(th.textContent ?? ""),
    );
    expect(pnlHeader?.getAttribute("aria-sort")).toBe("none");

    click(byText(/P&L/));
    expect(pnlHeader?.getAttribute("aria-sort")).toBe("descending");
    const first = () => container.querySelector("tbody tr td:nth-child(6)")?.textContent ?? "";
    expect(first()).toContain("+3.12");

    click(byText(/P&L/));
    expect(pnlHeader?.getAttribute("aria-sort")).toBe("ascending");
    expect(first()).toContain("−0.68");
  });

  it("adds each run to the history and compares two of them", async () => {
    mount(DESIGNED);
    // The history is part of the results, not of the setup card.
    expect(testid("backtest-history")).toBeNull();

    await runToResults();
    const history = testid("backtest-history")?.textContent ?? "";
    expect(history).toContain("v1 run 3");
    expect(history).toContain("v1 run 1");
    expect(history).toContain("v1 run 2");

    // Compare the oldest run against the newest.
    const row = Array.from(container.querySelectorAll("li")).find((li) =>
      /v1 run 1/.test(li.textContent ?? ""),
    );
    const compareButton = Array.from(row?.querySelectorAll("button") ?? []).find((b) =>
      /^Compare with run 3$/.test(b.textContent ?? ""),
    );
    click(compareButton!);
    expect(container.textContent).toContain("run 1 against run 3");
    expect(container.textContent).toContain("shallower");

    click(byText(/^Hide compare$/));
    expect(container.textContent).not.toContain("run 1 against run 3");
  });

  it("clears the canned run when it unmounts mid-run", async () => {
    mount(DESIGNED);
    click(byText(/^Run backtest$/));
    await elapse(950);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    // The shared afterEach unmounts again: give it an empty root to do it on.
    root = createRoot(container);
  });
});
